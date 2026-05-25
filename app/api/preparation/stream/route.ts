// app/api/preparation/stream/route.ts
//
// Endpoint Server-Sent Events pour l'écran cuisine (KDS) /dashboard/preparation.
//
// Modèle : le client maintient une connexion ouverte (`EventSource`). Côté serveur,
// on s'abonne au notifier Postgres (alimenté par `LISTEN orders_changed` côté
// Postgres via `lib/postgres-notify.ts`). Sur chaque notification, on re-requête
// la file et on pousse un event `queue` au client. Un debounce ~150 ms coalesce
// les rafales.
//
// Auth : par cookie. `EventSource` ne peut pas envoyer de header personnalisé,
// mais Better Auth est cookie-based et la route est same-origin, donc le cookie
// de session est attaché automatiquement par le navigateur.
//
// Persistance : suppose un déploiement Node persistant (le singleton `pg.Client`
// dans `lib/postgres-notify.ts` ne tient pas en serverless).

import { auth } from '@/lib/auth';
import {
  fetchPreparationQueue,
  type PreparationOrder,
} from '@/lib/preparation-queue';
import { subscribeOrders } from '@/lib/postgres-notify';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_INTERVAL_MS = 20_000;
const DEBOUNCE_MS = 150;

// Types sérialisables : Date → string ISO (ou null) pour traverser JSON.
type SerializedOrder = Omit<PreparationOrder, 'pickupTime' | 'createdAt'> & {
  pickupTime: string | null;
  createdAt: string;
};

function serializeQueue(orders: PreparationOrder[]): SerializedOrder[] {
  return orders.map((o) => ({
    ...o,
    pickupTime: o.pickupTime ? o.pickupTime.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user.role as UserRole | undefined;
  if (!session || !role || !ROLE_GROUPS.KITCHEN_PLUS.includes(role)) {
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
          // controller fermé entre temps : ignorer
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const pushSnapshot = async () => {
        try {
          const fresh = await fetchPreparationQueue();
          sendEvent('queue', serializeQueue(fresh));
        } catch (err) {
          console.error('[SSE preparation] fetch échoué :', err);
        }
      };

      // Coalesce les rafales : si plusieurs notifications arrivent en <150 ms,
      // on ne re-fetch et ne push qu'une seule fois avec l'état final.
      const onChange = () => {
        if (closed) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          void pushSnapshot();
        }, DEBOUNCE_MS);
      };

      // ── 1. Snapshot immédiat à la connexion ──────────────────────────────────
      await pushSnapshot();

      // ── 2. Souscription LISTEN/NOTIFY via le singleton ──────────────────────
      unsubscribe = subscribeOrders(onChange);

      // ── 3. Heartbeat (commentaire SSE) anti-buffering ───────────────────────
      heartbeatTimer = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_INTERVAL_MS);

      // ── 4. Cleanup à la déconnexion client ──────────────────────────────────
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
      // Appelé quand le consommateur du flux annule (ex. EventSource côté client
      // ferme la connexion). On nettoie tout, y compris l'unsubscribe LISTEN.
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
