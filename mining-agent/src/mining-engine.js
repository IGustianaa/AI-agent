const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

/**
 * MiningEngine - CPU Mining Engine
 * 
 * Implementasi mining lokal menggunakan worker threads.
 * Mendukung algoritma: RandomX (simulasi), CryptoNight, Argon2
 * 
 * Catatan: Ini adalah implementasi CPU mining murni Node.js.
 * Untuk production, disarankan menggunakan xmrig atau miner native lainnya.
 */
class MiningEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.workers = [];
    this.isRunning = false;
    this.startTime = null;

    // Stats
    this.stats = {
      hashrate: 0,
      totalHashes: 0,
      accepted: 0,
      rejected: 0,
      submitted: 0,
      avgHashrate: 0,
      uptime: 0,
      isRunning: false,
    };

    // Mining params
    this.threadCount = config.MINING_THREADS || Math.max(1, Math.floor(os.cpus().length * (config.MAX_CPU_PERCENT / 100)));
    this.difficulty = 100000;
    this.nonce = 0;
    this.hashBuffer = [];
    this.poolConnection = null;
  }

  /**
   * Start mining
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Mining sudah berjalan');
      return;
    }

    this.isRunning = true;
    this.stats.isRunning = true;
    this.startTime = Date.now();
    this.logger.info(`⛏️  Mining dimulai dengan ${this.threadCount} threads`);

    // Connect to pool (simulasi - untuk real implementation gunakan stratum protocol)
    await this.connectToPool();

    // Spawn worker threads
    for (let i = 0; i < this.threadCount; i++) {
      this.spawnWorker(i);
    }

    // Hashrate calculator
    this.hashrateInterval = setInterval(() => {
      this.calculateHashrate();
    }, 5000);
  }

  /**
   * Stop mining
   */
  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stats.isRunning = false;
    this.logger.info('🛑 Menghentikan workers...');

    // Terminate all workers
    for (const worker of this.workers) {
      try {
        await worker.terminate();
      } catch (e) {
        // ignore
      }
    }
    this.workers = [];

    if (this.hashrateInterval) {
      clearInterval(this.hashrateInterval);
    }

    // Update final stats
    if (this.startTime) {
      this.stats.uptime = (Date.now() - this.startTime) / 1000;
    }

    this.disconnectFromPool();
  }

  /**
   * Spawn a mining worker thread
   */
  spawnWorker(threadId) {
    const workerScript = path.join(__dirname, 'mining-worker.js');
    
    const worker = new Worker(workerScript, {
      workerData: {
        threadId,
        algorithm: this.config.MINING_ALGORITHM,
        difficulty: this.difficulty,
        startNonce: threadId * 1000000,
      },
    });

    worker.on('message', (msg) => {
      if (msg.type === 'hash_found') {
        this.stats.totalHashes += msg.hashes;
        this.hashBuffer.push({ hashes: msg.hashes, time: Date.now() });
      } else if (msg.type === 'share_found') {
        this.submitShare(msg.share);
      }
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker ${threadId} error: ${err.message}`);
      // Restart worker
      if (this.isRunning) {
        setTimeout(() => this.spawnWorker(threadId), 1000);
      }
    });

    worker.on('exit', (code) => {
      if (code !== 0 && this.isRunning) {
        this.logger.warn(`Worker ${threadId} exited with code ${code}, restarting...`);
        setTimeout(() => this.spawnWorker(threadId), 1000);
      }
    });

    this.workers.push(worker);
  }

  /**
   * Calculate current hashrate
   */
  calculateHashrate() {
    const now = Date.now();
    const recentWindow = 30000; // 30 detik window
    
    // Filter hashes dalam window
    this.hashBuffer = this.hashBuffer.filter(h => now - h.time < recentWindow);
    
    if (this.hashBuffer.length === 0) {
      this.stats.hashrate = 0;
      return;
    }

    const totalHashes = this.hashBuffer.reduce((sum, h) => sum + h.hashes, 0);
    const elapsed = (now - this.hashBuffer[0].time) / 1000;
    
    this.stats.hashrate = elapsed > 0 ? totalHashes / elapsed : 0;
    
    // Update average
    if (this.startTime) {
      const totalElapsed = (now - this.startTime) / 1000;
      this.stats.avgHashrate = this.stats.totalHashes / totalElapsed;
      this.stats.uptime = totalElapsed;
    }
  }

  /**
   * Connect to mining pool (stratum protocol stub)
   */
  async connectToPool() {
    if (!this.config.POOL_URL) {
      this.logger.info('📡 Solo mining mode (no pool configured)');
      return;
    }

    this.logger.info(`📡 Connecting to pool: ${this.config.POOL_URL}`);
    
    // Stratum connection stub
    // Real implementation would use net.Socket with stratum protocol
    this.poolConnection = {
      connected: true,
      url: this.config.POOL_URL,
      connectedAt: Date.now(),
    };

    this.logger.info('✅ Pool connected');
  }

  /**
   * Disconnect from pool
   */
  disconnectFromPool() {
    if (this.poolConnection) {
      this.poolConnection.connected = false;
      this.poolConnection = null;
    }
  }

  /**
   * Submit share to pool
   */
  submitShare(share) {
    this.stats.submitted++;
    
    // Simulasi share acceptance (90% accept rate)
    if (Math.random() < 0.9) {
      this.stats.accepted++;
      this.logger.debug(`✅ Share accepted (${this.stats.accepted}/${this.stats.submitted})`);
    } else {
      this.stats.rejected++;
      this.logger.debug(`❌ Share rejected`);
    }
  }

  /**
   * Get current mining stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Benchmark - test hashrate di berbagai thread counts
   */
  async benchmark() {
    this.logger.info('🏁 Starting benchmark...');
    const results = [];
    const testDuration = 10; // detik per test

    const maxThreads = Math.min(os.cpus().length, 8);
    
    for (let threads = 1; threads <= maxThreads; threads++) {
      this.logger.info(`  Testing ${threads} thread(s)...`);
      const result = await this.benchmarkWithThreads(threads, testDuration);
      results.push({ threads, ...result });
    }

    // Tentukan optimal
    const best = results.reduce((a, b) => a.hashrate > b.hashrate ? a : b);
    
    return {
      algorithm: this.config.MINING_ALGORITHM,
      hashrate: best.hashrate,
      optimalThreads: best.threads,
      cpuUsage: best.cpuUsage,
      duration: testDuration,
      allResults: results,
    };
  }

  /**
   * Benchmark specific thread count
   */
  async benchmarkWithThreads(threadCount, duration) {
    return new Promise((resolve) => {
      let totalHashes = 0;
      const workers = [];
      const startTime = Date.now();

      for (let i = 0; i < threadCount; i++) {
        const workerScript = path.join(__dirname, 'mining-worker.js');
        const worker = new Worker(workerScript, {
          workerData: {
            threadId: i,
            algorithm: this.config.MINING_ALGORITHM,
            difficulty: this.difficulty,
            startNonce: i * 1000000,
            benchmarkMode: true,
          },
        });

        worker.on('message', (msg) => {
          if (msg.type === 'hash_found') {
            totalHashes += msg.hashes;
          }
        });

        workers.push(worker);
      }

      setTimeout(async () => {
        for (const w of workers) {
          try { await w.terminate(); } catch (e) {}
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const cpuUsage = (threadCount / os.cpus().length) * 100;

        resolve({
          hashrate: totalHashes / elapsed,
          cpuUsage,
          totalHashes,
        });
      }, duration * 1000);
    });
  }

  /**
   * Apply AI optimization suggestion
   */
  async applyOptimization(suggestion) {
    switch (suggestion.action) {
      case 'adjust_threads': {
        const newCount = suggestion.value;
        if (newCount !== this.threadCount && newCount > 0) {
          this.logger.info(`🔧 Adjusting threads: ${this.threadCount} → ${newCount}`);
          await this.stop();
          this.threadCount = newCount;
          await this.start();
        }
        break;
      }

      case 'adjust_difficulty': {
        this.difficulty = suggestion.value;
        this.logger.info(`🔧 Adjusting difficulty: ${this.difficulty}`);
        // Restart workers with new difficulty
        for (const worker of this.workers) {
          worker.postMessage({ type: 'set_difficulty', value: this.difficulty });
        }
        break;
      }

      case 'throttle': {
        await this.throttle();
        break;
      }

      case 'none':
      default:
        break;
    }
  }

  /**
   * Throttle mining (reduce threads by half)
   */
  async throttle() {
    const newThreads = Math.max(1, Math.floor(this.threadCount / 2));
    if (newThreads < this.threadCount) {
      this.logger.info(`🌡️ Throttling: ${this.threadCount} → ${newThreads} threads`);
      await this.stop();
      this.threadCount = newThreads;
      await this.start();
    }
  }
}

module.exports = MiningEngine;
