// PM2 configuration untuk VPS
// Jalankan: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'telegram-ai-agent',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
