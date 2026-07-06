// lib/cashier-queue.ts
//
// Snapshot pour l'écran caisse. Filtre :
//   - toute commande du jour PAS encore COMPLETED ni CANCELLED
//   - OU toute commande encore non payée (même si remise — anomalie à régler)
//
// Tri : pickupTime asc avec null en dernier (les commandes online avec créneau
// remontent), puis createdAt asc pour les walk-in et égalités.
//
// Importable par server actions ET route handlers (pas de 'use server').

import { endOfDay, startOfDay } from 'date-fns';
import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';

export type CashierOrder = {
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
  status: OrderStatus;
  isPaid: boolean;
  paymentMode: PaymentMode | null;
  paymentProofUrl: string | null;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
};

export async function fetchCashierQueue(): Promise<CashierOrder[]> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const orders = await prisma.order.findMany({
    where: {
      // Une commande annulée (ou remboursée) quitte la file caisse.
      status: { not: 'CANCELLED' },
      AND: [
        // Toujours active (en cuisine/prête) OU encore impayée.
        {
          OR: [
            { status: { in: ['NEW', 'PREPARING', 'READY'] } },
            { isPaid: false },
          ],
        },
        // Du jour (walk-in) OU programmée pour aujourd'hui/à venir : on inclut ainsi
        // une commande passée la veille pour un retrait aujourd'hui ou demain.
        {
          OR: [
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { pickupTime: { gte: dayStart } },
          ],
        },
      ],
    },
    // FIFO strict : la commande la plus ancienne en haut.
    orderBy: { createdAt: 'asc' },
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
    status: o.status,
    isPaid: o.isPaid,
    paymentMode: o.paymentMode,
    paymentProofUrl: o.paymentProofUrl,
    driverRequested: o.driverRequested,
    driverName: o.driverName,
    driverPhone: o.driverPhone,
    createdAt: o.createdAt,
  }));
}
