const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const AIProvider = require('./ai-provider');
const ConversationManager = require('./conversation');

// --- Validasi konfigurasi wajib ------------------------------------------
if (!config.TELEGRAM_BOT_TOKEN) {
  console.error('[ERROR] TELEGRAM_BOT_TOKEN tidak ditemukan di .env');
  process.exit(1);
}
if (config.AI_PROVIDER === 'openai' && !config.OPENAI_API_KEY) {
  console.error('[ERROR] OPENAI_API_KEY tidak ditemukan di .env');
  process.exit(1);
}
if (config.AI_PROVIDER === 'groq' && !config.GROQ_API_KEY) {
  console.error('[ERROR] GROQ_API_KEY tidak ditemukan di .env');
  process.exit(1);
}
if (config.AI_PROVIDER === 'bedrock') {
  if (!config.BEDROCK_MODEL_ID) {
    console.error('[ERROR] BEDROCK_MODEL_ID tidak ditemukan di .env');
    process.exit(1);
  }
  // AWS credentials bisa dari env, AWS_PROFILE, atau IAM role.
  // Hanya warn, jangan exit — biar chain default SDK bekerja.
  if (!config.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    console.warn(
      '[WARN] AWS_ACCESS_KEY_ID tidak di-set & AWS_PROFILE kosong. ' +
        'SDK akan mencoba default credential chain (IAM role, ~/.aws/credentials).'
    );
  }
}
if (!['groq', 'openai', 'bedrock'].includes(config.AI_PROVIDER)) {
  console.error(
    `[ERROR] AI_PROVIDER tidak valid: "${config.AI_PROVIDER}". ` +
      `Gunakan: groq | openai | bedrock`
  );
  process.exit(1);
}

// --- Inisialisasi ---------------------------------------------------------
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
const ai = new AIProvider();
const conversation = new ConversationManager();

console.log('[BOT] AI Agent Telegram Bot dimulai...');

// --- Helpers --------------------------------------------------------------
function isAllowed(userId) {
  if (config.ALLOWED_USERS.length === 0) return true;
  return config.ALLOWED_USERS.includes(userId);
}

const MAX_TG_MSG_LEN = 4000;

/** Split teks panjang jadi chunk <= MAX_TG_MSG_LEN */
function splitLongText(text) {
  if (text.length <= MAX_TG_MSG_LEN) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_TG_MSG_LEN) {
    chunks.push(text.slice(i, i + MAX_TG_MSG_LEN));
  }
  return chunks;
}

async function sendLongMessage(chatId, text, options = {}) {
  const chunks = splitLongText(text);
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, options);
  }
}

// --- Commands -------------------------------------------------------------
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'teman';
  const welcome =
`Halo ${name}! 👋

Aku AI Agent dengan kemampuan:
\u2022 Chat dengan memori persisten (SQLite)
\u2022 Streaming jawaban seperti ChatGPT
\u2022 Tools: kalkulator, waktu saat ini, web search

*Commands*
/start  - Pesan ini
/reset  - Hapus riwayat percakapan
/stats  - Statistik
/help   - Bantuan

Provider: ${config.AI_PROVIDER.toUpperCase()}
Model: ${
  config.AI_PROVIDER === 'openai'
    ? config.OPENAI_MODEL
    : config.AI_PROVIDER === 'bedrock'
    ? config.BEDROCK_MODEL_ID
    : config.GROQ_MODEL
}`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

bot.onText(/^\/reset$/, (msg) => {
  const userId = msg.from.id;
  conversation.clearHistory(userId);
  bot.sendMessage(msg.chat.id, '🔄 Riwayat percakapan telah dihapus.');
});

bot.onText(/^\/stats$/, (msg) => {
  const userId = msg.from.id;
  const stats = conversation.getStats(userId);
  const text =
`📊 *Statistik*

👤 Pesan kamu tersimpan: ${stats.userCount}
👥 Total user aktif: ${stats.activeUsers}
💬 Total pesan di DB: ${stats.totalMessages}
🤖 Provider: ${config.AI_PROVIDER}
🗃 DB: \`${config.DB_PATH}\``;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/^\/help$/, (msg) => {
  const help =
`*Bantuan AI Agent*

Kirim pesan apa saja; aku akan menjawab dengan streaming.

Tools yang tersedia:
\u2022 *calculator* - hitung ekspresi matematika
\u2022 *get_current_datetime* - waktu saat ini
\u2022 *web_search* - cari info terbaru di web

Commands:
/start /reset /stats /help

Tips: /reset kalau ingin topik baru.`;
  bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

// --- Handler utama (streaming + tools) ------------------------------------
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // skip commands
  if (!msg.text) {
    bot.sendMessage(msg.chat.id, '⚠️ Maaf, saat ini aku hanya memproses pesan teks.');
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || msg.from.first_name;
  const userMessage = msg.text;

  if (!isAllowed(userId)) {
    bot.sendMessage(chatId, '🚫 Maaf, kamu tidak memiliki akses ke bot ini.');
    console.log(`[DENIED] ${userName} (${userId})`);
    return;
  }

  console.log(
    `[MSG] ${userName} (${userId}): ${userMessage.slice(0, 80)}${
      userMessage.length > 80 ? '…' : ''
    }`
  );

  // Typing indicator yang dijaga tetap hidup
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const typingInterval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);

  // --- State streaming ---
  let currentMsgId = null;
  let currentBuffer = '';
  let needNewMessage = false;
  let lastEditAt = 0;
  let editInFlight = false;

  const sendPlaceholder = async (text = '…') => {
    const m = await bot.sendMessage(chatId, text);
    currentMsgId = m.message_id;
    currentBuffer = '';
    needNewMessage = false;
  };

  const editCurrent = async ({ force = false, useMarkdown = false } = {}) => {
    if (!currentMsgId) return;
    const now = Date.now();
    if (!force && (editInFlight || now - lastEditAt < config.STREAM_EDIT_INTERVAL_MS)) {
      return;
    }
    const textToSend = currentBuffer || '…';
    editInFlight = true;
    lastEditAt = now;
    try {
      const opts = { chat_id: chatId, message_id: currentMsgId };
      if (useMarkdown) opts.parse_mode = 'Markdown';
      await bot.editMessageText(textToSend, opts);
    } catch (err) {
      const m = String(err.message || '');
      if (m.includes('message is not modified')) {
        // ok, ignore
      } else if (useMarkdown) {
        // retry tanpa markdown
        try {
          await bot.editMessageText(textToSend, {
            chat_id: chatId,
            message_id: currentMsgId,
          });
        } catch {
          /* swallow */
        }
      }
    } finally {
      editInFlight = false;
    }
  };

  /** Finalisasi pesan saat ini: edit sekali lagi, coba Markdown lalu plain. */
  const finalizeCurrent = async () => {
    if (!currentMsgId) return;
    if (currentBuffer.length > MAX_TG_MSG_LEN) {
      // Kirim ulang dalam beberapa pesan plain (lebih aman)
      try {
        await bot.editMessageText(currentBuffer.slice(0, MAX_TG_MSG_LEN), {
          chat_id: chatId,
          message_id: currentMsgId,
        });
      } catch {}
      const remainder = currentBuffer.slice(MAX_TG_MSG_LEN);
      await sendLongMessage(chatId, remainder);
    } else {
      await editCurrent({ force: true, useMarkdown: true });
    }
  };

  try {
    // Simpan pesan user terlebih dahulu
    conversation.addMessage(userId, { role: 'user', content: userMessage });
    const history = conversation.getHistory(userId);

    // Placeholder awal
    await sendPlaceholder('💭 …');

    for await (const ev of ai.runWithTools(history)) {
      if (ev.type === 'content_delta') {
        if (needNewMessage || !currentMsgId) {
          await sendPlaceholder('💭 …');
        }
        currentBuffer += ev.delta;

        // Jika melewati limit Telegram, finalize lalu mulai pesan baru
        if (currentBuffer.length > MAX_TG_MSG_LEN) {
          const head = currentBuffer.slice(0, MAX_TG_MSG_LEN);
          const tail = currentBuffer.slice(MAX_TG_MSG_LEN);
          currentBuffer = head;
          await editCurrent({ force: true });
          await sendPlaceholder('…');
          currentBuffer = tail;
        }

        // Throttled edit
        editCurrent();
      } else if (ev.type === 'assistant_message') {
        // Pesan assistant yang memicu tool calls -> simpan ke DB
        conversation.addMessage(userId, ev.message);
      } else if (ev.type === 'tool_call_start') {
        // Finalisasi pesan saat ini sebelum menampilkan status tool
        if (currentBuffer) await editCurrent({ force: true, useMarkdown: true });

        const argPreview = (() => {
          try {
            const s = JSON.stringify(ev.args);
            return s.length > 200 ? s.slice(0, 200) + '…' : s;
          } catch {
            return '';
          }
        })();

        await bot.sendMessage(
          chatId,
          `🔧 *Tool*: \`${ev.name}\`\n\`\`\`json\n${argPreview}\n\`\`\``,
          { parse_mode: 'Markdown' }
        ).catch(() =>
          bot.sendMessage(chatId, `🔧 Tool: ${ev.name}\n${argPreview}`)
        );

        // Setelah tool, kita perlu bubble baru untuk konten selanjutnya
        needNewMessage = true;
        currentMsgId = null;
        currentBuffer = '';
      } else if (ev.type === 'tool_result') {
        // Simpan hasil tool ke history agar pertanyaan lanjutan ingat konteks
        conversation.addMessage(userId, ev.message);
      } else if (ev.type === 'done') {
        if (ev.message) conversation.addMessage(userId, ev.message);
        if (currentMsgId && (currentBuffer || ev.content)) {
          if (!currentBuffer && ev.content) currentBuffer = ev.content;
          await finalizeCurrent();
        } else if (ev.content) {
          // Edge case: ada content tapi tidak ada current message
          await sendLongMessage(chatId, ev.content, { parse_mode: 'Markdown' }).catch(
            () => sendLongMessage(chatId, ev.content)
          );
        }
      }
    }

    // Jika placeholder masih kosong (tidak ada output sama sekali), beri info
    if (currentMsgId && currentBuffer === '') {
      await bot
        .editMessageText('(Model tidak menghasilkan balasan.)', {
          chat_id: chatId,
          message_id: currentMsgId,
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error('[ERROR]', error);
    const msg = `⚠️ Terjadi kesalahan: ${error.message}\n\nCoba lagi atau gunakan /reset.`;
    if (currentMsgId) {
      bot.editMessageText(msg, { chat_id: chatId, message_id: currentMsgId }).catch(() =>
        bot.sendMessage(chatId, msg)
      );
    } else {
      bot.sendMessage(chatId, msg);
    }
  } finally {
    clearInterval(typingInterval);
  }
});

// --- Error handlers -------------------------------------------------------
bot.on('polling_error', (error) => {
  console.error('[POLLING ERROR]', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const shutdown = (signal) => {
  console.log(`\n[BOT] Menerima ${signal}, mematikan...`);
  try {
    bot.stopPolling();
  } catch {}
  try {
    conversation.close();
  } catch {}
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
