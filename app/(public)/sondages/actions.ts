'use server';

import { headers } from 'next/headers';
import { castVote, submitPollSuggestion } from '@/lib/poll-mutations';
import { hasVoted } from '@/lib/polls';
import { allowPollAction } from '@/lib/poll-rate-limit';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requestMeta() {
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() ?? null;
  const userAgent = h.get('user-agent');
  return { ipAddress, userAgent };
}

export async function castVoteAction(
  pollId: string,
  input: unknown
): Promise<ActionResult> {
  const { ipAddress, userAgent } = await requestMeta();
  if (!allowPollAction(`vote:${ipAddress ?? 'unknown'}:${pollId}`)) {
    return { ok: false, error: 'Trop de tentatives, réessaie dans une minute.' };
  }
  try {
    await castVote(pollId, input, { ipAddress, userAgent });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

/** Pré-sélectionne le choix courant du votant (par token anonyme) au
 * chargement de la page — permet de revoter sans redécouvrir son ancien
 * choix. */
export async function getMyVoteAction(
  pollId: string,
  voterToken: string
): Promise<{ optionId: string | null }> {
  const vote = await hasVoted({ pollId, voterToken });
  return { optionId: vote?.optionId ?? null };
}

type SubmitSuggestionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitPollSuggestionAction(
  pollId: string,
  input: unknown
): Promise<SubmitSuggestionResult> {
  const { ipAddress } = await requestMeta();
  if (!allowPollAction(`suggest:${ipAddress ?? 'unknown'}:${pollId}`)) {
    return { ok: false, error: 'Trop de tentatives, réessaie dans une minute.' };
  }
  try {
    const suggestion = await submitPollSuggestion(pollId, input);
    return { ok: true, id: suggestion.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}
