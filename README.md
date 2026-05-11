# Telegram AI Agent

AI Agent berbasis Node.js yang terintegrasi dengan Telegram, mendukung **Groq** (gratis & cepat) dan **OpenAI**. Dirancang untuk deploy mudah di VPS.

## Fitur

- Chat AI langsung dari Telegram
- Mendukung 3 provider: **Groq** (gratis), **OpenAI**, dan **Amazon Bedrock** (Claude/Llama/Mistral)
- **Streaming response** — jawaban muncul bertahap seperti ChatGPT
- **Persistent memory (SQLite)** — riwayat tetap ada walau bot restart
- **Function calling / tools**:
  - `calculator` — evaluasi ekspresi matematika (mathjs)
  - `get_current_datetime` — waktu saat ini per timezone
  - `web_search` — pencarian web (Tavily kalau ada API key, fallback DuckDuckGo)
- Commands: `/start`, `/reset`, `/stats`, `/help`
- Akses kontrol via whitelist user ID (opsional)
- Siap deploy di VPS dengan PM2 atau systemd
- Pesan panjang otomatis di-split (Telegram 4096 char limit)
- Typing indicator saat AI memproses

## Arsitektur

```
src/
  index.js                    # Entry point & Telegram handler (streaming + tools)
  config.js                   # Load env variables
  ai-provider.js              # Dispatcher ke provider yang dipilih
  conversation.js             # SQLite persistent conversation store
  tools.js                    # Definisi & implementasi tools
  providers/
    openai-compat.js          # Backend Groq + OpenAI (Chat Completions)
    bedrock.js                # Backend Amazon Bedrock (Converse API)
data/
  bot.db                      # File SQLite (auto-created)
```

## Prasyarat

- Node.js >= 18
- Token Telegram Bot dari [@BotFather](https://t.me/BotFather)
- API Key salah satu provider:
  - [Groq](https://console.groq.com) — gratis
  - [OpenAI](https://platform.openai.com) — berbayar
  - [Amazon Bedrock](https://console.aws.amazon.com/bedrock) — berbayar, ala backend Kiro
- (Opsional) [Tavily API key](https://tavily.com) untuk web search berkualitas

## Setup Cepat (lokal)

```bash
git clone https://github.com/IGustianaa/AI-agent.git
cd AI-agent
npm install
cp .env.example .env
# edit .env dan isi TELEGRAM_BOT_TOKEN & GROQ_API_KEY
npm start
```

Kirim `/start` ke bot kamu di Telegram — bot siap digunakan.

> Catatan: `better-sqlite3` butuh native build. Pada Ubuntu/Debian biasanya sudah cukup dengan `build-essential`:
> ```bash
> sudo apt-get install -y build-essential python3
> ```

---

## Deploy ke VPS

### 1. Persiapan VPS

SSH ke VPS kamu, lalu install Node.js 20 + build tools:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential python3
```

### 2. Clone & Install

```bash
git clone https://github.com/IGustianaa/AI-agent.git
cd AI-agent
npm install --production
cp .env.example .env
nano .env   # isi semua variabel yang diperlukan
```

### 3. Jalankan dengan PM2 (rekomendasi)

PM2 akan auto-restart bot kalau crash dan otomatis jalan setelah reboot.

```bash
# Install PM2 global
sudo npm install -g pm2

# Start bot
pm2 start ecosystem.config.js

# Auto-start saat VPS reboot
pm2 startup
pm2 save

# Cek status
pm2 status
pm2 logs telegram-ai-agent
```

**Command PM2 yang berguna:**

```bash
pm2 restart telegram-ai-agent   # restart
pm2 stop telegram-ai-agent      # stop
pm2 delete telegram-ai-agent    # hapus dari PM2
pm2 monit                       # monitoring realtime
```

### 4. Alternatif: Systemd

Buat file `/etc/systemd/system/telegram-ai-agent.service`:

```ini
[Unit]
Description=Telegram AI Agent
After=network.target

[Service]
Type=simple
User=<username-vps-kamu>
WorkingDirectory=/home/<username-vps-kamu>/AI-agent
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Lalu:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-ai-agent
sudo systemctl start telegram-ai-agent
sudo systemctl status telegram-ai-agent
sudo journalctl -u telegram-ai-agent -f   # lihat log realtime
```

### 5. Update Bot ke Versi Baru

```bash
cd ~/AI-agent
git pull
npm install --production
pm2 restart telegram-ai-agent
```

### 6. Backup SQLite

File DB default ada di `data/bot.db`. Backup sederhana:

```bash
cp data/bot.db data/bot.db.$(date +%F).bak
```

Untuk restore, cukup replace file `data/bot.db` lalu `pm2 restart telegram-ai-agent`.

---

## Konfigurasi `.env`

| Variabel | Wajib | Default | Deskripsi |
|----------|-------|---------|-----------|
| `TELEGRAM_BOT_TOKEN` | Ya | — | Token dari @BotFather |
| `AI_PROVIDER` | Ya | `groq` | `groq` \| `openai` \| `bedrock` |
| `GROQ_API_KEY` | Jika Groq | — | API key Groq |
| `GROQ_MODEL` | — | `llama-3.3-70b-versatile` | Model Groq |
| `OPENAI_API_KEY` | Jika OpenAI | — | API key OpenAI |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Model OpenAI |
| `AWS_REGION` | Jika Bedrock | `us-east-1` | Region Bedrock |
| `AWS_ACCESS_KEY_ID` | Jika Bedrock | — | IAM access key (atau pakai IAM role / AWS_PROFILE) |
| `AWS_SECRET_ACCESS_KEY` | Jika Bedrock | — | IAM secret |
| `AWS_SESSION_TOKEN` | — | — | Untuk credential temporary |
| `BEDROCK_MODEL_ID` | — | `anthropic.claude-3-haiku-20240307-v1:0` | Model ID Bedrock |
| `SYSTEM_PROMPT` | — | (built-in) | Personality AI |
| `MAX_HISTORY` | — | `30` | Jumlah pesan terakhir sebagai context |
| `MAX_TOOL_ITERATIONS` | — | `5` | Batas iterasi tool-call per turn |
| `DB_PATH` | — | `data/bot.db` | Lokasi file SQLite |
| `STREAM_EDIT_INTERVAL_MS` | — | `1200` | Interval minimum edit pesan Telegram (ms) |
| `DEFAULT_TIMEZONE` | — | `Asia/Jakarta` | Timezone default untuk tool datetime |
| `TAVILY_API_KEY` | — | — | API key Tavily untuk web_search berkualitas |
| `ALLOWED_USERS` | — | (kosong = public) | Comma-separated Telegram user IDs |

## Streaming

Bot mengirim 1 pesan "placeholder" kemudian meng-edit-nya secara throttled setiap `STREAM_EDIT_INTERVAL_MS` milidetik. Kalau kamu kena rate limit dari Telegram (HTTP 429), naikkan nilainya ke `1500` atau lebih.

## Tool Calling — cara kerja

1. User mengirim pesan.
2. Bot memanggil AI dengan daftar tools tersedia.
3. Kalau model memutuskan perlu tool, bot mengeksekusi tool di server, menampilkan *status tool* ke chat (`🔧 Tool: calculator`), lalu memberi hasilnya kembali ke model.
4. Model melanjutkan menghasilkan jawaban (bisa memanggil tool lagi hingga `MAX_TOOL_ITERATIONS`).
5. Jawaban final di-stream ke user.

Semua pesan (termasuk `tool_calls` dan hasil `tool`) disimpan di SQLite agar pertanyaan lanjutan tetap memahami konteks.

### Contoh

- "Berapa 1234 * 77 + sqrt(2025)?" → model memanggil `calculator`.
- "Jam berapa sekarang di Tokyo?" → model memanggil `get_current_datetime` dengan timezone `Asia/Tokyo`.
- "Kabar terbaru tentang Node.js 22?" → model memanggil `web_search`.

> Catatan: kemampuan tool-calling pada model Groq **Llama 3.3 70B Versatile** sangat baik. Model kecil (8B) mungkin kurang reliabel — gunakan model besar untuk hasil maksimal.

## Cara Membuat Bot Telegram

1. Buka chat dengan [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot`
3. Beri nama & username untuk bot
4. BotFather akan kasih token — simpan ke `TELEGRAM_BOT_TOKEN`

## Cara Dapat API Key

### Groq (gratis)

1. Daftar di [console.groq.com](https://console.groq.com)
2. Masuk ke API Keys → Create API Key
3. Copy ke `GROQ_API_KEY`

### OpenAI (berbayar)

1. Daftar di [platform.openai.com](https://platform.openai.com)
2. Masuk ke API Keys → Create new secret key
3. Copy ke `OPENAI_API_KEY`

### Tavily (opsional, untuk web_search berkualitas)

1. Daftar di [tavily.com](https://tavily.com)
2. Dashboard → API Keys → copy ke `TAVILY_API_KEY`

### Amazon Bedrock (ala backend Kiro)

Bedrock adalah API AWS untuk foundation models (Claude, Llama, Mistral, Titan, dll). Kiro IDE sendiri dibangun di atas Bedrock, jadi ini yang paling mirip dengan "API Kiro".

1. Login ke [AWS Console → Bedrock](https://console.aws.amazon.com/bedrock)
2. Pilih region (mis. `us-east-1`), lalu **Model access** → request access ke model yang kamu mau (Claude 3 Haiku paling mudah di-approve, biasanya instant)
3. Buat IAM user dengan policy `AmazonBedrockFullAccess` (atau minimal `bedrock:InvokeModelWithResponseStream`) dan generate access key
4. Isi di `.env`:
   ```env
   AI_PROVIDER=bedrock
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
   ```

**Model ID yang sering dipakai:**

| Model | ID |
|---|---|
| Claude 3 Haiku (murah, cepat) | `anthropic.claude-3-haiku-20240307-v1:0` |
| Claude 3.5 Haiku | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| Claude 3.5 Sonnet | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Llama 3.1 70B Instruct | `meta.llama3-1-70b-instruct-v1:0` |
| Mistral Large | `mistral.mistral-large-2407-v1:0` |

> Beberapa model (Sonnet terutama) butuh **inference profile** — tambahkan prefix `us.` atau `eu.` ke model ID, mis. `us.anthropic.claude-3-5-sonnet-20241022-v2:0`. Cek [daftar cross-region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) atau coba; kalau error, ganti ke `us.*`.

> Bedrock dibayar **per-token** sesuai model. Cek [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/). Claude 3 Haiku adalah opsi termurah untuk eksperimen.

## Keamanan

- **JANGAN** commit file `.env` ke git (sudah di-ignore)
- File `data/bot.db` berisi riwayat percakapan — treat as sensitive
- Gunakan `ALLOWED_USERS` jika bot bersifat privat
- Rotate API key secara berkala

## Troubleshooting

**Bot tidak merespon?**
- Cek log: `pm2 logs telegram-ai-agent`
- Pastikan token benar & bot tidak conflict dengan instance lain
- Jika ada 2 bot memakai token sama → hanya 1 yang bisa polling

**Error `AI Error: ...`?**
- Cek API key valid & quota masih ada
- Cek koneksi internet VPS

**Error `GLIBC_x.xx not found` saat `npm install`?**
- `better-sqlite3` butuh kompilasi native. Pastikan `build-essential` dan `python3` terinstall.

**Pesan terpotong atau edit error `message is not modified`?**
- Ini diabaikan oleh bot. Kalau kamu kena rate limit Telegram (429), naikkan `STREAM_EDIT_INTERVAL_MS`.

## Lisensi

MIT
