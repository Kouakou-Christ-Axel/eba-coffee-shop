// lib/orders/mutations/stock-needs.ts
//
// Mutations de commandes — stock-needs (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import { optionKey } from '@/lib/orders/availability';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';

// ─── Décrément du stock (le cœur anti-survente) ───────────────────────────────
//
// N'A QU'UN SEUL APPELANT : `reserveStockOnce` (juste en dessous), qui garantit
// que le décrément a lieu AU PLUS UNE FOIS par commande. Ne jamais l'appeler
// directement — sans le verrou `Order.stockReservedAt`, deux chemins menant en
// cuisine (encaissement d'une commande NEW, envoi manuel, ardoise, undo puis
// renvoi) décrémenteraient deux fois le même panier.
//
// Décrémente le stock produit ET options DANS LA MÊME transaction que
// l'écriture appelante : la garde conditionnelle (`updateMany` avec
// `stockQuantity: { gte: besoin }` OU `null`) sérialise la concurrence sur la
// dernière unité — un seul appelant gagne, l'autre voit `count !== 1` et lève
// `StockShortageError`, qui fait échouer (rollback) toute la transaction :
// opération refusée, RIEN décrémenté, aucun statut/paiement écrit.
//
// `stockQuantity === null` = illimité : le `OR` laisse passer ce cas sans
// jamais bloquer, et l'arithmétique SQL (`NULL - n = NULL`) laisse la colonne
// inchangée après le `decrement` — pas besoin de branche séparée.
//
// Options résolues par (produit, nom de groupe, nom d'option) puisque le
// panier ne connaît pas les id internes des options — MAIS deux options
// peuvent légitimement porter le même nom dans un même groupe (ex. un ancien
// « goût » désactivé conservé après renommage, cf. `updateSupplementGroups`
// qui apparie par nom). Un `updateMany` par nom matcherait alors les deux
// lignes à la fois : `count` vaudrait 2 et non 1, et un paiement pourtant
// honorable serait refusé à tort. On résout donc d'abord l'id de l'option
// *disponible* (déterministe, la plus ancienne) avant de décrémenter cet id
// précis — la garde atomique et la sérialisation de concurrence restent
// intactes, seule l'ambiguïté du nom est levée en amont.

/**
 * Id de l'option DISPONIBLE correspondant à (produit, nom de groupe, nom
 * d'option) — la plus ancienne en cas d'homonymie. Extrait ici parce que trois
 * appelants en dépendent et doivent impérativement viser la MÊME ligne :
 * le décrément, le calcul de pénurie et la couverture de pénurie.
 */
export async function resolveOptionId(
  tx: Prisma.TransactionClient,
  productId: string,
  groupName: string,
  optionName: string
): Promise<string | null> {
  const option = await tx.supplementOption.findFirst({
    where: {
      name: optionName,
      available: true,
      // Le groupe peut être propre au produit OU global (« Extras »,
      // `isGlobal: true`, sans `productId`) — voir prisma/schema.prisma.
      group: {
        name: groupName,
        OR: [{ productId }, { isGlobal: true }],
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return option?.id ?? null;
}

export async function decrementStockForOrderItems(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<void> {
  for (const item of items) {
    const productResult = await tx.product.updateMany({
      where: {
        id: item.productId,
        OR: [
          { stockQuantity: null },
          { stockQuantity: { gte: item.quantity } },
        ],
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    if (productResult.count !== 1) {
      throw new StockShortageError(
        `Stock insuffisant pour « ${item.productName} »`
      );
    }

    for (const supplement of item.supplements) {
      const needed = (supplement.quantity ?? 1) * item.quantity;
      const optionId = await resolveOptionId(
        tx,
        item.productId,
        supplement.groupName,
        supplement.optionName
      );
      if (!optionId) {
        throw new StockShortageError(
          `Option indisponible pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
      const optionResult = await tx.supplementOption.updateMany({
        where: {
          id: optionId,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: needed } }],
        },
        data: { stockQuantity: { decrement: needed } },
      });
      if (optionResult.count !== 1) {
        throw new StockShortageError(
          `Stock insuffisant pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
    }
  }
}

// ─── Pénurie : la question posée au cuisinier, et sa couverture ───────────────
//
// Le décrément ci-dessus refuse une commande dont le stock manque. C'est juste
// vis-à-vis de la survente, mais insuffisant en pratique : le cuisinier a la
// matière devant lui, il vient de produire la fournée, et on lui demandait
// d'aller corriger la quantité dans /dashboard/menu avant de pouvoir lancer.
//
// Les fonctions ci-dessous permettent de lui poser la question à la place —
// « il manque 3 × Sponge cake (Vanille), vous les avez produits ? » — puis, s'il
// valide, de CRÉDITER EXACTEMENT la quantité manquante juste avant la
// réservation, qui la redescend aussitôt. Effet net sur le stock : zéro. Ce
// n'est donc pas un contournement de la garde anti-survente : c'est
// l'enregistrement d'une production réelle, faite au bon endroit.

/**
 * Besoin TOTAL de la commande par cible de stock. L'agrégation est
 * indispensable : deux lignes de panier peuvent viser le même produit (ou le
 * même goût via des suppléments distincts), et les traiter séparément
 * sous-estimerait le manque.
 *
 * Les options introuvables (renommées, désactivées) sont écartées de `options`
 * (clé = id réel) et reportées dans `unresolved` (clé = `optionKey`, stable
 * même sans id) : `computeShortage`/`coverShortageForOrderItems` les ignorent
 * (ce n'est pas une pénurie que le cuisinier puisse couvrir en produisant, et
 * le décrément lèvera de toute façon « Option indisponible » à la création),
 * mais `resyncStockForItemChange` en a besoin pour ne pas laisser passer en
 * silence l'ajout d'une quantité sur une option devenue indisponible.
 */
export async function aggregateStockNeeds(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<{
  products: Map<string, { name: string; needed: number }>;
  options: Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >;
  unresolved: Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >;
}> {
  const products = new Map<string, { name: string; needed: number }>();
  const options = new Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >();
  const unresolved = new Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >();

  for (const item of items) {
    const current = products.get(item.productId);
    products.set(item.productId, {
      name: item.productName,
      needed: (current?.needed ?? 0) + item.quantity,
    });

    for (const supplement of item.supplements) {
      const optionId = await resolveOptionId(
        tx,
        item.productId,
        supplement.groupName,
        supplement.optionName
      );
      const needed = (supplement.quantity ?? 1) * item.quantity;
      if (!optionId) {
        const key = optionKey(
          item.productId,
          supplement.groupName,
          supplement.optionName
        );
        const existing = unresolved.get(key);
        unresolved.set(key, {
          productName: item.productName,
          groupName: supplement.groupName,
          optionName: supplement.optionName,
          needed: (existing?.needed ?? 0) + needed,
        });
        continue;
      }
      const existing = options.get(optionId);
      options.set(optionId, {
        productName: item.productName,
        groupName: supplement.groupName,
        optionName: supplement.optionName,
        needed: (existing?.needed ?? 0) + needed,
      });
    }
  }

  return { products, options, unresolved };
}

/**
 * Ce qui manque pour honorer `items` face au stock COURANT. N'écrit rien.
 * Une cible à `stockQuantity: null` (illimité) n'est jamais en pénurie.
 */
export async function computeShortage(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<ShortageLine[]> {
  const { products, options } = await aggregateStockNeeds(tx, items);
  const lines: ShortageLine[] = [];

  if (products.size > 0) {
    const rows = await tx.product.findMany({
      where: { id: { in: [...products.keys()] } },
      select: { id: true, stockQuantity: true },
    });
    for (const row of rows) {
      const need = products.get(row.id);
      if (!need || row.stockQuantity === null) continue;
      const missing = need.needed - row.stockQuantity;
      if (missing > 0) {
        lines.push({
          target: 'product',
          targetId: row.id,
          productName: need.name,
          missing,
        });
      }
    }
  }

  if (options.size > 0) {
    const rows = await tx.supplementOption.findMany({
      where: { id: { in: [...options.keys()] } },
      select: { id: true, stockQuantity: true },
    });
    for (const row of rows) {
      const need = options.get(row.id);
      if (!need || row.stockQuantity === null) continue;
      const missing = need.needed - row.stockQuantity;
      if (missing > 0) {
        lines.push({
          target: 'option',
          targetId: row.id,
          productName: need.productName,
          groupName: need.groupName,
          optionName: need.optionName,
          missing,
        });
      }
    }
  }

  return lines;
}
