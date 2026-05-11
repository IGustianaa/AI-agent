const config = require('./config');

class ConversationManager {
  constructor() {
    // In-memory storage untuk conversation history per user
    this.conversations = new Map();
  }

  getHistory(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    return this.conversations.get(userId);
  }

  addMessage(userId, role, content) {
    const history = this.getHistory(userId);
    history.push({ role, content });

    // Trim history jika melebihi batas
    if (history.length > config.MAX_HISTORY) {
      // Hapus pesan paling lama (keep system context fresh)
      history.splice(0, history.length - config.MAX_HISTORY);
    }

    this.conversations.set(userId, history);
  }

  clearHistory(userId) {
    this.conversations.set(userId, []);
  }

  getStats() {
    return {
      activeUsers: this.conversations.size,
      totalMessages: Array.from(this.conversations.values())
        .reduce((sum, msgs) => sum + msgs.length, 0),
    };
  }
}

module.exports = ConversationManager;
