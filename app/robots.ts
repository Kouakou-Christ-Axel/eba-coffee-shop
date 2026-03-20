import type { MetadataRoute } from 'next';
import { ENV } from 'varlock/env';

const baseUrl = ENV.NEXT_PUBLIC_SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/dashboard/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
