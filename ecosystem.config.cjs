// PM2 ecosystem — démarrage en production sur le VPS
// Usage : pnpm install && pnpm build && pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'eba-coffee-shop',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
