const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

/**
 * Mining Worker Thread
 * 
 * Melakukan hashing computation di thread terpisah.
 * Mendukung beberapa algoritma hashing.
 */

const { threadId, algorithm, difficulty, startNonce, benchmarkMode } = workerData;

let nonce = startNonce || 0;
let currentDifficulty = difficulty || 100000;
let running = true;

// Target berdasarkan difficulty
function getTarget(diff) {
  const maxTarget = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
  return maxTarget / BigInt(diff);
}

/**
 * Hash function berdasarkan algoritma
 */
function computeHash(data, algo) {
  switch (algo) {
    case 'randomx':
      // RandomX simulation - dalam production gunakan native binding
      // RandomX asli membutuhkan ~2GB RAM dan C library
      return crypto.createHash('sha512').update(data).digest('hex');

    case 'cryptonight':
      // CryptoNight simulation
      const h1 = crypto.createHash('sha256').update(data).digest();
      return crypto.createHash('sha256').update(h1).digest('hex');

    case 'argon2':
      // Argon2 simulation (real argon2 membutuhkan native module)
      const salt = crypto.createHash('md5').update(data).digest();
      return crypto.createHash('sha512').update(Buffer.concat([Buffer.from(data), salt])).digest('hex');

    case 'kawpow':
      // KawPow simulation
      const h2 = crypto.createHash('sha3-256').update(data).digest();
      return crypto.createHash('sha3-256').update(h2).digest('hex');

    default:
      return crypto.createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Check if hash meets difficulty target
 */
function meetsTarget(hash, target) {
  const hashBigInt = BigInt('0x' + hash.slice(0, 16));
  return hashBigInt <= target;
}

/**
 * Main mining loop
 */
function mineLoop() {
  const batchSize = 1000;
  const target = getTarget(currentDifficulty);
  const blockTemplate = crypto.randomBytes(76).toString('hex');

  while (running) {
    let hashesThisBatch = 0;

    for (let i = 0; i < batchSize && running; i++) {
      const data = blockTemplate + nonce.toString(16).padStart(8, '0');
      const hash = computeHash(data, algorithm);
      nonce++;
      hashesThisBatch++;

      // Check if meets target (share found)
      if (meetsTarget(hash, target)) {
        parentPort.postMessage({
          type: 'share_found',
          share: {
            nonce: nonce - 1,
            hash,
            threadId,
          },
        });
      }
    }

    // Report hashes
    parentPort.postMessage({
      type: 'hash_found',
      hashes: hashesThisBatch,
      threadId,
    });

    // Yield to event loop (prevent complete CPU starvation)
    if (!benchmarkMode) {
      const delay = Math.max(1, Math.floor(10 * (1 - (currentDifficulty / 1000000))));
      sleepSync(delay);
    }
  }
}

/**
 * Synchronous sleep (microsecond-level pause)
 */
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

// Listen for messages from main thread
if (parentPort) {
  parentPort.on('message', (msg) => {
    if (msg.type === 'set_difficulty') {
      currentDifficulty = msg.value;
    } else if (msg.type === 'stop') {
      running = false;
    }
  });
}

// Start mining
mineLoop();
