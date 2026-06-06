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
// - Images : `'self'` pour les uploads locaux (`/uploads/products/*` depuis la
//   migration VPS), plus le legacy `*.public.blob.vercel-storage.com` qui
//   reste autorisé dans `images.remotePatterns` pour compat.
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
  ],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://cloudflareinsights.com',
    ...(isProduction ? [] : ['ws:', 'wss:']),
  ],
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
  allowedDevOrigins: ['eba.otw.ci'],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
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
};

export default varlockNextConfigPlugin()(nextConfig);
