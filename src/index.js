const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const AIProvider = require('./ai-provider');
const ConversationManager = require('./conversation');

// Validasi konfigurasi wajib
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

// Inisialisasi
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
const ai = new AIProvider();
const conversation = new ConversationManager();

console.log('[BOT] AI Agent Telegram Bot dimulai...');

// Helper: cek apakah user diizinkan
function isAllowed(userId) {
  if (config.ALLOWED_USERS.length === 0) return true;
  return config.ALLOWED_USERS.includes(userId);
}

// Helper: kirim pesan panjang (Telegram limit 4096 char)
async function sendLongMessage(chatId, text, options = {}) {
  const MAX_LENGTH = 4000;
  if (text.length <= MAX_LENGTH) {
    return bot.sendMessage(chatId, text, options);
  }
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.slice(i, i + MAX_LENGTH));
  }
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, options);
  }
}

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'teman';
  const welcome = `Halo ${name}! 👋

Aku adalah AI Agent yang siap membantumu. Kirim saja pesan apapun untuk memulai percakapan.

*Commands:*
/start - Tampilkan pesan ini
/reset - Hapus riwayat percakapan
/stats - Statistik penggunaan
/help - Bantuan

Provider: ${config.AI_PROVIDER.toUpperCase()}
Model: ${config.AI_PROVIDER === 'openai' ? config.OPENAI_MODEL : config.GROQ_MODEL}`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

// Command: /reset
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  conversation.clearHistory(userId);
  bot.sendMessage(chatId, '🔄 Riwayat percakapan telah dihapus. Mulai percakapan baru!');
});

// Command: /stats
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const history = conversation.getHistory(userId);
  const stats = conversation.getStats();

  const text = `📊 *Statistik*

👤 Pesan kamu dalam sesi ini: ${history.length}
👥 Total user aktif: ${stats.activeUsers}
💬 Total pesan tersimpan: ${stats.totalMessages}
🤖 Provider: ${config.AI_PROVIDER}`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const help = `*Bantuan AI Agent*

Cara pakai:
1. Kirim pertanyaan/pesan apapun
2. Bot akan menjawab dengan AI
3. Percakapan tersimpan agar bot ingat konteks

Commands:
/start - Mulai
/reset - Hapus memori
/stats - Statistik
/help - Bantuan ini

Tips: Gunakan /reset jika ingin memulai topik baru.`;

  bot.sendMessage(chatId, help, { parse_mode: 'Markdown' });
});

// Handler pesan utama
bot.on('message', async (msg) => {
  // Skip jika pesan adalah command
  if (msg.text && msg.text.startsWith('/')) return;

  // Skip jika bukan pesan teks
  if (!msg.text) {
    bot.sendMessage(msg.chat.id, '⚠️ Maaf, saat ini aku hanya bisa memproses pesan teks.');
    return;
  }

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || msg.from.first_name;
  const userMessage = msg.text;

  // Akses kontrol
  if (!isAllowed(userId)) {
    bot.sendMessage(chatId, '🚫 Maaf, kamu tidak memiliki akses ke bot ini.');
    console.log(`[DENIED] User ${userName} (${userId}) tidak diizinkan`);
    return;
  }

  console.log(`[MSG] ${userName} (${userId}): ${userMessage.slice(0, 80)}${userMessage.length > 80 ? '...' : ''}`);

  // Tampilkan indikator "typing..."
  bot.sendChatAction(chatId, 'typing');

  // Keep typing indicator alive selama AI memproses
  const typingInterval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing');
  }, 4000);

  try {
    // Tambahkan pesan user ke history
    conversation.addMessage(userId, 'user', userMessage);

    // Dapatkan response dari AI
    const history = conversation.getHistory(userId);
    const response = await ai.chat(history);

    // Simpan response ke history
    conversation.addMessage(userId, 'assistant', response);

    // Kirim response ke user
    clearInterval(typingInterval);
    await sendLongMessage(chatId, response, { parse_mode: 'Markdown' }).catch(async () => {
      // Fallback tanpa Markdown jika parsing gagal
      await sendLongMessage(chatId, response);
    });
  } catch (error) {
    clearInterval(typingInterval);
    console.error('[ERROR]', error);
    bot.sendMessage(chatId, `⚠️ Terjadi kesalahan: ${error.message}\n\nCoba lagi atau gunakan /reset.`);
  }
});

// Error handlers
bot.on('polling_error', (error) => {
  console.error('[POLLING ERROR]', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('SIGINT', () => {
  console.log('\n[BOT] Menghentikan bot...');
  bot.stopPolling();
  process.exit(0);
});
