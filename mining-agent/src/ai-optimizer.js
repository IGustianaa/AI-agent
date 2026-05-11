const config = require('./config');

/**
 * AIOptimizer - AI-powered mining optimization
 * 
 * Menggunakan LLM untuk:
 * - Menganalisis performa mining dan memberikan saran
 * - Otomatis menyesuaikan parameter (threads, intensity)
 * - Menjawab pertanyaan tentang mining
 * - Memberikan rekomendasi berdasarkan hardware
 */
class AIOptimizer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.client = null;
    this.history = [];
    this.initClient();
  }

  initClient() {
    if (this.config.AI_PROVIDER === 'groq' && this.config.GROQ_API_KEY) {
      const Groq = require('groq-sdk');
      this.client = new Groq({ apiKey: this.config.GROQ_API_KEY });
      this.model = this.config.GROQ_MODEL;
      this.provider = 'groq';
    } else if (this.config.AI_PROVIDER === 'openai' && this.config.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      this.client = new OpenAI({ apiKey: this.config.OPENAI_API_KEY });
      this.model = this.config.OPENAI_MODEL;
      this.provider = 'openai';
    } else {
      this.logger.warn('⚠️ Tidak ada AI API key - optimasi AI dinonaktifkan');
      this.client = null;
    }
  }

  /**
   * System prompt untuk AI optimizer
   */
  getSystemPrompt() {
    return `Kamu adalah AI Mining Optimizer, ahli dalam cryptocurrency mining.

Tugasmu:
1. Menganalisis performa mining dan memberikan saran optimasi
2. Menyesuaikan parameter mining berdasarkan kondisi hardware
3. Menjawab pertanyaan tentang mining, crypto, dan hardware

Konteks sistem:
- Platform: ${this.config.PLATFORM} (${this.config.ARCH})
- CPU Cores: ${this.config.CPU_COUNT}
- Total RAM: ${this.config.TOTAL_MEMORY_GB} GB
- Algorithm: ${this.config.MINING_ALGORITHM}
- Max CPU: ${this.config.MAX_CPU_PERCENT}%
- Max Temp: ${this.config.MAX_CPU_TEMP}°C

Ketika diminta melakukan optimasi, berikan response dalam format JSON:
{
  "action": "adjust_threads" | "adjust_difficulty" | "throttle" | "none",
  "value": <number>,
  "reason": "penjelasan singkat"
}

Jawab dalam Bahasa Indonesia.`;
  }

  /**
   * Optimize mining parameters based on current stats
   */
  async optimize(stats) {
    if (!this.client) return { action: 'none', reason: 'AI tidak tersedia' };

    const prompt = `Analisis performa mining berikut dan berikan optimasi:

Status Mining:
- Hashrate: ${stats.hashrate?.toFixed(2) || 0} H/s
- Shares accepted: ${stats.accepted || 0}/${stats.submitted || 0}
- Running threads: ${stats.threadCount || 'unknown'}

Status Sistem:
- CPU Usage: ${stats.cpu?.usage?.toFixed(1) || 'unknown'}%
- CPU Temp: ${stats.cpu?.temp || 'unknown'}°C
- RAM Used: ${stats.memory?.usedPercent?.toFixed(1) || 'unknown'}%
- Load Average: ${stats.cpu?.loadAvg || 'unknown'}

Berikan optimasi dalam format JSON.`;

    try {
      const response = await this.callAI(prompt);
      
      // Parse JSON dari response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const suggestion = JSON.parse(jsonMatch[0]);
        return suggestion;
      }

      return { action: 'none', reason: 'AI tidak memberikan saran spesifik' };
    } catch (err) {
      this.logger.error(`AI optimize error: ${err.message}`);
      return { action: 'none', reason: `Error: ${err.message}` };
    }
  }

  /**
   * Analyze benchmark results
   */
  async analyzeBenchmark(benchResult) {
    if (!this.client) {
      return `Hasil benchmark: ${benchResult.hashrate.toFixed(2)} H/s dengan ${benchResult.optimalThreads} threads.\n(AI analysis tidak tersedia - set API key)`;
    }

    const prompt = `Analisis hasil benchmark mining ini dan berikan rekomendasi detail:

Algoritma: ${benchResult.algorithm}
Best Hashrate: ${benchResult.hashrate.toFixed(2)} H/s
Optimal Threads: ${benchResult.optimalThreads}
CPU Usage: ${benchResult.cpuUsage.toFixed(1)}%
Test Duration: ${benchResult.duration}s

Hasil per thread:
${benchResult.allResults?.map(r => `  ${r.threads} threads: ${r.hashrate.toFixed(2)} H/s (CPU: ${r.cpuUsage.toFixed(1)}%)`).join('\n') || 'N/A'}

Hardware:
- CPU: ${this.config.CPU_COUNT} cores
- Platform: ${this.config.PLATFORM}
- RAM: ${this.config.TOTAL_MEMORY_GB} GB

Berikan:
1. Analisis performa
2. Rekomendasi konfigurasi optimal
3. Estimasi profitabilitas harian (jika memungkinkan)
4. Tips untuk meningkatkan hashrate`;

    try {
      return await this.callAI(prompt);
    } catch (err) {
      return `Error mendapatkan analisis AI: ${err.message}`;
    }
  }

  /**
   * Get general advice
   */
  async getAdvice(stats) {
    if (!this.client) return 'AI tidak tersedia. Set GROQ_API_KEY atau OPENAI_API_KEY di .env';

    const prompt = `Berikan saran dan status terkini untuk mining saya:

${JSON.stringify(stats, null, 2)}

Berikan ringkasan status dan saran yang bisa ditindaklanjuti.`;

    try {
      return await this.callAI(prompt);
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  /**
   * Chat - tanya AI tentang mining
   */
  async chat(message) {
    if (!this.client) return 'AI tidak tersedia. Set API key di .env untuk mengaktifkan fitur AI chat.';

    this.history.push({ role: 'user', content: message });

    // Keep history reasonable
    if (this.history.length > 20) {
      this.history = this.history.slice(-16);
    }

    try {
      const response = await this.callAI(null, true);
      this.history.push({ role: 'assistant', content: response });
      return response;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  /**
   * Call AI provider
   */
  async callAI(prompt, useHistory = false) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
    ];

    if (useHistory) {
      messages.push(...this.history);
    } else if (prompt) {
      messages.push({ role: 'user', content: prompt });
    }

    if (this.provider === 'groq') {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      });
      return completion.choices[0]?.message?.content || '';
    } else {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      });
      return completion.choices[0]?.message?.content || '';
    }
  }
}

module.exports = AIOptimizer;
