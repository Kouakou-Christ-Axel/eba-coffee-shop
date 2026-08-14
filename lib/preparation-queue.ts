// lib/preparation-queue.ts
//
// Requête partagée entre :
// - le server action `getPreparationQueue` (chargement SSR initial de /dashboard/preparation)
// - la route SSE `app/api/preparation/stream/route.ts` (re-fetch déclenché par LISTEN/NOTIFY)
//
// Ce fichier n'est PAS marqué `'use server'` : il exporte une fonction et un type plain,
// importables aussi bien par un fichier server action que par un route handler.
// L'auth est de la responsabilité de l'appelant.

import prisma from '@/lib/prisma';
import { compareKitchenFifo } from '@/lib/orders/queue-order';
import { endOfLocalDay, startOfLocalDay } from '@/lib/timezone';
import { PRODUCTION_PLAN_DAYS } from '@/config/constants';
import { coalesceAsyncByKey } from '@/lib/async-coalesce';
import { getOrdersGeneration } from '@/lib/postgres-notify';
import type { CartItem } from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';

export type PreparationOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  orderType: OrderType;
  items: CartItem[];
  note: string | null;
  total: number;
  // La cuisine voit les commandes EN cours (PREPARING), celles prêtes en
  // attente de récupération (READY) — pour emballer et suivre les clients qui
  // tardent — ET, depuis les commandes différées, les NEW À CRÉNEAU pas encore
  // lancées : elles vivent dans « Programmées », alimentent « À produire », et
  // portent le bouton « Lancer la préparation ».
  //
  // Une NEW SANS créneau (walk-in en attente d'encaissement) n'entre jamais
  // ici : la cuisine ne doit pas produire ce qui n'est pas engagé.
  status: 'NEW' | 'PREPARING' | 'READY';
  isPaid: boolean;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
  // Amorces des minuteurs : entrée en cuisine et passage prête. Null pour les
  // commandes créées avant l'ajout des colonnes (repli createdAt côté UI).
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  /** Instant de réservation du stock. `null` = reste à produire (alimente le
   * panneau « À produire », cf. lib/orders/production-plan.ts). */
  stockReservedAt: Date | null;
};

/**
 * Renvoie les commandes visibles en cuisine : en préparation
 * (status=PREPARING) et prêtes en attente de récupération (status=READY),
 * créées aujourd'hui OU programmées pour un retrait aujourd'hui/à venir
 * (une commande passée la veille pour un retrait du jour reste visible),
 * triées en FIFO par ENTRÉE EN CUISINE (`preparingStartedAt`, repli
 * `createdAt` — cf. `compareKitchenFifo`).
 *
 * Trier par `createdAt` seul serait faux : une commande créée à 10:00 mais
 * encaissée à 10:10 entre en cuisine APRÈS une commande créée à 10:05 et
 * encaissée à 10:06. Prisma ne sait pas exprimer un `COALESCE` dans `orderBy`,
 * donc le `orderBy` SQL ne sert que d'entrée stable et le tri final se fait en
 * mémoire.
 *
 * Une commande arrive en cuisine soit :
 *   - automatiquement quand le caissier la marque payée (NEW → PREPARING)
 *   - explicitement quand le caissier clique "Envoyer en cuisine sans paiement"
 *
 * Une commande NEW n'est visible que si elle porte un CRÉNEAU et n'a pas encore
 * réservé son stock : c'est une commande programmée en attente de lancement.
 * Un walk-in NEW (sans créneau, en attente d'encaissement) reste invisible ici.
 * Les READY restent affichées (section « en attente de récupération ») jusqu'à
 * leur passage COMPLETED (récupérée) côté caisse.
 */
export async function fetchPreparationQueue(): Promise<PreparationOrder[]> {
  const now = new Date();
  // Bornes ancrées sur Abidjan, PAS sur le fuseau du runtime (cf. le même
  // correctif dans `lib/cashier-queue.ts`).
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);
  // Horizon du panneau « À produire » : borne la charge utile du flux SSE, une
  // commande passée pour dans six mois n'a rien à faire sur l'écran cuisine.
  const horizonEnd = endOfLocalDay(
    new Date(dayStart.getTime() + (PRODUCTION_PLAN_DAYS - 1) * 86_400_000)
  );

  // ⚠️ Une seule clé `OR` par littéral d'objet : deux `OR` frères dans le même
  // objet JS, la seconde écrase la première EN SILENCE. D'où le `AND` explicite.
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        {
          AND: [
            { status: { in: ['PREPARING', 'READY'] } },
            // Du jour (walk-in) OU programmée pour aujourd'hui/à venir : on
            // inclut ainsi une commande passée la veille (ou plus tôt) pour un
            // retrait aujourd'hui ou plus tard — sinon elle disparaît de la
            // cuisine dès le changement de jour civil, alors qu'elle est déjà
            // PREPARING/READY (cf. `fetchCashierQueue`).
            {
              OR: [
                { createdAt: { gte: dayStart, lte: dayEnd } },
                { pickupTime: { gte: dayStart } },
              ],
            },
          ],
        },
        {
          // Programmées pas encore lancées : « à produire », et lançables d'un
          // tap depuis l'écran cuisine.
          AND: [
            { status: 'NEW' as const },
            { stockReservedAt: null },
            { pickupTime: { gte: dayStart, lte: horizonEnd } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const mapped = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    dailyNumber: o.dailyNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    pickupTime: o.pickupTime,
    orderType: o.orderType,
    items: o.items as CartItem[],
    note: o.note,
    total: o.total,
    status: o.status as 'NEW' | 'PREPARING' | 'READY',
    isPaid: o.isPaid,
    driverRequested: o.driverRequested,
    driverName: o.driverName,
    driverPhone: o.driverPhone,
    createdAt: o.createdAt,
    preparingStartedAt: o.preparingStartedAt,
    readyAt: o.readyAt,
    stockReservedAt: o.stockReservedAt,
  }));

  return mapped.sort(compareKitchenFifo);
}

/**
 * Variante mutualisée de `fetchPreparationQueue()`, à utiliser par le flux SSE
 * (`/api/preparation/stream`). Même situation qu'en caisse : chaque écran
 * cuisine connecté possède sa PROPRE boucle debounce/notify mais reçoit le même
 * instantané global, si bien qu'une seule mutation de commande relançait la
 * requête une fois PAR écran connecté.
 *
 * Mutualisation kéyée sur la génération de notification, et NON sur la simple
 * présence d'un calcul en vol : un écran réveillé par une notification plus
 * récente doit obtenir un calcul frais, sinon la commande qui l'a réveillé
 * resterait invisible en cuisine. Voir la démonstration détaillée en tête de
 * `lib/async-coalesce.ts`. Pas de TTL.
 */
export const fetchPreparationQueueShared = coalesceAsyncByKey(
  fetchPreparationQueue,
  getOrdersGeneration
);
