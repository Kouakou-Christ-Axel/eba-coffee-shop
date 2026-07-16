import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import { ENV } from 'varlock/env';
import { buildHomeJsonLd } from '@/lib/json-ld';
import { getContactSettings } from '@/lib/contact-settings-db';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
});

export const metadata: Metadata = {
  metadataBase: new URL(ENV.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'EBA Coffee shop à Abidjan | Café, brunch et douceurs',
    template: '%s | EBA Coffee Shop',
  },
  description:
    'Découvrez EBA Coffee Shop à Abidjan : cafés, boissons signatures, pâtisseries, brunch et ambiance chaleureuse pour vos pauses gourmandes.',
  alternates: {
    canonical: '/',
  },
  // TODO: remplacer par un visuel OG dédié 1200x630 (ce placeholder est une
  // photo hero existante, réutilisée en attendant un vrai shooting).
  openGraph: {
    title: 'EBA Coffee Shop à Abidjan',
    description:
      'Un coffee shop chaleureux à Abidjan pour savourer café, brunch, pâtisseries et moments de détente.',
    url: '/',
    images: [
      {
        url: '/assets/examples/accueil/eba-hero.webp',
        width: 800,
        height: 449,
        alt: 'EBA Coffee Shop à Abidjan',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EBA Coffee Shop à Abidjan',
    description:
      'Café, brunch, boissons signatures et ambiance cosy chez EBA Coffee Shop.',
    images: ['/assets/examples/accueil/eba-hero.webp'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon1.png', type: 'image/png' },
      { url: '/icon0.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'EBA',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6c3077' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1218' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const contact = await getContactSettings();
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildHomeJsonLd(contact)),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
