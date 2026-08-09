// lib/tiktok.ts
//
// Lecture des vidéos TikTok embarquées (section "Suivez l'aventure" de
// l'accueil). Écriture dans lib/tiktok-mutations.ts.

import { cache } from 'react';
import prisma from '@/lib/prisma';
import { TIKTOK_HOME_DISPLAY_MAX } from '@/config/constants';

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function getTiktokVideosAdmin() {
  return prisma.tiktokVideo.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTiktokVideoAdmin(id: string) {
  return prisma.tiktokVideo.findUnique({ where: { id } });
}

// ─── Public ─────────────────────────────────────────────────────────────────

// `cache()` déduplique l'appel si plusieurs sections de la même page publique
// avaient besoin de la liste (pattern `getPublicPoll`).
export const listPublicTiktokVideos = cache(async () => {
  return prisma.tiktokVideo.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    take: TIKTOK_HOME_DISPLAY_MAX,
    select: {
      id: true,
      url: true,
      videoId: true,
      caption: true,
      oembedTitle: true,
      authorName: true,
      thumbnailUrl: true,
    },
  });
});

export type PublicTiktokVideo = Awaited<
  ReturnType<typeof listPublicTiktokVideos>
>[number];
