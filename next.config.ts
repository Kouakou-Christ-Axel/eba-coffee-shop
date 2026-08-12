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
// - TikTok : seul `frame-src` est nécessaire. On construit nous-mêmes l'iframe
//   `www.tiktok.com/embed/v2/...` au clic (cf. tiktok-embed.tsx) au lieu de
//   charger le script `embed.js` — plus aucun JS ni image TikTok sur NOTRE
//   page (les miniatures sont rapatriées en local, cf. lib/uploads.ts), donc
//   `script-src`/`img-src` n'ont plus à whitelister TikTok. Ce que l'iframe
//   charge en interne relève de la CSP de tiktok.com, pas de la nôtre.
// - Google Tag Manager (site public uniquement, cf. app/(public)/layout.tsx) :
//   `googletagmanager.com` sert gtm.js ET gtag/js ; GA4 collecte sur
//   `google-analytics.com` (+ sous-domaines régionaux `*.analytics.google.com`)
//   et pose des pixels de repli sur `img-src`. Le script d'amorçage Consent
//   Mode est inline — déjà couvert par `'unsafe-inline'` ci-dessus.
//   ⚠️ ATTENTION EXPLOITANT : cette CSP borne aussi ce que le conteneur GTM a le
//   droit de charger. Ajouter un tag tiers depuis l'interface web de GTM (Meta
//   Pixel, Google Ads, TikTok Pixel…) ne suffira PAS : son domaine doit être
//   ajouté ici, puis l'app redéployée, sinon le navigateur le bloque.
const cspDirectives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://static.cloudflareinsights.com',
    'https://www.googletagmanager.com',
    ...(isProduction ? [] : ["'unsafe-eval'"]),
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.public.blob.vercel-storage.com',
    'https://res.cloudinary.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
  ],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://cloudflareinsights.com',
    'https://api.cloudinary.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    ...(isProduction ? [] : ['ws:', 'wss:']),
  ],
  'frame-src': [
    'https://www.google.com',
    'https://www.tiktok.com',
    // Mode Aperçu de GTM (Tag Assistant) — hors production uniquement.
    ...(isProduction ? [] : ['https://tagassistant.google.com']),
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
};

export default varlockNextConfigPlugin()(nextConfig);
