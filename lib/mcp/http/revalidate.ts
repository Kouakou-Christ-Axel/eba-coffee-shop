import { revalidatePath } from 'next/cache';

/** Même invalidation que les server actions de `dashboard/menu/actions.ts`. */
export function revalidateMenu() {
  try {
    revalidatePath('/api/menu');
    revalidatePath('/carte');
    revalidatePath('/');
    revalidatePath('/dashboard/inventaire');
  } catch (err) {
    // Hors contexte de requête Next : l'écriture a eu lieu, on ne fait pas échouer l'appel.
    console.warn('[mcp] revalidateMenu a échoué', err);
  }
}
