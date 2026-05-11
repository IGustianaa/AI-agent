const TelegramBot = require('node-telegram-bot-api');

/**
 * TelegramBot Integration - Kontrol mining dari Telegram
 * 
 * Commands:
 * /start - Mulai bot & info
 * /mine - Mulai mining
 * /stop - Stop mining
 * /status - Lihat status mining & sistem
 * /benchmark - Jalankan benchmark
 * /optimize - Minta AI optimasi
 * /system - Info hardware
 * /help - Daftar command
 * [teks bebas] - Tanya AI
 */
class TelegramMiningBot {
  constructor(config, logger, miner, monitor, optimizer) {
    this.config = config;
    this.logger = logger;
    this.miner = miner;
    this.monitor = monitor;
    this.optimizer = optimizer;
    this.bot = null;
    this.authorizedUsers = [];
  }

  /**
   * Start Telegram bot
   */
  start() {
    if (!this.config.TELEGRAM_BOT_TOKEN) {
      this.logger.warn('TELEGRAM_BOT_TOKEN tidak diset - Telegram bot dinonaktifkan');
      return;
    }

    // Parse authorized user IDs
    if (this.config.TELEGRAM_CHAT_ID) {
      this.authorizedUsers = this.config.TELEGRAM_CHAT_ID
        .split(',')
        .map(id => id.trim())
        .filter(id => id);
    }

    this.bot = new TelegramBot(this.config.TELEGRAM_BOT_TOKEN, { polling: true });

    this.logger.info('🤖 Telegram bot aktif!');

    // Register handlers
    this.registerCommands();
    this.registerMessageHandler();

    // Error handling
    this.bot.on('polling_error', (err) => {
      this.logger.error(`Telegram polling error: ${err.message}`);
    });

    // Notify on start
    this.broadcast('🟢 *AI Mining Agent Online!*\n\nKetik /help untuk daftar perintah.');
  }

  /**
   * Check if user is authorized
   */
  isAuthorized(chatId) {
    // Jika tidak ada TELEGRAM_CHAT_ID, izinkan semua
    if (this.authorizedUsers.length === 0) return true;
    return this.authorizedUsers.includes(String(chatId));
  }

  /**
   * Register bot commands
   */
  registerCommands() {
    // /start
    this.bot.onText(/\/start/, (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);
      
      const text = `⛏️ *AI Mining Agent* v1.0.0\n\n` +
        `Platform: ${this.config.PLATFORM}\n` +
        `CPU: ${this.config.CPU_COUNT} cores\n` +
        `RAM: ${this.config.TOTAL_MEMORY_GB} GB\n` +
        `Algorithm: ${this.config.MINING_ALGORITHM}\n\n` +
        `Ketik /help untuk daftar perintah.`;
      
      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // /mine
    this.bot.onText(/\/mine/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      if (!this.config.WALLET_ADDRESS || !this.config.POOL_URL) {
        return this.bot.sendMessage(msg.chat.id, '❌ WALLET_ADDRESS dan POOL_URL belum diset di .env');
      }

      if (this.miner.isRunning) {
        return this.bot.sendMessage(msg.chat.id, '⚠️ Mining sudah berjalan!');
      }

      await this.miner.start();
      this.bot.sendMessage(msg.chat.id, '✅ Mining dimulai! ⛏️\n\nKetik /status untuk cek progress.');
    });

    // /stop
    this.bot.onText(/\/stop/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      if (!this.miner.isRunning) {
        return this.bot.sendMessage(msg.chat.id, '⚠️ Mining tidak sedang berjalan.');
      }

      await this.miner.stop();
      const stats = this.miner.getStats();
      const text = `🛑 Mining dihentikan.\n\n` +
        `📊 *Ringkasan:*\n` +
        `• Total Hashes: ${stats.totalHashes}\n` +
        `• Avg Hashrate: ${stats.avgHashrate.toFixed(2)} H/s\n` +
        `• Shares: ${stats.accepted}/${stats.submitted}\n` +
        `• Uptime: ${this.formatUptime(stats.uptime)}`;
      
      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // /status
    this.bot.onText(/\/status/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      const stats = this.miner.getStats();
      const sys = await this.monitor.getQuickStats();

      const statusIcon = stats.isRunning ? '🟢' : '🔴';
      const text = `${statusIcon} *Mining Status*\n\n` +
        `⛏️ *Mining:*\n` +
        `• Status: ${stats.isRunning ? 'Active' : 'Stopped'}\n` +
        `• Hashrate: ${stats.hashrate.toFixed(2)} H/s\n` +
        `• Shares: ✅ ${stats.accepted} / ❌ ${stats.rejected}\n` +
        `• Uptime: ${this.formatUptime(stats.uptime)}\n\n` +
        `💻 *System:*\n` +
        `• CPU: ${sys.cpuPercent.toFixed(1)}%\n` +
        `• Temp: ${sys.cpuTemp}°C\n` +
        `• RAM Free: ${sys.freeMemGB} GB`;

      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // /benchmark
    this.bot.onText(/\/benchmark/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      this.bot.sendMessage(msg.chat.id, '🏁 Menjalankan benchmark... (tunggu ~1 menit)');

      try {
        const result = await this.miner.benchmark();
        const text = `📊 *Hasil Benchmark*\n\n` +
          `• Algoritma: ${result.algorithm}\n` +
          `• Hashrate: ${result.hashrate.toFixed(2)} H/s\n` +
          `• Thread Optimal: ${result.optimalThreads}\n` +
          `• CPU Usage: ${result.cpuUsage.toFixed(1)}%\n` +
          `• Durasi: ${result.duration}s`;

        this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
      } catch (err) {
        this.bot.sendMessage(msg.chat.id, `❌ Benchmark error: ${err.message}`);
      }
    });

    // /optimize
    this.bot.onText(/\/optimize/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      this.bot.sendMessage(msg.chat.id, '🧠 AI sedang menganalisis...');

      try {
        const stats = await this.monitor.getFullStats();
        const mStats = this.miner.getStats();
        const advice = await this.optimizer.getAdvice({ ...stats, ...mStats });
        this.bot.sendMessage(msg.chat.id, `💡 *AI Recommendation:*\n\n${advice}`, { parse_mode: 'Markdown' });
      } catch (err) {
        this.bot.sendMessage(msg.chat.id, `❌ Error: ${err.message}`);
      }
    });

    // /system
    this.bot.onText(/\/system/, async (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      const sys = await this.monitor.getFullStats();
      const text = `💻 *System Info*\n\n` +
        `• Platform: ${this.config.PLATFORM} (${this.config.ARCH})\n` +
        `• CPU: ${sys.cpu.model}\n` +
        `• Cores: ${sys.cpu.cores}\n` +
        `• CPU Usage: ${sys.cpu.usage.toFixed(1)}%\n` +
        `• CPU Temp: ${sys.cpu.temp}°C\n` +
        `• RAM Total: ${sys.memory.totalGB} GB\n` +
        `• RAM Used: ${sys.memory.usedPercent.toFixed(1)}%\n` +
        `• RAM Free: ${sys.memory.freeGB} GB`;

      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // /help
    this.bot.onText(/\/help/, (msg) => {
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      const text = `📖 *Daftar Perintah:*\n\n` +
        `/mine - Mulai mining\n` +
        `/stop - Stop mining\n` +
        `/status - Status mining & sistem\n` +
        `/benchmark - Jalankan benchmark\n` +
        `/optimize - AI optimasi\n` +
        `/system - Info hardware\n` +
        `/help - Bantuan ini\n\n` +
        `💬 Atau ketik pertanyaan apapun untuk dijawab AI!`;

      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    // /id - untuk mendapatkan chat ID
    this.bot.onText(/\/id/, (msg) => {
      this.bot.sendMessage(msg.chat.id, `🆔 Chat ID kamu: \`${msg.chat.id}\`\n\nTambahkan ini ke TELEGRAM_CHAT_ID di .env`, { parse_mode: 'Markdown' });
    });
  }

  /**
   * Handle free-text messages (AI chat)
   */
  registerMessageHandler() {
    this.bot.on('message', async (msg) => {
      // Skip commands
      if (msg.text && msg.text.startsWith('/')) return;
      if (!msg.text) return;
      if (!this.isAuthorized(msg.chat.id)) return this.sendUnauthorized(msg.chat.id);

      // AI chat
      try {
        this.bot.sendChatAction(msg.chat.id, 'typing');
        const answer = await this.optimizer.chat(msg.text);
        this.bot.sendMessage(msg.chat.id, `🧠 ${answer}`);
      } catch (err) {
        this.bot.sendMessage(msg.chat.id, `❌ AI Error: ${err.message}`);
      }
    });
  }

  /**
   * Send unauthorized message
   */
  sendUnauthorized(chatId) {
    this.bot.sendMessage(chatId, '⛔ Kamu tidak memiliki akses ke bot ini.\n\nChat ID kamu: ' + chatId);
  }

  /**
   * Broadcast message to all authorized users
   */
  broadcast(text) {
    if (!this.bot) return;
    
    for (const chatId of this.authorizedUsers) {
      this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
    }
  }

  /**
   * Send alert (for auto-throttle notifications, etc.)
   */
  sendAlert(text) {
    this.broadcast(`⚠️ *ALERT*\n\n${text}`);
  }

  /**
   * Format uptime
   */
  formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  }

  /**
   * Stop bot
   */
  stop() {
    if (this.bot) {
      this.broadcast('🔴 *AI Mining Agent Offline*');
      this.bot.stopPolling();
      this.bot = null;
    }
  }
}

module.exports = TelegramMiningBot;
