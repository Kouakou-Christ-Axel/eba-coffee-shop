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
        PORT: 3001,
        // Fuseau du runtime aligné sur le fuseau métier (Abidjan = UTC+0,
        // pas de DST). Sans cela, le serveur tourne dans SON fuseau et tout
        // code qui touche à l'heure locale dérive : `new Date('…T17:31:00')`
        // (chaîne ISO sans fuseau) était décalé de +2h, faisant passer une
        // preuve de paiement postérieure à la commande pour un paiement
        // recyclé (cf. lib/ai/payment-proof-rules.ts), et
        // `generatePickupSlots` (lib/pickup-slots.ts) construit ses créneaux
        // avec `setHours()`, donc un créneau réglé sur 09h00 sortait à 07h00
        // Abidjan. Les helpers de lib/timezone.ts sont explicitement ancrés
        // sur Abidjan ; cette variable met le reste du code au même niveau.
        TZ: 'UTC',
      },
    },
  ],
};
