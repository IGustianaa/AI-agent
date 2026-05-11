const {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const crypto = require('crypto');
const config = require('../config');
const { TOOL_SCHEMAS, executeTool } = require('../tools');

/**
 * Backend Amazon Bedrock via Converse API (unified across Claude, Llama,
 * Mistral, etc. — dengan dukungan streaming + tool use).
 *
 * Docs:
 *  - https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html
 *  - https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
 *
 * Menerima `history` dalam format OpenAI-style (sama seperti backend lain)
 * dan meng-konversinya ke format Bedrock Converse. Event yang di-yield juga
 * mengikuti schema bersama:
 *   { type: 'content_delta', delta }
 *   { type: 'assistant_message', message }
 *   { type: 'tool_call_start', name, args }
 *   { type: 'tool_result', name, result, message }
 *   { type: 'done', content, message }
 */
class BedrockProvider {
  constructor() {
    const clientConfig = { region: config.AWS_REGION };

    // Jika user mengisi AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY secara
    // eksplisit, pakai itu. Kalau tidak, SDK akan pakai chain default
    // (env AWS_PROFILE, IAM role instance, dst).
    if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        ...(config.AWS_SESSION_TOKEN
          ? { sessionToken: config.AWS_SESSION_TOKEN }
          : {}),
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);
    this.modelId = config.BEDROCK_MODEL_ID;
    this.label = `bedrock / ${this.modelId} @ ${config.AWS_REGION}`;
  }

  modelLabel() {
    return this.label;
  }

  /**
   * Convert OpenAI-style history → Bedrock Converse format.
   * Returns { messages, toolConfig }.
   */
  _toBedrockMessages(history) {
    const bedrockMessages = [];
    let pendingToolResults = [];

    const flushToolResults = () => {
      if (pendingToolResults.length === 0) return;
      bedrockMessages.push({
        role: 'user',
        content: pendingToolResults.map((tr) => ({
          toolResult: {
            toolUseId: tr.tool_call_id,
            content: [{ text: tr.content || '' }],
            status: 'success',
          },
        })),
      });
      pendingToolResults = [];
    };

    for (const m of history) {
      if (m.role === 'user') {
        flushToolResults();
        bedrockMessages.push({
          role: 'user',
          content: [{ text: m.content ?? '' }],
        });
      } else if (m.role === 'assistant') {
        flushToolResults();
        const blocks = [];
        if (m.content) blocks.push({ text: m.content });
        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            let input = {};
            try {
              input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch {
              input = {};
            }
            blocks.push({
              toolUse: {
                toolUseId: tc.id,
                name: tc.function.name,
                input,
              },
            });
          }
        }
        // Bedrock tidak menerima pesan assistant kosong
        if (blocks.length === 0) blocks.push({ text: '' });
        bedrockMessages.push({ role: 'assistant', content: blocks });
      } else if (m.role === 'tool') {
        pendingToolResults.push(m);
      }
    }
    flushToolResults();

    return bedrockMessages;
  }

  _buildToolConfig() {
    return {
      tools: TOOL_SCHEMAS.map((t) => ({
        toolSpec: {
          name: t.function.name,
          description: t.function.description,
          inputSchema: { json: t.function.parameters },
        },
      })),
    };
  }

  async *runWithTools(history) {
    const working = [...history];
    const toolConfig = this._buildToolConfig();

    for (let iter = 0; iter < config.MAX_TOOL_ITERATIONS; iter++) {
      const bedrockMessages = this._toBedrockMessages(working);

      const cmd = new ConverseStreamCommand({
        modelId: this.modelId,
        system: [{ text: config.SYSTEM_PROMPT }],
        messages: bedrockMessages,
        inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
        toolConfig,
      });

      const response = await this.client.send(cmd);

      let contentAcc = '';
      // idx → { id, name, inputStr }
      const toolUseByIndex = new Map();
      let stopReason = null;

      for await (const event of response.stream) {
        if (event.contentBlockStart) {
          const start = event.contentBlockStart.start;
          const idx = event.contentBlockStart.contentBlockIndex;
          if (start && start.toolUse) {
            toolUseByIndex.set(idx, {
              id: start.toolUse.toolUseId,
              name: start.toolUse.name,
              inputStr: '',
            });
          }
        } else if (event.contentBlockDelta) {
          const d = event.contentBlockDelta.delta || {};
          const idx = event.contentBlockDelta.contentBlockIndex;
          if (typeof d.text === 'string' && d.text.length > 0) {
            contentAcc += d.text;
            yield { type: 'content_delta', delta: d.text };
          } else if (d.toolUse && typeof d.toolUse.input === 'string') {
            const cur = toolUseByIndex.get(idx);
            if (cur) cur.inputStr += d.toolUse.input;
          }
        } else if (event.messageStop) {
          stopReason = event.messageStop.stopReason;
        }
        // contentBlockStop, metadata, messageStart → tidak perlu ditangani
      }

      const toolUses = Array.from(toolUseByIndex.values());

      if (toolUses.length > 0 || stopReason === 'tool_use') {
        // Build assistant message dalam format OpenAI-style (untuk disimpan
        // konsisten di SQLite dan diteruskan sebagai context berikutnya)
        const assistantMsg = {
          role: 'assistant',
          content: contentAcc || '',
          tool_calls: toolUses.map((tu) => ({
            id: tu.id || `bedrock_${crypto.randomBytes(6).toString('hex')}`,
            type: 'function',
            function: {
              name: tu.name,
              arguments: tu.inputStr || '{}',
            },
          })),
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

module.exports = BedrockProvider;
