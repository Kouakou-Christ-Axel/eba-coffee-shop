// lib/postgres-notify.ts
//
// Singleton `pg.Client` dédié à `LISTEN orders_changed`, partagé entre toutes les
// connexions SSE via un `EventEmitter` mémoire. Une seule connexion Postgres,
// fanout en process.
//
// Suppose un déploiement Node persistant (Docker, VPS, Coolify…). Ne fonctionne
// pas correctement en serverless (chaque fonction est un process distinct, le
// singleton ne tient pas).
//
// Démarrage lazy : la connexion Postgres ne s'ouvre PAS au module-load — sinon
// `next build` tenterait de joindre la DB en phase d'analyse. La connexion s'ouvre
// à la première souscription (premier client SSE qui appelle `subscribeOrders`).
//
// Reconnexion : si la connexion meurt (Postgres redémarre, réseau, etc.), la
// boucle `startListener` rouvre au bout de 3 s.

import { Client } from 'pg';
import { EventEmitter } from 'node:events';

const CHANNEL = 'orders_changed';
const RECONNECT_DELAY_MS = 3_000;

const g = global as unknown as {
  ordersNotifier?: EventEmitter;
  ordersListenerStarted?: boolean;
  ordersGeneration?: { value: number };
};

const notifier = g.ordersNotifier ?? new EventEmitter();
// Chaque écran KDS connecté = 1 listener sur cet emitter.
notifier.setMaxListeners(50);

// Compteur de « générations » : incrémenté à CHAQUE notification Postgres.
// Sert à mutualiser le recalcul de la file entre clients SSE sans jamais
// partager un instantané périmé (cf. `coalesceAsyncByKey`, lib/async-coalesce.ts) :
// deux clients qui réagissent à la MÊME notification portent la même
// génération et peuvent partager le travail ; un client qui réagit à une
// notification PLUS RÉCENTE porte une génération différente et doit obtenir un
// calcul frais, sans quoi la mutation qui l'a réveillé serait invisible.
const generation = g.ordersGeneration ?? { value: 0 };

if (process.env.NODE_ENV !== 'production') {
  g.ordersNotifier = notifier;
  g.ordersGeneration = generation;
}

/** Génération courante : change à chaque notification `orders_changed`. */
export function getOrdersGeneration(): number {
  return generation.value;
}

async function startListener(): Promise<void> {
  while (true) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    client.on('notification', (msg) => {
      if (msg.channel === CHANNEL) {
        generation.value++;
        notifier.emit('change');
      }
    });

    try {
      await client.connect();
      try {
        await client.query(`LISTEN "${CHANNEL}"`);
        console.log('[pg LISTEN] connecté à', CHANNEL);

        // Attendre la fermeture de la connexion (erreur réseau, restart pg, etc.)
        await new Promise<void>((resolve) => {
          client.on('error', (err) => {
            console.error('[pg LISTEN] erreur, reconnexion :', err);
            resolve();
          });
          client.on('end', () => resolve());
        });
      } finally {
        // Garantit la libération même si LISTEN ou la promesse d'attente échoue.
        await client.end().catch(() => {});
      }
    } catch (err) {
      console.error(
        `[pg LISTEN] connect échoué, retry dans ${RECONNECT_DELAY_MS}ms :`,
        err
      );
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    }
  }
}

function ensureStarted(): void {
  if (g.ordersListenerStarted) return;
  g.ordersListenerStarted = true;
  void startListener();
}

/**
 * Souscrit à l'événement "une commande a changé". Démarre la connexion Postgres
 * à la première souscription (lazy). Renvoie une fonction de désinscription.
 */
export function subscribeOrders(cb: () => void): () => void {
  ensureStarted();
  notifier.on('change', cb);
  return () => notifier.off('change', cb);
}
