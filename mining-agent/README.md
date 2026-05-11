# ⛏️ AI Mining Agent

AI-powered local cryptocurrency mining agent dengan optimasi cerdas.

## 🌟 Fitur

- **CPU Mining** - Mining crypto langsung di komputer lokal (RandomX, CryptoNight, Argon2, KawPow)
- **AI Optimization** - AI otomatis menganalisis dan mengoptimasi parameter mining
- **System Monitor** - Monitoring CPU, RAM, temperature real-time
- **Auto-Throttle** - Otomatis menurunkan beban jika CPU terlalu panas
- **Benchmark** - Test hashrate untuk menentukan konfigurasi optimal
- **Schedule** - Jadwal mining (contoh: hanya malam hari)
- **Interactive CLI** - Interface interaktif dengan AI chat

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd mining-agent
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env dengan konfigurasi kamu
```

### 3. Jalankan

```bash
# Interactive mode (recommended untuk pertama kali)
npm start

# Langsung mining
npm run mine

# Benchmark dulu
npm run benchmark

# Monitor sistem
npm run monitor
```

## 📋 Mode Operasi

### Interactive Mode (default)
```bash
npm start
```
Mode interaktif dengan CLI. Bisa start/stop mining, cek status, dan tanya AI.

### Mining Mode
```bash
npm run mine
```
Langsung mulai mining. Membutuhkan WALLET_ADDRESS dan POOL_URL di .env.

### Benchmark Mode
```bash
npm run benchmark
```
Test hashrate di berbagai thread count untuk menentukan konfigurasi optimal.

### Monitor Mode
```bash
npm run monitor
```
Monitor sistem (CPU, RAM, temp) secara real-time tanpa mining.

## ⚙️ Konfigurasi

Edit file `.env`:

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `AI_PROVIDER` | `groq` | Provider AI: `groq` \| `openai` |
| `GROQ_API_KEY` | - | API key Groq (gratis) |
| `MINING_ALGORITHM` | `randomx` | Algoritma: randomx/cryptonight/argon2/kawpow |
| `POOL_URL` | - | URL mining pool |
| `WALLET_ADDRESS` | - | Alamat wallet crypto |
| `WORKER_NAME` | auto | Nama rig/worker |
| `MAX_CPU_PERCENT` | `75` | Batas CPU usage |
| `MINING_THREADS` | `0` (auto) | Jumlah thread |
| `MAX_CPU_TEMP` | `80` | Suhu max sebelum throttle |
| `AI_CHECK_INTERVAL` | `300` | Interval AI analisis (detik) |
| `MINING_SCHEDULE` | - | Jadwal mining (HH:MM-HH:MM) |

## 🧠 AI Features

AI Mining Agent menggunakan LLM untuk:

1. **Auto-Optimize** - Analisis performa tiap 5 menit dan adjust parameter
2. **Benchmark Analysis** - Interpretasi hasil benchmark & rekomendasi
3. **Chat** - Tanya apapun tentang mining, crypto, hardware
4. **Thermal Management** - Prediksi kapan perlu throttle

### Provider AI yang Didukung

- **Groq** (Rekomendasi) - Gratis, cepat. Daftar di [groq.com](https://groq.com)
- **OpenAI** - GPT-4o-mini. Butuh API key berbayar.

## 🏗️ Arsitektur

```
mining-agent/
├── src/
│   ├── index.js          # Entry point & CLI
│   ├── config.js         # Configuration
│   ├── mining-engine.js  # Mining engine (worker management)
│   ├── mining-worker.js  # Worker thread (hashing)
│   ├── system-monitor.js # Hardware monitoring
│   ├── ai-optimizer.js   # AI optimization logic
│   └── logger.js         # Colored logger
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Algoritma Mining

| Algoritma | Coin | Memory | Catatan |
|-----------|------|--------|---------|
| RandomX | Monero (XMR) | 2 GB | CPU-optimized |
| CryptoNight | Various | 2 MB | Legacy |
| Argon2 | Various | Variable | Memory-hard |
| KawPow | Ravencoin (RVN) | 4 GB | GPU-focused |

> ⚠️ **Catatan**: Implementasi ini menggunakan simulasi hash di pure Node.js.
> Untuk hashrate production-level, gunakan native miner seperti [XMRig](https://xmrig.com/).

## 📊 Mining Pools (Contoh)

### Monero (XMR)
- `stratum+tcp://pool.supportxmr.com:3333`
- `stratum+tcp://xmr.nanopool.org:14433`

### Ravencoin (RVN)
- `stratum+tcp://rvn.2miners.com:6060`

## ⚠️ Disclaimer

- Mining cryptocurrency mengkonsumsi listrik dan membebani hardware
- Pastikan sistem pendinginan memadai
- Perhatikan biaya listrik vs potensi reward
- Gunakan dengan bijak dan tanggung jawab sendiri
- Ini adalah tool edukasi - untuk production mining gunakan miner native

## 📝 License

MIT
