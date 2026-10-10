import type { OrderStatus } from '@/generated/prisma/client';
import type { ShortageLine } from '@/lib/orders/shortage';

export async function callApi<T = unknown>(
  url: string,
  method: 'PATCH' | 'POST',
  body: unknown
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; shortage?: ShortageLine[] }
> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    // Une 409 de pénurie porte aussi la liste chiffrée des manques (`buildShortagePayload`).
    let shortage: ShortageLine[] | undefined;
    try {
      const data = (await res.json()) as {
        error?: string;
        shortage?: ShortageLine[];
      };
      if (typeof data.error === 'string') msg = data.error;
      if (Array.isArray(data.shortage)) shortage = data.shortage;
    } catch {
      // ignore
    }
    return { ok: false, error: msg, shortage };
  }
  const data = (await res.json()) as T;
  return { ok: true, data };
}

/** Message du toast d'annulation pour une transition de statut ; `null` pour NEW (jamais une cible depuis la caisse). */
export function undoableStatusMessage(
  newStatus: OrderStatus,
  wasPaid: boolean,
  orderRef: string
): string | null {
  switch (newStatus) {
    case 'PREPARING':
      return `Commande ${orderRef} envoyée en cuisine`;
    case 'READY':
      return `Commande ${orderRef} marquée prête`;
    case 'COMPLETED':
      return `Commande ${orderRef} marquée récupérée`;
    case 'CANCELLED':
      return wasPaid
        ? `Commande ${orderRef} remboursée`
        : `Commande ${orderRef} annulée`;
    default:
      return null;
  }
}
