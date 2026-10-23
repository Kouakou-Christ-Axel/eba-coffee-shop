'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireFinance } from '@/lib/auth-helpers';
import { JEKO_ACCOUNTS } from '@/lib/jeko/accounts';
import { setActiveJekoAccount } from '@/lib/jeko/active-account';
import { deleteJekoWithdrawal, recordJekoWithdrawal } from '@/lib/jeko/ledger';
import { z } from 'zod';

type ActionResult = { ok: true } | { ok: false; error: string };

async function run(
  guard: () => Promise<unknown>,
  fn: () => Promise<unknown>
): Promise<ActionResult> {
  await guard();
  try {
    await fn();
    revalidatePath('/dashboard/jeko');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

export async function recordWithdrawalAction(input: unknown) {
  return run(requireFinance, () => recordJekoWithdrawal(input));
}

export async function deleteWithdrawalAction(id: string) {
  return run(requireFinance, () => deleteJekoWithdrawal(id));
}

/** Change le compte qui encaisse les NOUVEAUX paiements (admin seulement). */
export async function setActiveAccountAction(account: unknown) {
  return run(requireAdmin, async () =>
    setActiveJekoAccount(z.enum(JEKO_ACCOUNTS).parse(account))
  );
}
