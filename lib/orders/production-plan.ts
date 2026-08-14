// lib/orders/production-plan.ts
//
// « À produire » : ce que la cuisine doit fabriquer, par JOUR, par produit et
// par goût. Entièrement DÉRIVÉ des commandes — aucune saisie, aucune table, rien
// à tenir à jour. Le patron ne déclare pas ses quantités : ce sont les commandes
// programmées qui les dictent.
//
// Fichier PUR (aucun Prisma, aucun React) : il transforme une liste de commandes
// déjà chargée — celle du flux SSE cuisine (`lib/preparation-queue.ts`) — donc
// aucune requête supplémentaire, et le panneau se rafraîchit avec le reste de
// l'écran.
//
// PÉRIMÈTRE = « reste à produire » : uniquement les commandes dont le stock
// n'est PAS encore réservé (`stockReservedAt === null`) et qui ne sont pas
// annulées. Une commande partie en cuisine a déjà décompté sa marchandise ;
// la compter ici la ferait apparaître deux fois. Conséquence voulue : le
// compteur DESCEND au fil de la journée, à mesure que la cuisine lance.

import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';
import { orderProductionDay } from './scheduling';

export type ProductionFlavour = {
  groupName: string;
  optionName: string;
  quantity: number;
};

export type ProductionLine = {
  productId: string;
  productName: string;
  /** Somme des quantités d'articles à produire ce jour-là. */
  quantity: number;
  /** Ventilation par goût (« 5 Vanille · 7 Coco »), vide si le produit n'en a pas. */
  flavours: ProductionFlavour[];
  /** Commandes à l'origine de cette ligne — traçabilité « ça vient d'où ? ». */
  orderIds: string[];
};

export type ProductionDay = {
  /** Jour civil Abidjan, YYYY-MM-DD. */
  date: string;
  /** Somme des quantités toutes lignes confondues (compteur de la puce). */
  totalItems: number;
  lines: ProductionLine[];
};

/** Forme minimale d'une commande pour ce calcul. */
export type ProducibleOrder = {
  id: string;
  status: OrderStatus;
  pickupTime: Date | null;
  createdAt: Date;
  stockReservedAt: Date | null;
  items: CartItem[];
};

/**
 * Plan de production regroupé par jour.
 *
 * Ne renvoie QUE les jours ayant effectivement des commandes, triés par date
 * croissante : un sélecteur affichant une semaine de « 0 » noierait le
 * cuisinier sous des onglets vides. Tableau vide = rien à produire, nulle part.
 *
 * Les libellés (`productName`, `optionName`) viennent du JSON `Order.items`,
 * pas de la base : c'est le nom AU MOMENT DE LA COMMANDE, celui que le client
 * attend, et cela évite toute jointure — donc aucun N+1.
 */
export function buildProductionPlan(
  orders: ProducibleOrder[]
): ProductionDay[] {
  const byDay = new Map<string, Map<string, ProductionLine>>();

  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    // Déjà réservée = déjà décomptée : elle n'est plus « à produire ».
    if (order.stockReservedAt !== null) continue;

    const day = orderProductionDay(order);
    let lines = byDay.get(day);
    if (!lines) {
      lines = new Map<string, ProductionLine>();
      byDay.set(day, lines);
    }

    for (const item of order.items) {
      let line = lines.get(item.productId);
      if (!line) {
        line = {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          flavours: [],
          orderIds: [],
        };
        lines.set(item.productId, line);
      }
      line.quantity += item.quantity;
      if (!line.orderIds.includes(order.id)) line.orderIds.push(order.id);

      for (const supplement of item.supplements) {
        // Multiplicateur des groupes « quantity » : 2 parts Vanille sur 3
        // boîtes = 6 parts à produire, pas 2.
        const needed = (supplement.quantity ?? 1) * item.quantity;
        const existing = line.flavours.find(
          (f) =>
            f.groupName === supplement.groupName &&
            f.optionName === supplement.optionName
        );
        if (existing) {
          existing.quantity += needed;
        } else {
          line.flavours.push({
            groupName: supplement.groupName,
            optionName: supplement.optionName,
            quantity: needed,
          });
        }
      }
    }
  }

  return [...byDay.entries()]
    .map(([date, lines]) => {
      const ordered = [...lines.values()].sort(
        (a, b) =>
          b.quantity - a.quantity || a.productName.localeCompare(b.productName)
      );
      for (const line of ordered) {
        line.flavours.sort(
          (a, b) =>
            b.quantity - a.quantity || a.optionName.localeCompare(b.optionName)
        );
      }
      return {
        date,
        totalItems: ordered.reduce((sum, l) => sum + l.quantity, 0),
        lines: ordered,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
