const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

/**
 * Persistent conversation storage backed by SQLite (better-sqlite3).
 *
 * Each user's history is retrieved as an ordered list of OpenAI/Groq-style
 * messages: { role, content, tool_calls?, tool_call_id?, name? }.
 */
class ConversationManager {
  constructor() {
    const dbDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        name TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_user_created
        ON messages (user_id, created_at);
    `);

    this.stmts = {
      insert: this.db.prepare(`
        INSERT INTO messages
          (user_id, role, content, tool_calls, tool_call_id, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      getRecent: this.db.prepare(`
        SELECT role, content, tool_calls, tool_call_id, name
        FROM messages
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `),
      deleteByUser: this.db.prepare(`
        DELETE FROM messages WHERE user_id = ?
      `),
      countUserMessages: this.db.prepare(`
        SELECT COUNT(*) AS c FROM messages WHERE user_id = ?
      `),
      countActiveUsers: this.db.prepare(`
        SELECT COUNT(DISTINCT user_id) AS c FROM messages
      `),
      countTotal: this.db.prepare(`
        SELECT COUNT(*) AS c FROM messages
      `),
    };

    console.log(`[DB] SQLite initialized at ${config.DB_PATH}`);
  }

  /**
   * Simpan 1 pesan. `message` adalah objek OpenAI-style:
   *   { role, content, tool_calls?, tool_call_id?, name? }
   */
  addMessage(userId, message) {
    this.stmts.insert.run(
      userId,
      message.role,
      message.content ?? null,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_call_id ?? null,
      message.name ?? null,
      Date.now()
    );
  }

  /**
   * Ambil history terbaru (urutan kronologis, sudah di-cap MAX_HISTORY).
   * Juga memastikan pesan awal bukan `tool` message yatim (yang akan
   * ditolak oleh API karena tidak ada `assistant` dengan `tool_calls`
   * di atasnya).
   */
  getHistory(userId) {
    const rows = this.stmts.getRecent.all(userId, config.MAX_HISTORY);
    const messages = rows.reverse().map((row) => {
      const msg = { role: row.role };
      if (row.content !== null && row.content !== undefined) msg.content = row.content;
      if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
      if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
      if (row.name) msg.name = row.name;
      return msg;
    });

    // Buang pesan 'tool' yang tidak punya assistant tool_calls sebelumnya.
    while (messages.length > 0 && messages[0].role === 'tool') {
      messages.shift();
    }
    // Juga buang 'assistant' di awal kalau dia hanya tool_calls tanpa
    // konteks user sebelumnya.
    while (
      messages.length > 0 &&
      messages[0].role === 'assistant' &&
      messages[0].tool_calls &&
      !messages.some((m) => m.role === 'user')
    ) {
      messages.shift();
    }

    return messages;
  }

  clearHistory(userId) {
    this.stmts.deleteByUser.run(userId);
  }

  getStats(userId = null) {
    const activeUsers = this.stmts.countActiveUsers.get().c;
    const totalMessages = this.stmts.countTotal.get().c;
    const userCount = userId != null ? this.stmts.countUserMessages.get(userId).c : 0;
    return { activeUsers, totalMessages, userCount };
  }

  close() {
    this.db.close();
  }
}

module.exports = ConversationManager;
