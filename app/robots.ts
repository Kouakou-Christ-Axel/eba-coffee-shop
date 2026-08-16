import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

const baseUrl = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/login',
        '/carte/commande',
        '/commande/',
        '/mes-commandes',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
