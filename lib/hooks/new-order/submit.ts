import { readApiError } from '@/lib/api-error';
import type { ShortageLine } from '@/lib/orders/shortage';

type SubmitHandlers = {
  onCreated: (dailyNumber: number | null) => void;
  onShortage: (lines: ShortageLine[]) => void;
  onError: (message: string) => void;
};

/** POST /api/caisse/orders puis dispatch du résultat vers les callbacks. */
export async function submitNewOrder(
  payload: Record<string, unknown>,
  { onCreated, onShortage, onError }: SubmitHandlers
): Promise<void> {
  try {
    const res = await fetch('/api/caisse/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          shortage?: ShortageLine[];
        } | null;
        if (data?.shortage?.length) {
          onShortage(data.shortage);
          return;
        }
        onError(data?.error ?? `Erreur ${res.status}`);
        return;
      }
      onError(await readApiError(res));
      return;
    }
    // Le n° du jour sert à la confirmation « Commande #012 créée » de la file.
    let createdNumber: number | null = null;
    try {
      const data = (await res.json()) as { dailyNumber?: number };
      if (typeof data.dailyNumber === 'number')
        createdNumber = data.dailyNumber;
    } catch {
      // Confirmation best-effort : une réponse illisible ne transforme pas le succès en erreur.
    }
    onCreated(createdNumber);
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Erreur réseau');
  }
}
