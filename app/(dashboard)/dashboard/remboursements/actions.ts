'use server';

import { revalidatePath } from 'next/cache';
import { requireRefundsView } from '@/lib/auth-helpers';
import { convertCreditToRefund } from '@/lib/refunds/convert-credit';
import { createRefund } from '@/lib/refunds/create';
import {
  approveRefund,
  cancelRefund,
  markRefundPaidManually,
  rejectRefund,
  resolveUncertainRefund,
  retryRefund,
  updateRefundDestination,
} from '@/lib/refunds/transitions';
import { setOrderStatus } from '@/lib/order-mutations';
import type { RefundActor } from '@/lib/refunds/errors';

export type RefundActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// Next redacte le message de toute erreur qui traverse une Server Action : on
// renvoie `{ ok:false, error }` pour que le staff voie la vraie raison d'un refus
// (rôle, plafond dépassé, conflit entre deux personnes…).
async function run(
  fn: (actor: RefundActor) => Promise<string | void>,
  orderId?: string
): Promise<RefundActionResult> {
  try {
    const session = await requireRefundsView();
    const message = await fn({
      id: session.user.id,
      role: session.user.role,
    });
    revalidatePath('/dashboard/remboursements');
    revalidatePath('/dashboard/statistiques');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/cloture');
    revalidatePath('/dashboard/jeko');
    revalidatePath('/dashboard/commandes');
    if (orderId) revalidatePath(`/dashboard/commandes/${orderId}`);
    return { ok: true, message: message ?? undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

/** Texte renvoyé à l'écran après un envoi Jèko. */
function sentMessage(sent: string | null): string | undefined {
  switch (sent) {
    case 'paid':
      return 'Remboursement envoyé.';
    case 'processing':
      return 'Transfert lancé : en attente de la réponse de Jèko.';
    case 'failed':
      return 'Le transfert a échoué : voir le détail pour corriger.';
    case 'uncertain':
      return 'On ignore si le transfert est parti : à vérifier chez Jèko.';
    default:
      return undefined;
  }
}

export async function requestRefundAction(
  input: unknown,
  opts: { approveNow?: boolean; cancelOrder?: boolean } = {}
): Promise<RefundActionResult> {
  const orderId = (input as { orderId?: string } | null)?.orderId;
  return run(async (actor) => {
    const refund = await createRefund(input, actor);
    if (opts.cancelOrder && orderId) {
      await setOrderStatus(orderId, 'CANCELLED', actor.role);
    }
    // Raccourci admin « Demander et approuver ».
    if (opts.approveNow) {
      const { sent } = await approveRefund(refund.id, actor);
      return sentMessage(sent) ?? 'Remboursement validé.';
    }
    return 'Demande envoyée : un administrateur doit la valider.';
  }, orderId);
}

export async function approveRefundAction(
  id: string
): Promise<RefundActionResult> {
  return run(async (actor) =>
    sentMessage((await approveRefund(id, actor)).sent)
  );
}

export async function retryRefundAction(
  id: string
): Promise<RefundActionResult> {
  return run(async (actor) => sentMessage((await retryRefund(id, actor)).sent));
}

export async function rejectRefundAction(
  id: string,
  note?: string
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await rejectRefund({ id, note }, actor);
  });
}

export async function cancelRefundAction(
  id: string
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await cancelRefund({ id }, actor);
  });
}

export async function updateRefundDestinationAction(
  input: unknown
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await updateRefundDestination(input, actor);
    return 'Corrigé : un administrateur doit revalider avant l’envoi.';
  });
}

export async function markRefundPaidAction(
  id: string,
  note?: string
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await markRefundPaidManually({ id, note }, actor);
  });
}

export async function resolveUncertainRefundAction(
  id: string,
  outcome: 'SENT' | 'NOT_SENT',
  note?: string
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await resolveUncertainRefund({ id, outcome, note }, actor);
  });
}

/** Convertit (une part d')un avoir en argent : nouvelle demande, validée par un admin. */
export async function convertCreditAction(
  input: unknown
): Promise<RefundActionResult> {
  return run(async (actor) => {
    await convertCreditToRefund(input, actor);
    return 'Demande envoyée : un administrateur doit la valider.';
  });
}
