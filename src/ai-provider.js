const config = require('./config');
const OpenAICompatProvider = require('./providers/openai-compat');
const BedrockProvider = require('./providers/bedrock');

/**
 * Dispatcher untuk 3 AI provider:
 *   - groq     → providers/openai-compat.js (Groq Cloud)
 *   - openai   → providers/openai-compat.js (OpenAI API)
 *   - bedrock  → providers/bedrock.js       (Amazon Bedrock, Converse API)
 *
 * Semua impl mem-yield event schema yang sama:
 *   { type: 'content_delta', delta }
 *   { type: 'assistant_message', message }
 *   { type: 'tool_call_start', name, args }
 *   { type: 'tool_result', name, result, message }
 *   { type: 'done', content, message }
 */
class AIProvider {
  constructor() {
    if (config.AI_PROVIDER === 'bedrock') {
      this.impl = new BedrockProvider();
    } else {
      this.impl = new OpenAICompatProvider();
    }
    console.log(`[AI] Using ${this.impl.modelLabel()}`);
  }

  async *runWithTools(history) {
    yield* this.impl.runWithTools(history);
  }
}

module.exports = AIProvider;
