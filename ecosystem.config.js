/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: 'eba-coffee-shop',
      script: 'pnpm',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
