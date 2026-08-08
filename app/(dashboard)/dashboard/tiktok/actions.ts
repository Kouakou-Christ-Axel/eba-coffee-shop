'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth-helpers';
import * as tiktokVideos from '@/lib/tiktok-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await requireManager();
  return session.user.id;
}

function revalidate() {
  revalidatePath('/dashboard/tiktok');
  // Section "Suivez l'aventure" de l'accueil (page ISR, cf.
  // app/(public)/page.tsx) — sans cette invalidation explicite, une mutation
  // admin resterait invisible jusqu'à expiration du cache.
  revalidatePath('/');
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidate();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

export async function createTiktokVideoAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(() => tiktokVideos.createTiktokVideo(input, userId));
}

export async function updateTiktokVideoAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => tiktokVideos.updateTiktokVideo(id, input));
}

export async function moveTiktokVideoAction(
  id: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => tiktokVideos.moveTiktokVideo(id, direction));
}

export async function deleteTiktokVideoAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => tiktokVideos.deleteTiktokVideo(id));
}
