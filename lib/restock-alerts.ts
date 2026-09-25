// lib/restock-alerts.ts
//
// « Préviens-moi quand c'est de retour » : un visiteur de la carte, sans
// compte, laisse une alerte sur un produit épuisé (ou un goût épuisé). Dès que
// le stock revient, son appareil reçoit une notification push qui le ramène
// sur la fiche produit (`/carte?p=<id>`, cf. product-deep-link.tsx).
//
// Déclenchement : `triggerRestockAlerts()` est appelé après CHAQUE mutation
// qui peut remonter un stock ou lever une pause (lib/menu-mutations.ts,
// lib/global-extras-mutations.ts) — ce qui couvre le dashboard, la caisse et
// les outils MCP d'un seul coup. Pas besoin de détecter le passage exact
// 0 → >0 : on revérifie l'état COURANT de chaque cible en attente, et une
// alerte est supprimée dès son envoi (usage unique). La table ne contient que
// des attentes en cours — petite par construction (TTL + plafond par
// appareil).

import prisma from '@/lib/prisma';
import { sendPushToEndpoints } from '@/lib/push-notify';
import {
  RESTOCK_ALERT_MAX_PER_ENDPOINT,
  RESTOCK_ALERT_TTL_DAYS,
} from '@/config/constants';
import {
  restockTargetKey,
  type PushSubscriptionInput,
  type RestockAlertTarget,
} from '@/lib/schemas/push';

export { restockTargetKey };

export class RestockAlertError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = 'RestockAlertError';
  }
}

type ProductState = {
  available: boolean;
  deletedAt: Date | null;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
};

/**
 * La cible est-elle de nouveau commandable AUJOURD'HUI ? Produit présent,
 * actif, pas en pause, stock illimité ou positif — et, pour un goût, l'option
 * aussi (`undefined` = introuvable). Pur.
 */
export function isTargetBackInStock(
  product: ProductState | undefined,
  option: { stockQuantity: number | null } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!product || !product.available || product.deletedAt) return false;
  if (product.unavailableUntil && product.unavailableUntil > now) return false;
  if (product.stockQuantity !== null && product.stockQuantity <= 0) {
    return false;
  }
  if (option === null) return true; // alerte sur le produit lui-même
  if (!option) return false;
  return option.stockQuantity === null || option.stockQuantity > 0;
}

type OptionRow = { name: string; stockQuantity: number | null };
type GroupRow = { name: string; options: OptionRow[] };

/** Même résolution par noms que le décrément en cuisine : groupe propre au
 * produit d'abord, puis groupes globaux (« Extras »), option la plus ancienne. */
function findOption(
  groups: GroupRow[],
  groupName: string,
  optionName: string
): OptionRow | undefined {
  return groups
    .filter((g) => g.name === groupName)
    .flatMap((g) => g.options)
    .find((o) => o.name === optionName);
}

const OPTIONS_SELECT = {
  name: true,
  options: {
    where: { available: true },
    select: { name: true, stockQuantity: true },
    orderBy: { id: 'asc' as const },
  },
};

async function loadTargets(productIds: string[]) {
  const [products, globalGroups] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        available: true,
        deletedAt: true,
        stockQuantity: true,
        unavailableUntil: true,
        supplementGroups: { select: OPTIONS_SELECT },
      },
    }),
    prisma.supplementGroup.findMany({
      where: { isGlobal: true },
      select: OPTIONS_SELECT,
    }),
  ]);
  return new Map(
    products.map((p) => [
      p.id,
      { ...p, groups: [...p.supplementGroups, ...globalGroups] },
    ])
  );
}

// ─── Inscription / désinscription ────────────────────────────────────────────

/**
 * Enregistre (ou rafraîchit) l'alerte de cet appareil sur `target`. Refusée
 * si la cible n'est PAS épuisée (409 : le client peut commander tout de
 * suite), si le produit n'existe pas (404), ou au-delà du plafond par
 * appareil (429).
 */
export async function saveRestockAlert(
  target: RestockAlertTarget,
  subscription: PushSubscriptionInput
): Promise<void> {
  const product = (await loadTargets([target.productId])).get(target.productId);
  if (!product || !product.available || product.deletedAt) {
    throw new RestockAlertError('Produit introuvable', 404);
  }
  const option =
    target.groupName && target.optionName
      ? findOption(product.groups, target.groupName, target.optionName)
      : null;
  if (option === undefined) {
    throw new RestockAlertError('Goût introuvable', 404);
  }
  // On n'attend que ce qui manque pour une question de STOCK (une pause ou
  // un planning ont déjà leur date de retour affichée).
  const soldOut = option
    ? option.stockQuantity === 0
    : product.stockQuantity === 0;
  if (!soldOut) {
    throw new RestockAlertError(
      `${option ? target.optionName : product.name} est disponible : commande-le dès maintenant.`,
      409
    );
  }

  const targetKey = restockTargetKey(target);
  const endpoint = subscription.endpoint;
  const existing = await prisma.restockAlert.findUnique({
    where: { endpoint_targetKey: { endpoint, targetKey } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.restockAlert.count({ where: { endpoint } });
    if (count >= RESTOCK_ALERT_MAX_PER_ENDPOINT) {
      throw new RestockAlertError(
        'Tu as déjà beaucoup d’alertes en attente sur cet appareil.',
        429
      );
    }
  }

  const data = {
    productId: target.productId,
    groupName: target.groupName ?? null,
    optionName: target.optionName ?? null,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  };
  await prisma.restockAlert.upsert({
    where: { endpoint_targetKey: { endpoint, targetKey } },
    create: { ...data, targetKey, endpoint },
    // Rafraîchir `createdAt` relance le délai de vie de l'alerte.
    update: { ...data, createdAt: new Date() },
  });
}

export async function removeRestockAlert(
  target: RestockAlertTarget,
  endpoint: string
): Promise<void> {
  await prisma.restockAlert.deleteMany({
    where: { endpoint, targetKey: restockTargetKey(target) },
  });
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

/**
 * Parcourt les alertes en attente et prévient celles dont la cible est de
 * retour. Chaque alerte est supprimée AVANT l'envoi, et seulement si la
 * suppression l'a bien trouvée : deux déclenchements concurrents ne
 * notifient jamais deux fois. Renvoie le nombre de notifications envoyées.
 */
export async function notifyRestockAlerts(
  now: Date = new Date()
): Promise<number> {
  await prisma.restockAlert.deleteMany({
    where: {
      createdAt: {
        lt: new Date(now.getTime() - RESTOCK_ALERT_TTL_DAYS * 86_400_000),
      },
    },
  });

  const alerts = await prisma.restockAlert.findMany();
  if (alerts.length === 0) return 0;

  const targets = await loadTargets([
    ...new Set(alerts.map((a) => a.productId)),
  ]);
  let sent = 0;
  for (const alert of alerts) {
    const product = targets.get(alert.productId);
    const option =
      product && alert.groupName && alert.optionName
        ? findOption(product.groups, alert.groupName, alert.optionName)
        : null;
    if (!isTargetBackInStock(product, option, now)) continue;

    const { count } = await prisma.restockAlert.deleteMany({
      where: { id: alert.id },
    });
    if (count === 0) continue; // déjà traitée par un déclenchement parallèle

    const label = alert.optionName
      ? `${product!.name} (${alert.optionName})`
      : product!.name;
    await sendPushToEndpoints([alert], {
      title: `${label} est de retour !`,
      body: 'Il y en a de nouveau : premier arrivé, premier servi.',
      url: `/carte?p=${alert.productId}`,
      tag: `restock-${alert.targetKey}`,
    });
    sent++;
  }
  return sent;
}

/**
 * À appeler après toute mutation susceptible de remettre un article en
 * stock. Fire-and-forget : une alerte ratée ne doit jamais faire échouer le
 * geste du staff.
 */
export function triggerRestockAlerts(): void {
  notifyRestockAlerts().catch((err) => {
    console.error('[restock-alerts] envoi échoué :', err);
  });
}
