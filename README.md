# Telegram AI Agent

AI Agent berbasis Node.js yang terintegrasi dengan Telegram, mendukung **Groq** (gratis & cepat) dan **OpenAI**. Dirancang untuk deploy mudah di VPS.

## Fitur

- Chat AI langsung dari Telegram
- Mendukung 2 provider: Groq (gratis) & OpenAI
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
  index.js         # Entry point & Telegram handler (streaming + tools)
  config.js        # Load env variables
  ai-provider.js   # Abstraksi Groq/OpenAI + streaming + tool loop
  conversation.js  # SQLite persistent conversation store
  tools.js         # Definisi & implementasi tools
data/
  bot.db           # File SQLite (auto-created)
```

## Prasyarat

- Node.js >= 18
- Token Telegram Bot dari [@BotFather](https://t.me/BotFather)
- API Key salah satu:
  - [Groq](https://console.groq.com) — gratis
  - [OpenAI](https://platform.openai.com) — berbayar
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
| `AI_PROVIDER` | Ya | `groq` | `groq` atau `openai` |
| `GROQ_API_KEY` | Jika Groq | — | API key Groq |
| `GROQ_MODEL` | — | `llama-3.3-70b-versatile` | Model Groq |
| `OPENAI_API_KEY` | Jika OpenAI | — | API key OpenAI |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Model OpenAI |
| `SYSTEM_PROMPT` | — | (built-in) | Personality AI |
| `MAX_HISTORY` | — | `30` | Jumlah pesan terakhir yang dipakai sebagai context |
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
