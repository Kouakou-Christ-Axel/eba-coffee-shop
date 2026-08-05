// lib/ardoise.ts
//
// L'« ardoise » : la marchandise partie sans que l'argent soit rentré,
// regroupée par client.
//
// CE QUI FAIT UNE DETTE : la commande a été RÉCUPÉRÉE (`status: 'COMPLETED'`)
// et n'est pas payée (`isPaid: false`). Une commande encore `NEW`, `PREPARING`
// ou `READY` n'est PAS une ardoise : le client n'a rien emporté, il ne doit
// donc rien — la compter gonflerait le « total dû » d'un argent que personne
// ne doit.
//
// AUCUNE BORNE DE DATE. Une commande récupérée impayée est une dette dès
// l'instant où le client sort, pas à partir de demain : les commandes du jour
// encore en cours s'excluent déjà toutes seules via le filtre `COMPLETED`.
//
// POURQUOI UN MODULE À PART plutôt que réutiliser `lib/cashier-queue.ts` ?
// Parce que la file caisse est bornée à la journée (`createdAt` du jour OU
// `pickupTime` à venir) : elle perdrait silencieusement la dette d'hier, qui
// est précisément la seule chose que l'ardoise doit montrer. Cette requête
// n'est donc DÉLIBÉRÉMENT pas cadrée sur un jour civil.
//
// LE GARDE-FOU (« à vérifier »). Si le personnel oublie d'appuyer sur « c'est
// récupéré », une commande bel et bien remise reste `READY` et disparaîtrait
// de l'ardoise : dette sous-évaluée, en silence. De même, une vieille commande
// impayée encore `NEW`/`PREPARING` est une anomalie (remise sans être marquée,
// ou jamais annulée). Ces commandes sont donc listées À PART, visibles mais
// HORS du total dû — on ne réclame pas d'argent sur une donnée dont on ne sait
// pas si la marchandise est partie ; on corrige d'abord le statut.
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

/** Statuts d'une commande que le client n'a pas encore emportée. */
const IN_FLIGHT_STATUSES = ['NEW', 'PREPARING', 'READY'] as const;

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

/**
 * Ligne de la section « à vérifier ». Porte son client directement (pas de
 * regroupement ici) pour que la ligne soit actionnable telle quelle.
 */
export type ArdoiseToCheckOrder = ArdoiseOrder & {
  customerId: string | null;
  name: string | null;
  phone: string | null;
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
  /** Somme des commandes récupérées et impayées. N'inclut JAMAIS `toCheck`. */
  totalOwed: number;
  ordersCount: number;
  /**
   * Impayées d'avant aujourd'hui jamais marquées comme récupérées, de la plus
   * ancienne à la plus récente. HORS `totalOwed` : à corriger ou à annuler.
   */
  toCheck: ArdoiseToCheckOrder[];
  toCheckCount: number;
  /** Montant cumulé des lignes « à vérifier ». Affichage seulement. */
  toCheckTotal: number;
};

/**
 * Renvoie la dette réelle du commerce — marchandise remise, argent pas reçu —
 * regroupée par client, plus la liste des anomalies à vérifier.
 *
 * La dette ne retient que les commandes `COMPLETED` impayées, sans aucune
 * borne de date : un client qui sort ce matin sans payer doit apparaître tout
 * de suite, pas demain.
 *
 * `toCheck` liste les impayées encore `NEW`/`PREPARING`/`READY` créées avant
 * aujourd'hui (une commande `READY` d'il y a vingt minutes, c'est du service
 * normal, pas une anomalie). Elles sont montrées mais jamais additionnées au
 * total.
 *
 * `onlyOnAccount` restreint aux commandes explicitement mises sur l'ardoise
 * (`Order.isOnAccount`), par opposition aux impayés « oubliés » — utile pour
 * distinguer la dette consentie de l'anomalie de caisse. Il ne s'applique
 * QU'À LA DETTE : une anomalie reste une anomalie, consentie ou non, et c'est
 * justement le retrait non consenti et non enregistré que le garde-fou doit
 * attraper — le filtrer le viderait de son sens.
 */
export async function fetchArdoise(opts?: {
  onlyOnAccount?: boolean;
}): Promise<Ardoise> {
  // Seuil d'ancienneté du garde-fou : minuit du jour en cours.
  const staleBefore = startOfDay(new Date());

  // Un seul aller-retour : les deux listes veulent le même `include`, le même
  // tri et le même filtre `isPaid`. On les sépare en JS sur le statut.
  // `CANCELLED` est exclu par construction — il n'est dans aucune branche.
  const orders = await prisma.order.findMany({
    where: {
      isPaid: false,
      OR: [
        {
          status: 'COMPLETED',
          ...(opts?.onlyOnAccount ? { isOnAccount: true } : {}),
        },
        {
          status: { in: [...IN_FLIGHT_STATUSES] },
          createdAt: { lt: staleBefore },
        },
      ],
    },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, isTrusted: true },
      },
    },
    // Plus ancienne d'abord : le regroupement en JS conserve cet ordre au sein
    // de chaque groupe, et le premier élément vu d'un groupe est donc sa dette
    // la plus ancienne. `toCheck` hérite du même ordre.
    orderBy: { createdAt: 'asc' },
  });

  const byKey = new Map<string, ArdoiseGroup>();
  const toCheck: ArdoiseToCheckOrder[] = [];
  let totalOwed = 0;
  let ordersCount = 0;
  let toCheckTotal = 0;

  for (const o of orders) {
    const line: ArdoiseOrder = {
      id: o.id,
      reference: o.reference,
      dailyNumber: o.dailyNumber,
      status: o.status,
      total: o.total,
      isOnAccount: o.isOnAccount,
      createdAt: o.createdAt,
    };
    // Commande anonyme : on retombe sur le nom / téléphone figés sur la
    // commande, souvent renseignés même sans fiche CRM.
    const name = o.customer?.name ?? o.customerName ?? null;
    const phone = o.customer?.phone ?? o.customerPhone ?? null;

    if (o.status !== 'COMPLETED') {
      toCheckTotal += o.total;
      toCheck.push({
        ...line,
        customerId: o.customer?.id ?? null,
        name,
        phone,
      });
      continue;
    }

    totalOwed += o.total;
    ordersCount += 1;

    const key = o.customer ? o.customer.id : `anon:${o.id}`;
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
      name,
      phone,
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

  return {
    groups,
    totalOwed,
    ordersCount,
    toCheck,
    toCheckCount: toCheck.length,
    toCheckTotal,
  };
}
