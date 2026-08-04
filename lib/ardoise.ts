// lib/ardoise.ts
//
// L'« ardoise » : tout ce qui est dû au commerce, regroupé par client.
//
// POURQUOI UN MODULE À PART plutôt que réutiliser `lib/cashier-queue.ts` ?
// Parce que la file caisse est bornée à la journée (`createdAt` du jour OU
// `pickupTime` à venir) : elle perdrait silencieusement la dette d'hier, qui
// est précisément la seule chose que l'ardoise doit montrer. Cette requête
// n'est donc DÉLIBÉRÉMENT pas cadrée sur un jour civil.
//
// Ce que l'ardoise n'est PAS : un paiement. Ces commandes restent
// `isPaid: false` — le CA (lib/stats.ts) et la clôture de caisse
// (lib/cash-closing.ts) ne comptent que le payé, et les gonfler ici ferait
// diverger la caisse théorique du tiroir compté, puis double-compterait le
// montant au règlement réel.
//
// Importable par server actions ET route handlers (pas de 'use server') —
// même convention que `lib/cashier-queue.ts`.

import { startOfDay } from 'date-fns';
import prisma from '@/lib/prisma';
import type { OrderStatus } from '@/generated/prisma/client';

export type ArdoiseOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  status: OrderStatus;
  total: number;
  /** Vrai si la commande est partie en cuisine sciemment sans encaissement. */
  isOnAccount: boolean;
  createdAt: Date;
};

export type ArdoiseGroup = {
  /**
   * Clé de regroupement : l'id du client quand il est identifié, sinon une clé
   * propre à la commande (`anon:<orderId>`) — deux commandes anonymes n'ont
   * aucune raison d'être additionnées, on ne sait pas si c'est la même personne.
   */
  key: string;
  customerId: string | null;
  name: string | null;
  phone: string | null;
  isTrusted: boolean;
  ordersCount: number;
  totalOwed: number;
  /** Date de la plus ancienne commande impayée du groupe (ancienneté de la dette). */
  oldestUnpaidAt: Date;
  /** Commandes du groupe, de la plus ancienne à la plus récente. */
  orders: ArdoiseOrder[];
};

export type Ardoise = {
  /** Groupes triés par dette la plus ancienne d'abord. */
  groups: ArdoiseGroup[];
  totalOwed: number;
  ordersCount: number;
  /** Borne haute (exclusive) réellement appliquée sur `createdAt`. */
  before: Date;
};

/**
 * Renvoie tout l'impayé non annulé, regroupé par client.
 *
 * `before` (défaut : minuit du jour en cours) exclut les commandes du jour :
 * une commande passée il y a dix minutes et pas encore encaissée n'est pas une
 * ardoise, c'est le travail normal de la caisse. L'interface expose un
 * interrupteur « inclure aujourd'hui » qui repousse cette borne.
 *
 * `onlyOnAccount` restreint aux commandes explicitement mises sur l'ardoise
 * (`Order.isOnAccount`), par opposition aux impayés « oubliés » — utile pour
 * distinguer la dette consentie de l'anomalie de caisse.
 */
export async function fetchArdoise(opts?: {
  onlyOnAccount?: boolean;
  before?: Date;
}): Promise<Ardoise> {
  const before = opts?.before ?? startOfDay(new Date());

  const orders = await prisma.order.findMany({
    where: {
      isPaid: false,
      status: { not: 'CANCELLED' },
      createdAt: { lt: before },
      ...(opts?.onlyOnAccount ? { isOnAccount: true } : {}),
    },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, isTrusted: true },
      },
    },
    // Plus ancienne d'abord : le regroupement en JS conserve cet ordre au sein
    // de chaque groupe, et le premier élément vu d'un groupe est donc sa dette
    // la plus ancienne.
    orderBy: { createdAt: 'asc' },
  });

  const byKey = new Map<string, ArdoiseGroup>();
  let totalOwed = 0;

  for (const o of orders) {
    totalOwed += o.total;

    const key = o.customer ? o.customer.id : `anon:${o.id}`;
    const line: ArdoiseOrder = {
      id: o.id,
      reference: o.reference,
      dailyNumber: o.dailyNumber,
      status: o.status,
      total: o.total,
      isOnAccount: o.isOnAccount,
      createdAt: o.createdAt,
    };

    const existing = byKey.get(key);
    if (existing) {
      existing.orders.push(line);
      existing.ordersCount += 1;
      existing.totalOwed += o.total;
      continue;
    }

    byKey.set(key, {
      key,
      customerId: o.customer?.id ?? null,
      // Commande anonyme : on retombe sur le nom / téléphone figés sur la
      // commande, souvent renseignés même sans fiche CRM.
      name: o.customer?.name ?? o.customerName ?? null,
      phone: o.customer?.phone ?? o.customerPhone ?? null,
      isTrusted: o.customer?.isTrusted ?? false,
      ordersCount: 1,
      totalOwed: o.total,
      oldestUnpaidAt: o.createdAt,
      orders: [line],
    });
  }

  const groups = [...byKey.values()].sort(
    (a, b) => a.oldestUnpaidAt.getTime() - b.oldestUnpaidAt.getTime()
  );

  return { groups, totalOwed, ordersCount: orders.length, before };
}
