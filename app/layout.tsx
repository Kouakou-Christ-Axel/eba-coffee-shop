import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import { ENV } from 'varlock/env';
import { homeJsonLd } from '@/lib/json-ld';

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
  openGraph: {
    title: 'EBA Coffee Shop à Abidjan',
    description:
      'Un coffee shop chaleureux à Abidjan pour savourer café, brunch, pâtisseries et moments de détente.',
    url: '/',
    images: [
      {
        url: '/og/home-coffee.jpg',
        width: 1200,
        height: 630,
        alt: 'EBA Coffee Shop à Abidjan',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EBA Coffee Shop à Abidjan',
    description:
      'Café, brunch, boissons signatures et ambiance cosy chez EBA Coffee Shop.',
    images: ['/og/home-coffee.jpg'],
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
    title: 'EBA',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
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
