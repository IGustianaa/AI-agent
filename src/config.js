require('dotenv').config();
const path = require('path');

module.exports = {
  // Telegram Bot Token dari @BotFather
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // AI Provider: 'openai' atau 'groq'
  AI_PROVIDER: process.env.AI_PROVIDER || 'groq',

  // OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Groq Configuration (gratis & cepat)
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  // System prompt untuk AI Agent
  SYSTEM_PROMPT:
    process.env.SYSTEM_PROMPT ||
    'Kamu adalah AI assistant yang helpful, ramah, dan informatif. Jawab dalam bahasa yang sama dengan user. Gunakan tools yang tersedia bila diperlukan (misal untuk hitungan, waktu saat ini, atau info terkini dari web).',

  // Allowed user IDs (kosong = semua bisa akses)
  ALLOWED_USERS: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(',').map((id) => parseInt(id.trim()))
    : [],

  // Max conversation history per user (jumlah pesan)
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 30,

  // Max iterasi tool calling dalam 1 turn (proteksi loop)
  MAX_TOOL_ITERATIONS: parseInt(process.env.MAX_TOOL_ITERATIONS) || 5,

  // Persistent storage
  DB_PATH: process.env.DB_PATH || path.join(process.cwd(), 'data', 'bot.db'),

  // Streaming: interval minimum antara edit pesan Telegram (ms)
  STREAM_EDIT_INTERVAL_MS: parseInt(process.env.STREAM_EDIT_INTERVAL_MS) || 1200,

  // Default timezone untuk tool datetime
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Jakarta',

  // Tavily API key (opsional) untuk web_search. Kalau kosong, pakai DuckDuckGo.
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
};
