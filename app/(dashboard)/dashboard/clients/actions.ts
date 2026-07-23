'use server';

import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth-helpers';
import {
  createCustomer,
  mergeCustomers,
  updateCustomer,
} from '@/lib/customer-mutations';
import { awardMissedOrderStamps } from '@/lib/loyalty-mutations';
import {
  MISSED_ORDER_STAMPS_MAX,
  MISSED_ORDER_STAMPS_NOTE_MAX,
} from '@/config/constants';

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

type StampsActionResult =
  | { ok: true; stampCount: number; rewardsCreated: number }
  | { ok: false; error: string };

type MergeActionResult =
  | {
      ok: true;
      ordersMoved: number;
      rewardsMoved: number;
      pollVotesMoved: number;
      stampsMerged: number;
    }
  | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await requireManager();
  return session.user.id;
}

function revalidate(id?: string) {
  revalidatePath('/dashboard/clients');
  if (id) revalidatePath(`/dashboard/clients/${id}`);
}

export async function createCustomerAction(input: {
  name?: string | null;
  phone: string;
}): Promise<ActionResult> {
  await requireAdminId();
  try {
    const customer = await createCustomer(input);
    revalidate(customer.id);
    return { ok: true, id: customer.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

export async function updateCustomerAction(
  id: string,
  input: { name?: string | null; phone?: string }
): Promise<ActionResult> {
  await requireAdminId();
  try {
    const customer = await updateCustomer(id, input);
    revalidate(customer.id);
    return { ok: true, id: customer.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

/**
 * Fusionne `sourceId` (doublon) dans `targetId` : `targetId` est conservé
 * (numéro, historique et fidélité cumulés), `sourceId` est supprimé.
 */
export async function mergeCustomersAction(
  sourceId: string,
  targetId: string
): Promise<MergeActionResult> {
  const actorId = await requireAdminId();
  try {
    const result = await mergeCustomers({ sourceId, targetId }, actorId);
    revalidate(targetId);
    return {
      ok: true,
      ordersMoved: result.ordersMoved,
      rewardsMoved: result.rewardsMoved,
      pollVotesMoved: result.pollVotesMoved,
      stampsMerged: result.stampsMerged,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

export async function addMissedOrderStampsAction(
  customerId: string,
  count: number,
  note?: string
): Promise<StampsActionResult> {
  const actorId = await requireAdminId();

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MISSED_ORDER_STAMPS_MAX
  ) {
    return {
      ok: false,
      error: `Le nombre de commandes doit être entre 1 et ${MISSED_ORDER_STAMPS_MAX}.`,
    };
  }
  const trimmedNote = note?.trim() || undefined;
  if (trimmedNote && trimmedNote.length > MISSED_ORDER_STAMPS_NOTE_MAX) {
    return {
      ok: false,
      error: `La note dépasse ${MISSED_ORDER_STAMPS_NOTE_MAX} caractères.`,
    };
  }

  try {
    const { stampCount, rewardsCreated } = await awardMissedOrderStamps(
      customerId,
      count,
      trimmedNote,
      actorId
    );
    revalidate(customerId);
    return { ok: true, stampCount, rewardsCreated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}
