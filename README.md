# Telegram AI Agent

AI Agent berbasis Node.js yang terintegrasi dengan Telegram, mendukung **Groq** (gratis & cepat) dan **OpenAI**. Dirancang untuk deploy mudah di VPS.

## Fitur

- Chat AI langsung dari Telegram
- Mendukung 2 provider: Groq (gratis) & OpenAI
- Memori percakapan per user (context-aware)
- Commands: `/start`, `/reset`, `/stats`, `/help`
- Akses kontrol via whitelist user ID (opsional)
- Siap deploy di VPS dengan PM2 atau systemd
- Pesan panjang otomatis di-split (Telegram 4096 char limit)
- Typing indicator saat AI memproses

## Arsitektur

```
src/
  index.js         # Entry point & Telegram handler
  config.js        # Load env variables
  ai-provider.js   # Abstraksi Groq / OpenAI
  conversation.js  # Manager riwayat percakapan per user
```

## Prasyarat

- Node.js >= 18
- Token Telegram Bot dari [@BotFather](https://t.me/BotFather)
- API Key salah satu:
  - [Groq](https://console.groq.com) — gratis
  - [OpenAI](https://platform.openai.com) — berbayar

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

---

## Deploy ke VPS

### 1. Persiapan VPS

SSH ke VPS kamu, lalu install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
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

---

## Konfigurasi `.env`

| Variabel | Wajib | Deskripsi |
|----------|-------|-----------|
| `TELEGRAM_BOT_TOKEN` | Ya | Token dari @BotFather |
| `AI_PROVIDER` | Ya | `groq` atau `openai` |
| `GROQ_API_KEY` | Jika pakai Groq | API key Groq |
| `GROQ_MODEL` | Tidak | Default: `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Jika pakai OpenAI | API key OpenAI |
| `OPENAI_MODEL` | Tidak | Default: `gpt-4o-mini` |
| `SYSTEM_PROMPT` | Tidak | Personality AI |
| `MAX_HISTORY` | Tidak | Default: 20 pesan |
| `ALLOWED_USERS` | Tidak | Comma-separated user IDs. Kosong = public |

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

## Keamanan

- **JANGAN** commit file `.env` ke git (sudah di-ignore)
- Gunakan `ALLOWED_USERS` jika bot bersifat privat
- Rotate API key secara berkala
- Batasi firewall VPS hanya pada port yang diperlukan

## Troubleshooting

**Bot tidak merespon?**
- Cek log: `pm2 logs telegram-ai-agent`
- Pastikan token benar & bot tidak conflict dengan instance lain
- Jika ada 2 bot memakai token sama → hanya 1 yang bisa polling

**Error "AI Error: ..."?**
- Cek API key valid
- Cek quota/credit provider
- Cek koneksi internet VPS

## Lisensi

MIT
