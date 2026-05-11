#!/usr/bin/env node
/**
 * AI Mining Agent - Entry Point
 * 
 * AI-powered local cryptocurrency mining agent yang dapat:
 * - Melakukan CPU mining (RandomX/CryptoNight/Argon2)
 * - Monitor sistem (CPU, RAM, Temperature)
 * - Optimasi otomatis via AI (thread count, intensity)
 * - Dashboard monitoring real-time
 * - Auto-throttle berdasarkan suhu dan beban CPU
 */

const config = require('./config');
const MiningEngine = require('./mining-engine');
const SystemMonitor = require('./system-monitor');
const AIOptimizer = require('./ai-optimizer');
const Logger = require('./logger');

const logger = new Logger(config.LOG_LEVEL);

// --- Parse CLI arguments ---
const args = process.argv.slice(2);
const MODE = (() => {
  if (args.includes('--benchmark')) return 'benchmark';
  if (args.includes('--monitor')) return 'monitor';
  if (args.includes('--start-mining')) return 'mine';
  return 'interactive';
})();

// --- ASCII Banner ---
function showBanner() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║          ⛏️  AI MINING AGENT v1.0.0  ⛏️              ║
║                                                      ║
║  AI-Powered Local Cryptocurrency Mining              ║
║  Otomatis optimasi performa dengan AI                ║
╠══════════════════════════════════════════════════════╣
║  Platform : ${config.PLATFORM.padEnd(40)}║
║  CPU      : ${String(config.CPU_COUNT + ' cores').padEnd(40)}║
║  Memory   : ${String(config.TOTAL_MEMORY_GB + ' GB').padEnd(40)}║
║  Algorithm: ${config.MINING_ALGORITHM.padEnd(40)}║
║  AI       : ${config.AI_PROVIDER.toUpperCase().padEnd(40)}║
╚══════════════════════════════════════════════════════╝
`);
}

// --- Main ---
async function main() {
  showBanner();

  // Validasi
  if (!config.GROQ_API_KEY && !config.OPENAI_API_KEY) {
    logger.warn('Tidak ada AI API key. Mining akan berjalan tanpa optimasi AI.');
  }

  const monitor = new SystemMonitor();
  const miner = new MiningEngine(config, logger);
  const optimizer = new AIOptimizer(config, logger);

  switch (MODE) {
    case 'benchmark': {
      logger.info('🏁 Mode: BENCHMARK');
      logger.info('Menjalankan benchmark untuk menentukan hashrate optimal...\n');
      const result = await miner.benchmark();
      console.log('\n📊 Hasil Benchmark:');
      console.log('─'.repeat(50));
      console.log(`  Algoritma     : ${result.algorithm}`);
      console.log(`  Hashrate      : ${result.hashrate.toFixed(2)} H/s`);
      console.log(`  Thread optimal: ${result.optimalThreads}`);
      console.log(`  CPU Usage     : ${result.cpuUsage.toFixed(1)}%`);
      console.log(`  Durasi test   : ${result.duration}s`);
      console.log('─'.repeat(50));
      console.log('\n💡 Rekomendasi AI:');
      const advice = await optimizer.analyzeBenchmark(result);
      console.log(advice);
      break;
    }

    case 'monitor': {
      logger.info('📊 Mode: MONITOR');
      logger.info('Memantau sistem secara real-time...\n');
      await runMonitor(monitor);
      break;
    }

    case 'mine': {
      logger.info('⛏️  Mode: MINING');
      await startMining(miner, monitor, optimizer);
      break;
    }

    default: {
      // Interactive mode
      logger.info('🤖 Mode: INTERACTIVE');
      logger.info('Ketik perintah atau tanya AI tentang mining.\n');
      await runInteractive(miner, monitor, optimizer);
    }
  }
}

// --- Mining Loop ---
async function startMining(miner, monitor, optimizer) {
  // Cek schedule
  if (config.MINING_SCHEDULE) {
    const inSchedule = isInSchedule(config.MINING_SCHEDULE);
    if (!inSchedule) {
      logger.info(`⏰ Di luar jadwal mining (${config.MINING_SCHEDULE}). Menunggu...`);
      await waitForSchedule(config.MINING_SCHEDULE);
    }
  }

  if (!config.WALLET_ADDRESS || !config.POOL_URL) {
    logger.error('❌ WALLET_ADDRESS dan POOL_URL harus diisi di .env');
    logger.info('Jalankan mode benchmark dulu: npm run benchmark');
    process.exit(1);
  }

  logger.info(`\n🚀 Memulai mining...`);
  logger.info(`   Pool    : ${config.POOL_URL}`);
  logger.info(`   Wallet  : ${config.WALLET_ADDRESS.slice(0, 10)}...${config.WALLET_ADDRESS.slice(-6)}`);
  logger.info(`   Worker  : ${config.WORKER_NAME}`);
  logger.info(`   Threads : ${config.MINING_THREADS || 'auto'}`);
  logger.info(`   Max CPU : ${config.MAX_CPU_PERCENT}%\n`);

  // Start mining
  await miner.start();

  // AI optimization loop
  let optimizationInterval = null;
  if (config.AUTO_OPTIMIZE && (config.GROQ_API_KEY || config.OPENAI_API_KEY)) {
    logger.info('🧠 AI Auto-Optimization aktif');
    optimizationInterval = setInterval(async () => {
      try {
        const stats = await monitor.getFullStats();
        const miningStats = miner.getStats();
        const suggestion = await optimizer.optimize({ ...stats, ...miningStats });
        
        if (suggestion && suggestion.action !== 'none') {
          logger.info(`🧠 AI Suggestion: ${suggestion.reason}`);
          await miner.applyOptimization(suggestion);
        }
      } catch (err) {
        logger.error(`AI optimization error: ${err.message}`);
      }
    }, config.AI_CHECK_INTERVAL * 1000);
  }

  // Status reporting
  const statusInterval = setInterval(async () => {
    const stats = miner.getStats();
    const sysStats = await monitor.getQuickStats();
    
    logger.info(
      `⛏️  HR: ${stats.hashrate.toFixed(2)} H/s | ` +
      `Shares: ${stats.accepted}/${stats.submitted} | ` +
      `CPU: ${sysStats.cpuPercent.toFixed(1)}% | ` +
      `Temp: ${sysStats.cpuTemp}°C | ` +
      `Uptime: ${formatUptime(stats.uptime)}`
    );

    // Auto-throttle jika suhu tinggi
    if (sysStats.cpuTemp > config.MAX_CPU_TEMP) {
      logger.warn(`🌡️ CPU terlalu panas (${sysStats.cpuTemp}°C)! Throttling...`);
      await miner.throttle();
    }
  }, 30000);

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`\n🛑 Menerima ${signal}, menghentikan mining...`);
    clearInterval(statusInterval);
    if (optimizationInterval) clearInterval(optimizationInterval);
    await miner.stop();
    const finalStats = miner.getStats();
    console.log('\n📊 Ringkasan Session:');
    console.log('─'.repeat(50));
    console.log(`  Total Hashes  : ${finalStats.totalHashes}`);
    console.log(`  Avg Hashrate  : ${finalStats.avgHashrate.toFixed(2)} H/s`);
    console.log(`  Shares OK     : ${finalStats.accepted}`);
    console.log(`  Shares Fail   : ${finalStats.rejected}`);
    console.log(`  Uptime        : ${formatUptime(finalStats.uptime)}`);
    console.log('─'.repeat(50));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// --- Monitor Mode ---
async function runMonitor(monitor) {
  const interval = setInterval(async () => {
    const stats = await monitor.getFullStats();
    console.clear();
    console.log('╔═══════════════════════════════════════╗');
    console.log('║      📊 SYSTEM MONITOR                ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║ CPU Usage    : ${String(stats.cpu.usage.toFixed(1) + '%').padEnd(22)}║`);
    console.log(`║ CPU Temp     : ${String(stats.cpu.temp + '°C').padEnd(22)}║`);
    console.log(`║ CPU Cores    : ${String(stats.cpu.cores).padEnd(22)}║`);
    console.log(`║ RAM Used     : ${String(stats.memory.usedPercent.toFixed(1) + '%').padEnd(22)}║`);
    console.log(`║ RAM Free     : ${String(stats.memory.freeGB + ' GB').padEnd(22)}║`);
    console.log(`║ Load Avg     : ${String(stats.cpu.loadAvg).padEnd(22)}║`);
    console.log('╚═══════════════════════════════════════╝');
    console.log('\n  Ctrl+C untuk keluar');
  }, 2000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n👋 Monitor dihentikan.');
    process.exit(0);
  });
}

// --- Interactive Mode ---
async function runInteractive(miner, monitor, optimizer) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '⛏️  > ',
  });

  console.log('Commands:');
  console.log('  start       - Mulai mining');
  console.log('  stop        - Hentikan mining');
  console.log('  status      - Lihat status');
  console.log('  benchmark   - Jalankan benchmark');
  console.log('  optimize    - Minta AI optimasi');
  console.log('  system      - Info sistem');
  console.log('  help        - Bantuan');
  console.log('  exit        - Keluar');
  console.log('  [teks]      - Tanya AI tentang mining\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim().toLowerCase();

    switch (input) {
      case 'start':
        if (!config.WALLET_ADDRESS || !config.POOL_URL) {
          console.log('❌ Set WALLET_ADDRESS dan POOL_URL di .env dulu');
        } else {
          await miner.start();
          console.log('✅ Mining dimulai');
        }
        break;

      case 'stop':
        await miner.stop();
        console.log('🛑 Mining dihentikan');
        break;

      case 'status': {
        const stats = miner.getStats();
        const sys = await monitor.getQuickStats();
        console.log(`\n  Mining    : ${stats.isRunning ? '🟢 Active' : '🔴 Stopped'}`);
        console.log(`  Hashrate  : ${stats.hashrate.toFixed(2)} H/s`);
        console.log(`  Shares    : ${stats.accepted}/${stats.submitted}`);
        console.log(`  CPU       : ${sys.cpuPercent.toFixed(1)}%`);
        console.log(`  Temp      : ${sys.cpuTemp}°C`);
        console.log(`  Uptime    : ${formatUptime(stats.uptime)}\n`);
        break;
      }

      case 'benchmark': {
        console.log('🏁 Menjalankan benchmark...');
        const result = await miner.benchmark();
        console.log(`  Hashrate: ${result.hashrate.toFixed(2)} H/s`);
        console.log(`  Optimal threads: ${result.optimalThreads}`);
        break;
      }

      case 'optimize': {
        console.log('🧠 Meminta AI untuk analisis...');
        const stats = await monitor.getFullStats();
        const mStats = miner.getStats();
        const advice = await optimizer.getAdvice({ ...stats, ...mStats });
        console.log(`\n💡 AI Says:\n${advice}\n`);
        break;
      }

      case 'system': {
        const sys = await monitor.getFullStats();
        console.log(`\n  Platform  : ${config.PLATFORM} (${config.ARCH})`);
        console.log(`  CPU       : ${sys.cpu.model}`);
        console.log(`  Cores     : ${sys.cpu.cores}`);
        console.log(`  RAM Total : ${config.TOTAL_MEMORY_GB} GB`);
        console.log(`  CPU Usage : ${sys.cpu.usage.toFixed(1)}%`);
        console.log(`  CPU Temp  : ${sys.cpu.temp}°C\n`);
        break;
      }

      case 'help':
        console.log('\n  Perintah tersedia: start, stop, status, benchmark, optimize, system, exit');
        console.log('  Atau ketik pertanyaan apapun tentang mining untuk dijawab AI.\n');
        break;

      case 'exit':
      case 'quit':
        await miner.stop();
        console.log('👋 Sampai jumpa!');
        process.exit(0);

      default:
        if (input.length > 0) {
          console.log('🧠 AI sedang berpikir...');
          const answer = await optimizer.chat(input);
          console.log(`\n💬 ${answer}\n`);
        }
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await miner.stop();
    process.exit(0);
  });
}

// --- Helpers ---
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function isInSchedule(schedule) {
  if (!schedule) return true;
  const [start, end] = schedule.split('-');
  if (!start || !end) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight schedule (e.g., 22:00-06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

async function waitForSchedule(schedule) {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (isInSchedule(schedule)) {
        clearInterval(check);
        resolve();
      }
    }, 60000);
  });
}

// --- Start ---
main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
