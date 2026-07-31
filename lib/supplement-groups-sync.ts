// lib/supplement-groups-sync.ts
//
// Synchronise un ensemble de groupes/options de suppléments par UPSERT
// (apparié par `name`) plutôt que par delete+recreate : les groupes/options
// dont le nom est conservé gardent leur `id`. Partagé par deux appelants :
// `updateSupplementGroups` (lib/menu-mutations.ts, scope = un produit) et
// `updateGlobalExtraGroups` (lib/global-extras-mutations.ts, scope = les
// groupes globaux « Extras »), pour ne pas dupliquer cette logique de diff.

import type { Prisma } from '@/generated/prisma/client';
import type { SupplementGroupInput } from '@/lib/schemas/menu';

export type SupplementGroupScope = { productId: string } | { isGlobal: true };

export async function syncSupplementGroups(
  tx: Prisma.TransactionClient,
  scope: SupplementGroupScope,
  groups: SupplementGroupInput[]
): Promise<void> {
  const currentGroups = await tx.supplementGroup.findMany({
    where: scope,
    include: { options: true },
  });
  const currentGroupByName = new Map(currentGroups.map((g) => [g.name, g]));
  const keepGroupNames = new Set(groups.map((g) => g.name));

  const removedGroupIds = currentGroups
    .filter((g) => !keepGroupNames.has(g.name))
    .map((g) => g.id);
  if (removedGroupIds.length > 0) {
    await tx.supplementGroup.deleteMany({
      where: { id: { in: removedGroupIds } },
    });
  }

  for (const [gi, g] of groups.entries()) {
    const groupData = {
      name: g.name,
      type: g.type,
      required: g.required,
      available: g.available,
      minSelect: g.minSelect ?? null,
      maxSelect: g.maxSelect ?? null,
      sortOrder: gi,
    };
    const match = currentGroupByName.get(g.name);

    if (!match) {
      await tx.supplementGroup.create({
        data: {
          ...groupData,
          ...scope,
          options: {
            create: g.options.map((o) => ({
              name: o.name,
              price: o.price,
              available: o.available,
              stockQuantity: o.stockQuantity ?? null,
            })),
          },
        },
      });
      continue;
    }

    await tx.supplementGroup.update({
      where: { id: match.id },
      data: groupData,
    });

    // Appariement par nom, mais via une FILE par nom (pas une valeur
    // unique) : si le nom est dupliqué en base (données historiques —
    // c'est arrivé) ou soumis plusieurs fois, chaque option soumise ne
    // consomme qu'UNE ligne existante correspondante ; les lignes
    // restantes (nom disparu, ou surplus d'un doublon) sont supprimées
    // après coup. Une simple Map à valeur unique collapsait silencieusement
    // les doublons et rendait leur suppression impossible — un « goût »
    // désactivé dupliqué ne pouvait jamais être retiré, y compris en le
    // supprimant du formulaire et en sauvegardant (cf. le bug qui a bloqué
    // des paiements par ambiguïté de décrément, lib/order-mutations.ts).
    const currentOptionsByName = new Map<string, typeof match.options>();
    for (const o of match.options) {
      const queue = currentOptionsByName.get(o.name) ?? [];
      queue.push(o);
      currentOptionsByName.set(o.name, queue);
    }

    for (const o of g.options) {
      const optionMatch = currentOptionsByName.get(o.name)?.shift();
      const optionData = {
        name: o.name,
        price: o.price,
        available: o.available,
        stockQuantity: o.stockQuantity ?? null,
      };
      if (optionMatch) {
        await tx.supplementOption.update({
          where: { id: optionMatch.id },
          data: optionData,
        });
      } else {
        await tx.supplementOption.create({
          data: { ...optionData, groupId: match.id },
        });
      }
    }

    const removedOptionIds = [...currentOptionsByName.values()]
      .flat()
      .map((o) => o.id);
    if (removedOptionIds.length > 0) {
      await tx.supplementOption.deleteMany({
        where: { id: { in: removedOptionIds } },
      });
    }
  }
}
