const OpenAI = require('openai');
const Groq = require('groq-sdk');
const config = require('../config');
const { TOOL_SCHEMAS, executeTool } = require('../tools');

/**
 * Backend untuk provider yang kompatibel dengan OpenAI Chat Completions API:
 *   - OpenAI (api.openai.com)
 *   - Groq   (api.groq.com)
 *
 * Format history yang diterima = OpenAI-style:
 *   { role: 'user' | 'assistant' | 'tool',
 *     content, tool_calls?, tool_call_id?, name? }
 */
class OpenAICompatProvider {
  constructor() {
    if (config.AI_PROVIDER === 'openai') {
      this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
      this.model = config.OPENAI_MODEL;
      this.label = `openai / ${this.model}`;
    } else {
      this.client = new Groq({ apiKey: config.GROQ_API_KEY });
      this.model = config.GROQ_MODEL;
      this.label = `groq / ${this.model}`;
    }
  }

  modelLabel() {
    return this.label;
  }

  async *runWithTools(history) {
    const working = [...history];

    for (let iter = 0; iter < config.MAX_TOOL_ITERATIONS; iter++) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: config.SYSTEM_PROMPT }, ...working],
        tools: TOOL_SCHEMAS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      });

      let contentAcc = '';
      const toolCallsAcc = [];

      for await (const chunk of stream) {
        const choice = chunk.choices && chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta || {};

        if (delta.content) {
          contentAcc += delta.content;
          yield { type: 'content_delta', delta: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsAcc[idx]) {
              toolCallsAcc[idx] = {
                id: '',
                type: 'function',
                function: { name: '', arguments: '' },
              };
            }
            if (tc.id) toolCallsAcc[idx].id = tc.id;
            if (tc.type) toolCallsAcc[idx].type = tc.type;
            if (tc.function?.name) toolCallsAcc[idx].function.name += tc.function.name;
            if (tc.function?.arguments)
              toolCallsAcc[idx].function.arguments += tc.function.arguments;
          }
        }
      }

      const hasToolCalls =
        toolCallsAcc.length > 0 &&
        toolCallsAcc.some((tc) => tc && tc.function && tc.function.name);

      if (hasToolCalls) {
        const assistantMsg = {
          role: 'assistant',
          content: contentAcc || '',
          tool_calls: toolCallsAcc.filter(Boolean),
        };
        working.push(assistantMsg);
        yield { type: 'assistant_message', message: assistantMsg };

        for (const tc of assistantMsg.tool_calls) {
          let args = {};
          try {
            args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch (e) {
            args = { _parse_error: e.message, _raw: tc.function.arguments };
          }

          yield { type: 'tool_call_start', name: tc.function.name, args };

          let result;
          try {
            result = await executeTool(tc.function.name, args);
          } catch (err) {
            result = { error: `Tool execution failed: ${err.message}` };
          }

          const toolMsg = {
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          };
          working.push(toolMsg);
          yield { type: 'tool_result', name: tc.function.name, result, message: toolMsg };
        }
        continue;
      }

      const finalMsg = { role: 'assistant', content: contentAcc };
      yield { type: 'done', content: contentAcc, message: finalMsg };
      return;
    }

    yield {
      type: 'done',
      content: '(Batas iterasi tool tercapai.)',
      message: { role: 'assistant', content: '(Batas iterasi tool tercapai.)' },
    };
  }
}

module.exports = OpenAICompatProvider;
