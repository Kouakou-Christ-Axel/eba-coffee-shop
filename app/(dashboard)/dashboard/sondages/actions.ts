'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import * as polls from '@/lib/poll-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
  return session.user.id;
}

function revalidate(pollId?: string) {
  revalidatePath('/dashboard/sondages');
  if (pollId) revalidatePath(`/dashboard/sondages/${pollId}`);
}

async function run(
  fn: () => Promise<unknown>,
  pollId?: string
): Promise<ActionResult> {
  try {
    await fn();
    revalidate(pollId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

// ── Sondage ──

export async function createPollAction(input: unknown): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(() => polls.createPoll(input, userId));
}

export async function updatePollAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.updatePoll(id, input), id);
}

export async function setPollStatusAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.setPollStatus(id, input), id);
}

export async function deletePollAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.deletePoll(id));
}

// ── Options ──

export async function createPollOptionAction(
  pollId: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.createPollOption(pollId, input), pollId);
}

export async function updatePollOptionAction(
  id: string,
  pollId: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.updatePollOption(id, input), pollId);
}

export async function movePollOptionAction(
  id: string,
  pollId: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.movePollOption(id, direction), pollId);
}

export async function deletePollOptionAction(
  id: string,
  pollId: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => polls.deletePollOption(id), pollId);
}

// ── Suggestions ──

export async function moderatePollSuggestionAction(
  id: string,
  pollId: string,
  input: unknown
): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(
    () => polls.moderatePollSuggestion(id, input, userId),
    pollId
  );
}
