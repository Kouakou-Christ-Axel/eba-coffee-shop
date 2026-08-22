// lib/stats-excel.ts
//
// Construction du classeur Excel (.xlsx) "Rapport bancaire" : synthèse
// financière consolidée sur une plage de dates, destinée à un dossier de
// financement. Server-only (dépend de `xlsx`/SheetJS). Comme
// lib/inventory-excel.ts, ce module ne fait QUE de la sérialisation — les
// agrégats viennent tels quels de lib/stats.ts, lib/stats-compare.ts,
// lib/expenses.ts, lib/investments.ts, lib/stats-customers.ts et
// lib/revenue-adjustments.ts (aucune requête Prisma ici).

import * as XLSX from 'xlsx';
import type { RangeStats, DailyPoint, TopProduct } from '@/lib/stats';
import type { ExpenseSummary } from '@/lib/expenses';
import type { InvestmentSummary } from '@/lib/investments';
import type { CustomerRangeStats } from '@/lib/stats-customers';
import type { RevenueAdjustmentSummary } from '@/lib/revenue-adjustments';

export type BankReportInput = {
  fromStr: string;
  toStr: string;
  isAll: boolean;
  range: RangeStats;
  previousRange: RangeStats | null;
  dailySeries: DailyPoint[];
  topProducts: TopProduct[];
  expenseSummary: ExpenseSummary;
  investmentSummary: InvestmentSummary;
  customerStats: CustomerRangeStats;
  revenueAdjustments: RevenueAdjustmentSummary;
};

function sheetFromRows(
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[]
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
  return ws;
}

// ─── Onglet Synthèse ───────────────────────────────────────────────────────

function buildSummarySheet(input: BankReportInput): XLSX.WorkSheet {
  const { range, previousRange, revenueAdjustments } = input;
  const netMargin = range.revenue - input.expenseSummary.total;
  const netMarginPct =
    range.revenue > 0 ? Math.round((netMargin / range.revenue) * 100) : null;

  const rows: (string | number)[][] = [
    [
      'Période',
      input.isAll ? 'Depuis le début' : `Du ${input.fromStr} au ${input.toStr}`,
    ],
    ['CA encaissé (FCFA)', range.revenue],
    ['dont régularisations de recette (FCFA)', revenueAdjustments.total],
    ['Dépenses (FCFA)', input.expenseSummary.total],
    ['  dont fixes (FCFA)', input.expenseSummary.fixed],
    ['  dont variables (FCFA)', input.expenseSummary.variable],
    ['Marge nette (FCFA)', netMargin],
    ['Marge nette (% du CA)', netMarginPct ?? '—'],
    ['Commandes', range.totalOrders],
    ['Panier moyen (FCFA)', range.avgBasket],
    ["Taux d'annulation (%)", Math.round(range.cancellationRate * 100)],
  ];

  if (previousRange) {
    rows.push(
      [''],
      ['Période précédente (comparaison)', ''],
      ['CA encaissé période précédente (FCFA)', previousRange.revenue],
      ['Commandes période précédente', previousRange.totalOrders]
    );
  }

  return sheetFromRows(['Indicateur', 'Valeur'], rows, [40, 20]);
}

// ─── Onglet CA quotidien ────────────────────────────────────────────────────

function buildDailySeriesSheet(dailySeries: DailyPoint[]): XLSX.WorkSheet {
  const rows = dailySeries.map((p) => [p.date, p.orders, p.revenue]);
  return sheetFromRows(
    ['Date', 'Commandes', 'CA encaissé (FCFA)'],
    rows,
    [14, 12, 18]
  );
}

// ─── Onglet Ventes par produit ──────────────────────────────────────────────

function buildTopProductsSheet(topProducts: TopProduct[]): XLSX.WorkSheet {
  const rows = topProducts.map((p) => [p.name, p.quantity, p.revenue]);
  return sheetFromRows(
    ['Produit', 'Quantité vendue', 'CA (FCFA)'],
    rows,
    [30, 16, 16]
  );
}

// ─── Onglet Dépenses par catégorie ──────────────────────────────────────────

const EXPENSE_NATURE_LABELS: Record<string, string> = {
  FIXED: 'Fixe',
  VARIABLE: 'Variable',
};

function buildExpensesSheet(summary: ExpenseSummary): XLSX.WorkSheet {
  const rows = summary.byCategory.map((c) => [
    c.name,
    EXPENSE_NATURE_LABELS[c.nature] ?? c.nature,
    c.amount,
    c.count,
  ]);
  rows.push(['Total', '', summary.total, '']);
  return sheetFromRows(
    ['Catégorie', 'Nature', 'Montant (FCFA)', 'Nombre'],
    rows,
    [26, 12, 16, 10]
  );
}

// ─── Onglet Investissements & apports ───────────────────────────────────────

function buildInvestmentsSheet(summary: InvestmentSummary): XLSX.WorkSheet {
  const rows = summary.bySource.map((s) => [s.name, s.amount]);
  rows.push(['Total', summary.total]);
  rows.push([
    'Solde restant dû (apports remboursables)',
    summary.totalOutstanding,
  ]);
  return sheetFromRows(['Source', 'Montant (FCFA)'], rows, [32, 20]);
}

// ─── Onglet Clients & fidélité ───────────────────────────────────────────────

function buildCustomersSheet(stats: CustomerRangeStats): XLSX.WorkSheet {
  const kpiRows: (string | number)[][] = [
    ['Nouveaux clients', stats.newCustomers],
    ['Clients actifs', stats.activeCustomers],
    ['Clients récurrents (≥ 2 commandes)', stats.returningCustomers],
    ['Commandes identifiées', stats.identifiedOrders],
    ["Taux d'identification (%)", Math.round(stats.identificationRate * 100)],
    ['Tampons de fidélité gagnés', stats.loyalty.stampsEarned],
    ['Récompenses débloquées', stats.loyalty.rewardsEarned],
    ['Récompenses utilisées', stats.loyalty.rewardsUsed],
    [''],
    ['Meilleurs clients', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([['Indicateur', 'Valeur'], ...kpiRows]);

  const topRows = stats.topCustomers.map((c) => [
    c.name ?? '—',
    c.phone,
    c.orders,
    c.revenue,
  ]);
  XLSX.utils.sheet_add_aoa(
    ws,
    [['Nom', 'Téléphone', 'Commandes', 'CA (FCFA)'], ...topRows],
    { origin: -1 }
  );

  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  return ws;
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

export function buildBankReportWorkbook(input: BankReportInput): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(input), 'Synthèse');
  XLSX.utils.book_append_sheet(
    wb,
    buildDailySeriesSheet(input.dailySeries),
    'CA quotidien'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTopProductsSheet(input.topProducts),
    'Ventes par produit'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildExpensesSheet(input.expenseSummary),
    'Dépenses'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildInvestmentsSheet(input.investmentSummary),
    'Investissements'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildCustomersSheet(input.customerStats),
    'Clients & fidélité'
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
