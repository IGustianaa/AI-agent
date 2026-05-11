require('dotenv').config();
const path = require('path');

module.exports = {
  // Telegram Bot Token dari @BotFather
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // AI Provider: 'groq' | 'openai' | 'bedrock'
  AI_PROVIDER: process.env.AI_PROVIDER || 'groq',

  // --- OpenAI ---
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // --- Groq (gratis & cepat) ---
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  // --- Amazon Bedrock ---
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
  // Contoh model ID:
  //   anthropic.claude-3-5-sonnet-20241022-v2:0
  //   anthropic.claude-3-5-haiku-20241022-v1:0
  //   anthropic.claude-3-haiku-20240307-v1:0
  //   meta.llama3-1-70b-instruct-v1:0
  //   mistral.mistral-large-2407-v1:0
  // Catatan: beberapa model butuh inference profile, contoh:
  //   us.anthropic.claude-3-5-sonnet-20241022-v2:0
  BEDROCK_MODEL_ID:
    process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',

  // --- Behavior ---
  SYSTEM_PROMPT:
    process.env.SYSTEM_PROMPT ||
    'Kamu adalah AI assistant yang helpful, ramah, dan informatif. Jawab dalam bahasa yang sama dengan user. Gunakan tools yang tersedia bila diperlukan (misal untuk hitungan, waktu saat ini, atau info terkini dari web).',

  ALLOWED_USERS: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(',').map((id) => parseInt(id.trim()))
    : [],

  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 30,
  MAX_TOOL_ITERATIONS: parseInt(process.env.MAX_TOOL_ITERATIONS) || 5,

  // --- Persistent storage ---
  DB_PATH: process.env.DB_PATH || path.join(process.cwd(), 'data', 'bot.db'),

  // --- Streaming ---
  STREAM_EDIT_INTERVAL_MS: parseInt(process.env.STREAM_EDIT_INTERVAL_MS) || 1200,

  // --- Tools ---
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Jakarta',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
};
