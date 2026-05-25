// app/api/caisse/stream/route.ts
//
// Endpoint Server-Sent Events pour l'écran caisse /dashboard/caisse.
//
// Réplique du pattern /api/preparation/stream : auth cookie-based, snapshot
// initial, souscription LISTEN/NOTIFY via le singleton lib/postgres-notify,
// debounce 150 ms, heartbeat 20 s, cleanup propre.

import { auth } from '@/lib/auth';
import { fetchCashierQueue, type CashierOrder } from '@/lib/cashier-queue';
import { subscribeOrders } from '@/lib/postgres-notify';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_INTERVAL_MS = 20_000;
const DEBOUNCE_MS = 150;

// Types sérialisables : Date → string ISO (ou null) pour traverser JSON.
type SerializedCashierOrder = Omit<CashierOrder, 'pickupTime' | 'createdAt'> & {
  pickupTime: string | null;
  createdAt: string;
};

function serialize(orders: CashierOrder[]): SerializedCashierOrder[] {
  return orders.map((o) => ({
    ...o,
    pickupTime: o.pickupTime ? o.pickupTime.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user.role as UserRole | undefined;
  if (!session || !role || !ROLE_GROUPS.CASHIER_PLUS.includes(role)) {
    return new Response('Non autorisé', { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
    unsubscribe = undefined;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // controller fermé : ignorer
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const pushSnapshot = async () => {
        try {
          const fresh = await fetchCashierQueue();
          sendEvent('queue', serialize(fresh));
        } catch (err) {
          console.error('[SSE caisse] fetch échoué :', err);
        }
      };

      const onChange = () => {
        if (closed) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          void pushSnapshot();
        }, DEBOUNCE_MS);
      };

      // 1. Snapshot initial
      await pushSnapshot();

      // 2. Souscription LISTEN/NOTIFY
      unsubscribe = subscribeOrders(onChange);

      // 3. Heartbeat anti-buffering
      heartbeatTimer = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_INTERVAL_MS);

      // 4. Cleanup à la déconnexion
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
