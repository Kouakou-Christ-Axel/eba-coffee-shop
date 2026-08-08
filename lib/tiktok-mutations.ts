// lib/tiktok-mutations.ts
//
// Écriture pour les vidéos TikTok embarquées (section "Suivez l'aventure" de
// l'accueil). Lecture dans lib/tiktok.ts.

import prisma from '@/lib/prisma';
import {
  tiktokVideoInputSchema,
  tiktokVideoUpdateSchema,
  extractTiktokVideoId,
} from '@/lib/schemas/tiktok';

export async function createTiktokVideo(input: unknown, createdById?: string) {
  const data = tiktokVideoInputSchema.parse(input);
  const videoId = extractTiktokVideoId(data.url);
  if (!videoId) throw new Error('URL TikTok invalide');

  const existing = await prisma.tiktokVideo.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  return prisma.tiktokVideo.create({
    data: {
      url: data.url,
      videoId,
      caption: data.caption ?? null,
      isActive: data.isActive,
      sortOrder: existing.length,
      createdById: createdById ?? null,
    },
  });
}

export async function updateTiktokVideo(id: string, input: unknown) {
  const data = tiktokVideoUpdateSchema.parse(input);
  const existing = await prisma.tiktokVideo.findUnique({ where: { id } });
  if (!existing) throw new Error('Vidéo introuvable');

  let videoId: string | undefined;
  if (data.url !== undefined) {
    const extracted = extractTiktokVideoId(data.url);
    if (!extracted) throw new Error('URL TikTok invalide');
    videoId = extracted;
  }

  return prisma.tiktokVideo.update({
    where: { id },
    data: {
      ...(data.url !== undefined && { url: data.url, videoId }),
      ...(data.caption !== undefined && { caption: data.caption }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// Soft delete pour rester cohérent avec PollOption (traçabilité).
export async function deleteTiktokVideo(id: string) {
  const existing = await prisma.tiktokVideo.findUnique({ where: { id } });
  if (!existing) throw new Error('Vidéo introuvable');
  return prisma.tiktokVideo.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Réordonne une vidéo d'un cran (haut/bas). Copie de `movePollOption`
// (lib/poll-mutations.ts), sans scope parent (liste plate).
export async function moveTiktokVideo(id: string, direction: 'up' | 'down') {
  const all = await prisma.tiktokVideo.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error('Vidéo introuvable');

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.tiktokVideo.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.tiktokVideo.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}
