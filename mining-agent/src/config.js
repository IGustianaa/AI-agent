require('dotenv').config();
const os = require('os');

const cpuCount = os.cpus().length;

module.exports = {
  // --- AI Provider ---
  AI_PROVIDER: process.env.AI_PROVIDER || 'groq',

  // Groq
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // --- Mining ---
  MINING_ALGORITHM: process.env.MINING_ALGORITHM || 'randomx',
  POOL_URL: process.env.POOL_URL || '',
  WALLET_ADDRESS: process.env.WALLET_ADDRESS || '',
  WORKER_NAME: process.env.WORKER_NAME || `miner-${os.hostname()}`,

  // --- Resource Limits ---
  MAX_CPU_PERCENT: parseInt(process.env.MAX_CPU_PERCENT) || 75,
  MINING_THREADS: parseInt(process.env.MINING_THREADS) || 0, // 0 = auto
  MAX_CPU_TEMP: parseInt(process.env.MAX_CPU_TEMP) || 80,

  // --- AI Optimization ---
  AI_CHECK_INTERVAL: parseInt(process.env.AI_CHECK_INTERVAL) || 300,
  AUTO_OPTIMIZE: process.env.AUTO_OPTIMIZE !== 'false',

  // --- Monitoring ---
  DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT) || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // --- Telegram Bot ---
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  TELEGRAM_ENABLED: process.env.TELEGRAM_ENABLED !== 'false',

  // --- Schedule ---
  MINING_SCHEDULE: process.env.MINING_SCHEDULE || '',

  // --- System Info ---
  CPU_COUNT: cpuCount,
  PLATFORM: os.platform(),
  ARCH: os.arch(),
  TOTAL_MEMORY_GB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
};
