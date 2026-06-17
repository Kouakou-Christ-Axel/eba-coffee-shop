'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import { createCustomer, updateCustomer } from '@/lib/customer-mutations';

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
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
