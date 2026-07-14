import type { MetadataRoute } from 'next';
import { ENV } from 'varlock/env';
import { listPublicPolls } from '@/lib/polls';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;

// Le sitemap est peu volatile (pages statiques + sondages ouverts) : 1h de
// cache limite la charge DB tout en gardant les nouveaux sondages visibles
// rapidement pour les crawlers.
export const revalidate = 3600;

function staticEntries(now: Date): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: now,
      priority: 1,
    },
    {
      url: `${siteUrl}/a-propos`,
      lastModified: now,
      priority: 0.7,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/le-lieu`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/carte`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/sondages`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries = staticEntries(now);

  try {
    const openPolls = await listPublicPolls({ status: 'OPEN' });
    const pollEntries: MetadataRoute.Sitemap = openPolls.map((poll) => ({
      url: `${siteUrl}/sondages/${poll.id}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.5,
    }));
    return [...entries, ...pollEntries];
  } catch (error) {
    // DB indisponible au build (ex. génération statique hors ligne) :
    // on retombe sur les pages statiques plutôt que de faire échouer le build.
    console.error(
      '[sitemap] listPublicPolls a échoué, fallback statique',
      error
    );
    return entries;
  }
}
