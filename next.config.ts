import { setDefaultResultOrder } from 'node:dns';
import type { NextConfig } from 'next';
import { varlockNextConfigPlugin } from '@varlock/nextjs-integration/plugin';

setDefaultResultOrder('ipv4first');

const isProduction = process.env.NODE_ENV === 'production';

// ─── Content Security Policy ─────────────────────────────────────────────────
//
// Politique minimale qui couvre les besoins actuels de l'app :
// - Next.js injecte des scripts inline pour l'hydration → `'unsafe-inline'`
//   reste indispensable sans nonce-strategy (qu'on n'a pas câblée ici).
// - Tailwind v4 + HeroUI injectent des styles inline → idem pour `style-src`.
// - Images : `'self'` pour les uploads locaux (`/uploads/products/*`, repli
//   legacy), plus `*.public.blob.vercel-storage.com` (legacy Vercel Blob) et
//   `res.cloudinary.com` (nouveaux uploads, cf. lib/cloudinary.ts).
// - `connect-src` autorise `api.cloudinary.com` : l'upload signé part
//   directement du navigateur vers Cloudinary, sans passer par notre serveur.
// - En dev, Next ouvre une websocket pour le HMR → on élargit `connect-src`.
const cspDirectives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://static.cloudflareinsights.com',
    ...(isProduction ? [] : ["'unsafe-eval'"]),
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.public.blob.vercel-storage.com',
    'https://res.cloudinary.com',
  ],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://cloudflareinsights.com',
    'https://api.cloudinary.com',
    ...(isProduction ? [] : ['ws:', 'wss:']),
  ],
  'frame-src': ['https://www.google.com'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
};

const cspHeaderValue = Object.entries(cspDirectives)
  .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
  .join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: cspHeaderValue },
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // `eba.otw.ci` : ancien domaine, conservé pendant la transition vers
  // `eba-coffee.com` (cf. la redirection dans `redirects()` ci-dessous).
  allowedDevOrigins: ['eba.otw.ci', 'eba-coffee.com'],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Migration de domaine `eba.otw.ci` → `eba-coffee.com` : tant que le DNS/
  // nginx de l'ancien domaine continue de router vers cette même app, on
  // redirige tout son trafic vers le nouveau — limite la casse pour les PWA
  // déjà installées (favoris, SEO) pendant la transition. `/sw.js` est
  // EXCLU : un navigateur rejette une réponse redirigée pour le script de
  // service worker lors de ses vérifications de mise à jour périodiques, ce
  // qui casserait le SW déjà enregistré sur les installations existantes —
  // or il doit continuer de tourner en tâche de fond (notifications push)
  // pendant la transition.
  async redirects() {
    return [
      {
        source: '/:path((?!sw\\.js$).*)',
        has: [{ type: 'host', value: 'eba.otw.ci' }],
        destination: 'https://eba-coffee.com/:path',
        permanent: true,
      },
    ];
  },
};

export default varlockNextConfigPlugin()(nextConfig);
