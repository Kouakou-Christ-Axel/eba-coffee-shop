// lib/preparation-queue.ts
//
// Requête partagée entre :
// - le server action `getPreparationQueue` (chargement SSR initial de /dashboard/preparation)
// - la route SSE `app/api/preparation/stream/route.ts` (re-fetch déclenché par LISTEN/NOTIFY)
//
// Ce fichier n'est PAS marqué `'use server'` : il exporte une fonction et un type plain,
// importables aussi bien par un fichier server action que par un route handler.
// L'auth est de la responsabilité de l'appelant.

import { endOfDay, startOfDay } from 'date-fns';
import prisma from '@/lib/prisma';
import { compareKitchenFifo } from '@/lib/orders/queue-order';
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
  // La cuisine voit désormais les commandes EN cours (PREPARING) ET celles
  // prêtes en attente de récupération (READY) — pour emballer et suivre les
  // clients qui tardent à venir chercher.
  status: 'PREPARING' | 'READY';
  isPaid: boolean;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
  // Amorces des minuteurs : entrée en cuisine et passage prête. Null pour les
  // commandes créées avant l'ajout des colonnes (repli createdAt côté UI).
  preparingStartedAt: Date | null;
  readyAt: Date | null;
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
 * Les commandes NEW (en attente d'encaissement) ne sont jamais visibles ici.
 * Les READY restent affichées (section « en attente de récupération ») jusqu'à
 * leur passage COMPLETED (récupérée) côté caisse.
 */
export async function fetchPreparationQueue(): Promise<PreparationOrder[]> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PREPARING', 'READY'] },
      // Du jour (walk-in) OU programmée pour aujourd'hui/à venir : on inclut ainsi
      // une commande passée la veille (ou plus tôt) pour un retrait aujourd'hui ou
      // plus tard — sinon elle disparaît de la cuisine dès le changement de jour
      // civil, alors qu'elle est déjà PREPARING/READY (cf. `fetchCashierQueue`).
      OR: [
        { createdAt: { gte: dayStart, lte: dayEnd } },
        { pickupTime: { gte: dayStart } },
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
    status: o.status as 'PREPARING' | 'READY',
    isPaid: o.isPaid,
    driverRequested: o.driverRequested,
    driverName: o.driverName,
    driverPhone: o.driverPhone,
    createdAt: o.createdAt,
    preparingStartedAt: o.preparingStartedAt,
    readyAt: o.readyAt,
  }));

  return mapped.sort(compareKitchenFifo);
}
