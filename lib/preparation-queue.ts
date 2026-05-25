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
  status: 'NEW' | 'PREPARING';
  isPaid: boolean;
  driverRequested: boolean;
};

/**
 * Renvoie les commandes du jour en statut NEW ou PREPARING,
 * triées par heure de retrait croissante (commandes online en premier
 * via leur pickupTime, walk-in sans créneau ensuite par createdAt).
 */
export async function fetchPreparationQueue(): Promise<PreparationOrder[]> {
  const now = new Date();
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['NEW', 'PREPARING'] },
      createdAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
    orderBy: [
      { pickupTime: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });

  return orders.map((o) => ({
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
    status: o.status as 'NEW' | 'PREPARING',
    isPaid: o.isPaid,
    driverRequested: o.driverRequested,
  }));
}
