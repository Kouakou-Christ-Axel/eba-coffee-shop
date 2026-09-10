// lib/orders/production-plan.ts
//
// « À produire » : la charge de travail RÉELLE de la cuisine, par JOUR, par
// produit et par goût. Entièrement DÉRIVÉ des commandes — aucune saisie,
// aucune table, rien à tenir à jour.
//
// Fichier PUR (aucun Prisma, aucun React) : il transforme une liste de commandes
// déjà chargée — celle du flux SSE cuisine (`lib/preparation-queue.ts`) — donc
// aucune requête supplémentaire, et le panneau se rafraîchit avec le reste de
// l'écran.
//
// PÉRIMÈTRE = commandes déjà EN CUISINE (`status === 'PREPARING'`), pas
// encore prêtes. Une commande `NEW` (ex. une livraison qui attend encore
// l'encaissement) n'est pas « à produire » : elle n'a pas commencé. Une
// commande `READY`/`COMPLETED`/`CANCELLED` non plus : c'est fait, ou ça ne
// se fera pas. Conséquence voulue : le compteur descend quand la cuisine
// marque « Prête », pas au lancement — c'est un agrégat de la file en cours,
// utile pour préparer par lot (« 12 croissants au total ») plutôt que de
// lire chaque ticket un par un.
//
// Deux tags CHIFFRÉS par ligne, tous deux inclus dans `quantity` (jamais en
// plus) :
//   - `addedLaterQuantity` : part ajoutée à une commande APRÈS son entrée en
//     cuisine (`CartItem.addedLater`, cf. `updateOrderItems`) — la cuisine a
//     pu commencer à produire AVANT que cet ajout existe, il ne faut pas le
//     confondre avec ce qui est déjà en train de cuire.
//   - `scheduledQuantity` : part venant d'une commande « programmée en
//     avance » (`isScheduledAhead`) — déjà lancée en cuisine pour un retrait
//     plus tard, mais pas pour le service immédiat.

import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';
import { isScheduledAhead, orderProductionDay } from './scheduling';

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
  /** Part de `quantity` ajoutée à une commande APRÈS son entrée en cuisine. */
  addedLaterQuantity: number;
  /** Part de `quantity` venant de commandes programmées, déjà lancées en avance. */
  scheduledQuantity: number;
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
  orders: ProducibleOrder[],
  now: Date = new Date()
): ProductionDay[] {
  const byDay = new Map<string, Map<string, ProductionLine>>();

  for (const order of orders) {
    // Périmètre = en cuisine, pas encore prête (cf. en-tête du fichier).
    if (order.status !== 'PREPARING') continue;

    const scheduledAhead = isScheduledAhead(order, now);
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
          addedLaterQuantity: 0,
          scheduledQuantity: 0,
          flavours: [],
          orderIds: [],
        };
        lines.set(item.productId, line);
      }
      line.quantity += item.quantity;
      if (item.addedLater) line.addedLaterQuantity += item.quantity;
      if (scheduledAhead) line.scheduledQuantity += item.quantity;
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
