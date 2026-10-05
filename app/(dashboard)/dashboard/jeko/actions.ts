'use server';

import { revalidatePath } from 'next/cache';
import { requireFinance } from '@/lib/auth-helpers';
import { deleteJekoWithdrawal, recordJekoWithdrawal } from '@/lib/jeko/ledger';

type ActionResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  await requireFinance();
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

export const recordWithdrawalAction = (input: unknown) =>
  run(() => recordJekoWithdrawal(input));

export const deleteWithdrawalAction = (id: string) =>
  run(() => deleteJekoWithdrawal(id));
