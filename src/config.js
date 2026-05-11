require('dotenv').config();

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
  SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || 
    'Kamu adalah AI assistant yang helpful, ramah, dan informatif. Jawab dalam bahasa yang sama dengan user. Berikan jawaban yang jelas dan terstruktur.',

  // Allowed user IDs (kosong = semua bisa akses)
  ALLOWED_USERS: process.env.ALLOWED_USERS 
    ? process.env.ALLOWED_USERS.split(',').map(id => parseInt(id.trim()))
    : [],

  // Max conversation history per user
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 20,
};
