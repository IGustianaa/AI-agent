const OpenAI = require('openai');
const Groq = require('groq-sdk');
const config = require('./config');

class AIProvider {
  constructor() {
    if (config.AI_PROVIDER === 'openai') {
      this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
      this.model = config.OPENAI_MODEL;
      console.log(`[AI] Using OpenAI with model: ${this.model}`);
    } else {
      this.client = new Groq({ apiKey: config.GROQ_API_KEY });
      this.model = config.GROQ_MODEL;
      console.log(`[AI] Using Groq with model: ${this.model}`);
    }
  }

  async chat(messages) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: config.SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 4096,
        temperature: 0.7,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('[AI] Error:', error.message);
      throw new Error(`AI Error: ${error.message}`);
    }
  }
}

module.exports = AIProvider;
