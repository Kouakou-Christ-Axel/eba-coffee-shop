// lib/expense-article-analytics.ts
//
// Agrégats « fiche article » dérivés de l'historique d'achat détaillé d'un
// article (lignes `ExpenseItem`) : courbe de prix, quantités/montants par mois,
// prix par fournisseur, KPIs (min/max/dernier prix, variation, réappro estimé).
// Fonction PURE (aucun accès Prisma / Date.now), branchée par la section
// serveur du drill-down et testée unitairement.

/** Prix unitaire = `amount / qtyBase` (comparable quel que soit le format
 * d'achat) ; les lignes sans `qtyBase` en sont exclues. */
export type ArticleAnalyticsLine = {
  /** Date de la dépense (YYYY-MM-DD). */
  date: string;
  amount: number;
  qtyBase: number | null;
  supplier: string | null;
};

export type ArticleAnalytics = {
  /** Prix unitaire (F / unité de base) par achat, trié chronologiquement. */
  pricePoints: { date: string; unitPrice: number }[];
  /** Montant + quantité cumulés par mois civil (YYYY-MM), triés. */
  monthly: { month: string; amount: number; qty: number }[];
  /** Prix unitaire moyen pondéré par fournisseur, trié par nombre d'achats. */
  bySupplier: { supplier: string; avgUnitPrice: number; count: number }[];
  /** Prix unitaire moyen pondéré global (F / unité de base). */
  avgUnitPrice: number | null;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
  firstUnitPrice: number | null;
  lastUnitPrice: number | null;
  /** Variation % entre le premier et le dernier prix unitaire. */
  priceChangePct: number | null;
  /** Nombre de jours d'achats distincts espacés en moyenne (null si < 2). */
  avgIntervalDays: number | null;
  /** Jours écoulés depuis le dernier achat. */
  daysSinceLast: number | null;
  /** Réappro estimé : `avgIntervalDays − daysSinceLast` (négatif = en retard). */
  dueInDays: number | null;
  lineCount: number;
  missingQtyCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SUPPLIER_UNKNOWN = 'Inconnu';

/** YYYY-MM-DD → ms UTC (minuit). NaN si invalide. */
function dateToMs(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, day ?? 1);
}

/** YYYY-MM-DD → mois civil YYYY-MM. */
function monthOf(d: string): string {
  return d.slice(0, 7);
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Construit les agrégats « fiche article » à partir des lignes d'achat.
 * `today` (YYYY-MM-DD, fuseau Abidjan) est injecté pour rester pur/testable.
 */
export function buildArticleAnalytics(
  lines: ArticleAnalyticsLine[],
  today: string
): ArticleAnalytics {
  const withQty = lines.filter(
    (l) => l.qtyBase != null && l.qtyBase > 0 && Number.isFinite(l.amount)
  ) as {
    date: string;
    amount: number;
    qtyBase: number;
    supplier: string | null;
  }[];

  // ── Courbe de prix (F / unité de base), triée chronologiquement ──
  const pricePoints = withQty
    .map((l) => ({ date: l.date, unitPrice: round(l.amount / l.qtyBase) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const prices = pricePoints.map((p) => p.unitPrice);
  const minUnitPrice = prices.length ? Math.min(...prices) : null;
  const maxUnitPrice = prices.length ? Math.max(...prices) : null;
  const firstUnitPrice = prices.length ? prices[0] : null;
  const lastUnitPrice = prices.length ? prices[prices.length - 1] : null;
  const priceChangePct =
    firstUnitPrice != null && lastUnitPrice != null && firstUnitPrice > 0
      ? Math.round(((lastUnitPrice - firstUnitPrice) / firstUnitPrice) * 100)
      : null;

  const totalQty = withQty.reduce((s, l) => s + l.qtyBase, 0);
  const totalAmountWithQty = withQty.reduce((s, l) => s + l.amount, 0);
  const avgUnitPrice =
    totalQty > 0 ? round(totalAmountWithQty / totalQty) : null;

  // ── Montant + quantité par mois ──
  const monthMap = new Map<string, { amount: number; qty: number }>();
  for (const l of lines) {
    const key = monthOf(l.date);
    const acc = monthMap.get(key) ?? { amount: 0, qty: 0 };
    acc.amount += Number.isFinite(l.amount) ? l.amount : 0;
    if (l.qtyBase != null && l.qtyBase > 0) acc.qty += l.qtyBase;
    monthMap.set(key, acc);
  }
  const monthly = [...monthMap.entries()]
    .map(([month, v]) => ({
      month,
      amount: v.amount,
      qty: Math.round(v.qty * 1000) / 1000,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ── Prix moyen par fournisseur (lignes avec quantité) ──
  const supplierMap = new Map<
    string,
    { amount: number; qty: number; count: number }
  >();
  for (const l of withQty) {
    const key = l.supplier?.trim() || SUPPLIER_UNKNOWN;
    const acc = supplierMap.get(key) ?? { amount: 0, qty: 0, count: 0 };
    acc.amount += l.amount;
    acc.qty += l.qtyBase;
    acc.count++;
    supplierMap.set(key, acc);
  }
  const bySupplier = [...supplierMap.entries()]
    .map(([supplier, v]) => ({
      supplier,
      avgUnitPrice: v.qty > 0 ? round(v.amount / v.qty) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count || a.avgUnitPrice - b.avgUnitPrice);

  // ── Cadence / réappro (dates d'achat distinctes) ──
  const uniqueDays = [...new Set(lines.map((l) => l.date))].sort();
  let avgIntervalDays: number | null = null;
  if (uniqueDays.length >= 2) {
    const span =
      (dateToMs(uniqueDays[uniqueDays.length - 1]) - dateToMs(uniqueDays[0])) /
      DAY_MS;
    avgIntervalDays = Math.round((span / (uniqueDays.length - 1)) * 10) / 10;
  }
  const lastDay = uniqueDays.length ? uniqueDays[uniqueDays.length - 1] : null;
  const daysSinceLast =
    lastDay != null
      ? Math.max(0, Math.round((dateToMs(today) - dateToMs(lastDay)) / DAY_MS))
      : null;
  const dueInDays =
    avgIntervalDays != null && daysSinceLast != null
      ? Math.round(avgIntervalDays - daysSinceLast)
      : null;

  return {
    pricePoints,
    monthly,
    bySupplier,
    avgUnitPrice,
    minUnitPrice,
    maxUnitPrice,
    firstUnitPrice,
    lastUnitPrice,
    priceChangePct,
    avgIntervalDays,
    daysSinceLast,
    dueInDays,
    lineCount: lines.length,
    missingQtyCount: lines.filter((l) => l.qtyBase == null).length,
  };
}
