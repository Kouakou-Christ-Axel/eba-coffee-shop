import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';
import { isStaging } from '@/lib/app-env';

const baseUrl = siteUrl();

export default function robots(): MetadataRoute.Robots {
  // Staging : rien à indexer.
  if (isStaging()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
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
