// lib/purchase-drafts.ts
//
// Flux d'achat/dépense en deux temps (prepare → confirm), Phase 2 du refactor
// dépenses/achats : toute écriture sensible passe par un brouillon PERSISTÉ
// (`PurchaseDraft`, TTL = `ExpenseSettings.draftTtlMinutes`) plutôt qu'une
// création directe en un seul appel. Aucun effet sur le stock ici (pas de
// mutation `InventoryItem.currentQuantity`/`avgUnitCost` — Phase 3).
//
// Ne réimplémente AUCUNE logique métier existante : le rapprochement
// d'articles vit dans lib/expense-matching.ts, la conversion d'unités dans
// lib/expense-units.ts, la création de dépense (+ détail par article) dans
// lib/expense-mutations.ts::createExpense.

import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  parseDateOnlyToUTC,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import { getExpenseSettings } from '@/lib/expense-settings-db';
import { getPurchaseFrequency, listExpenses } from '@/lib/expenses';
import { createExpense } from '@/lib/expense-mutations';
import {
  resolveArticle,
  normalizeLabel,
  normalizeSupplierKey,
  type Article,
} from '@/lib/expense-matching';
import { toBaseQty } from '@/lib/expense-units';
import {
  preparePurchaseSchema,
  confirmPurchaseSchema,
  prepareOtherExpenseSchema,
  type PreparePurchaseInput,
  type PrepareOtherExpenseInput,
  type ConfirmPurchaseInput,
} from '@/lib/schemas/purchase';
import {
  resolveExpenseItemAmount,
  type ExpenseItemInput,
} from '@/lib/schemas/expense';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PurchaseLineStatus = 'matched' | 'ambiguous' | 'unmatched';

export type PurchaseLineSummary = {
  rawLabel: string;
  article: string | null;
  articleId: string | null;
  candidates?: { id: string; name: string }[];
  qtyBase: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineAmount: number | null;
  status: PurchaseLineStatus;
};

export type PurchaseWarningCode =
  | 'UNMATCHED_LINE'
  | 'AMBIGUOUS_LINE'
  | 'PRICE_ABERRANT'
  | 'SUM_MISMATCH'
  | 'DUPLICATE_SUSPECTED'
  | 'BULK_RECHUTE'
  | 'RECURRENCE_SUGGEST';

export type PurchaseWarning = {
  code: PurchaseWarningCode;
  message: string;
  lineIndex?: number;
};

export type PurchaseSummary = {
  lines: PurchaseLineSummary[];
  lineAmountSum: number;
  totalAmount: number | null;
};

/** Ligne « figée » à la préparation, réutilisée telle quelle par `confirmPurchase`
 * (sauf override explicite via `resolutions`). */
type PurchaseResolvedLine = {
  rawLabel: string;
  articleId: string | null;
  articleName: string | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number | null;
  status: PurchaseLineStatus;
};

type PurchaseDraftPayload = {
  input: PreparePurchaseInput;
  resolvedDate: string;
  summary: PurchaseSummary;
  resolvedLines: PurchaseResolvedLine[];
};

type OtherExpenseDraftPayload = {
  input: PrepareOtherExpenseInput;
  resolvedDate: string;
};

type DraftKind = 'purchase' | 'other_expense';

// ─── Claim atomique (anti double-confirm / anti-course avec l'expiration) ──────

/**
 * Marque le brouillon `confirmedAt` en une seule requête conditionnelle
 * (`updateMany` avec garde sur `confirmedAt: null` + `expiresAt` non dépassée).
 * `count === 0` signifie que le claim a échoué : on relit la ligne pour
 * distinguer inexistant / expiré / déjà confirmé et lever un message clair.
 */
async function claimDraft(draftId: string, kind: DraftKind) {
  const now = new Date();
  const claim = await prisma.purchaseDraft.updateMany({
    where: { id: draftId, kind, confirmedAt: null, expiresAt: { gt: now } },
    data: { confirmedAt: now },
  });

  if (claim.count === 0) {
    const existing = await prisma.purchaseDraft.findUnique({
      where: { id: draftId },
    });
    if (!existing || existing.kind !== kind) {
      throw new Error('Brouillon introuvable.');
    }
    if (existing.confirmedAt) {
      throw new Error('Ce brouillon a déjà été confirmé.');
    }
    if (existing.expiresAt <= now) {
      throw new Error(
        'Ce brouillon a expiré ; merci de relancer la préparation.'
      );
    }
    // Ne devrait pas arriver (les trois cas ci-dessus couvrent tous les échecs
    // possibles de la clause `where`), mais on garde un filet de sécurité.
    throw new Error('Impossible de confirmer ce brouillon.');
  }

  return prisma.purchaseDraft.findUniqueOrThrow({ where: { id: draftId } });
}

// ─── Préparation d'un achat (lignes détaillées) ────────────────────────────────

/** Compte les lignes NON rapprochées portant le même libellé brut ce mois-ci
 * (mois civil Abidjan en cours) — sert à suggérer la création d'une référence
 * dédiée quand une saisie libre revient souvent (`RECURRENCE_SUGGEST`). */
async function countUnmatchedRawLabelThisMonth(
  rawLabel: string
): Promise<number> {
  const monthStart = parseDateOnlyToUTC(`${todayDateString().slice(0, 7)}-01`)!;
  return prisma.expenseItem.count({
    where: {
      articleId: null,
      rawLabel: { equals: rawLabel, mode: 'insensitive' },
      expense: { date: { gte: monthStart } },
    },
  });
}

/**
 * Prépare un brouillon d'achat détaillé (N lignes) : rapproche chaque ligne au
 * référentiel d'articles (SANS jamais en créer — `resolveArticle`, lecture
 * seule), calcule les montants/quantités dérivables, produit des avertissements
 * de vigilance, et persiste tout dans un `PurchaseDraft` (TTL réglable).
 * N'écrit RIEN d'autre — ni Expense, ni ExpenseItem, ni ExpenseArticle.
 */
export async function preparePurchase(
  input: unknown,
  createdById?: string
): Promise<{
  draftId: string;
  expiresAt: Date;
  summary: PurchaseSummary;
  warnings: PurchaseWarning[];
}> {
  const data = preparePurchaseSchema.parse(input);
  const settings = await getExpenseSettings();
  const supplierKey = normalizeSupplierKey(data.supplier);
  const dateStr = data.date ?? todayDateString();
  const date = parseDateOnlyToUTC(dateStr)!;
  const recentFrom = parseDateOnlyToUTC(
    shiftDateString(dateStr, -settings.freqWindowDays)
  );

  const warnings: PurchaseWarning[] = [];
  const summaryLines: PurchaseLineSummary[] = [];
  const resolvedLines: PurchaseResolvedLine[] = [];

  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    const searchLabel = line.articleName ?? line.rawLabel;

    let matched: Article | null = null;
    let candidates: Article[] | null = null;
    if (line.articleId) {
      matched = await prisma.expenseArticle.findUnique({
        where: { id: line.articleId },
      });
    } else {
      const resolution = await resolveArticle({
        rawLabel: searchLabel,
        supplierKey,
      });
      if ('matched' in resolution) matched = resolution.matched;
      else if ('candidates' in resolution) candidates = resolution.candidates;
    }

    const status: PurchaseLineStatus = matched
      ? 'matched'
      : candidates && candidates.length > 0
        ? 'ambiguous'
        : 'unmatched';

    const qtyBase = toBaseQty({
      formatQty: line.formatQty ?? null,
      formatSize: line.formatSize ?? null,
      unit: line.unit ?? null,
      baseUnit: matched?.baseUnit ?? line.unit ?? null,
    });

    const lineAmount = resolveExpenseItemAmount({
      amount: line.amount ?? null,
      formatQty: line.formatQty ?? null,
      formatSize: line.formatSize ?? null,
      unitPrice: line.unitPrice ?? null,
    });

    summaryLines.push({
      rawLabel: line.rawLabel,
      article: matched?.name ?? null,
      articleId: matched?.id ?? null,
      ...(candidates
        ? { candidates: candidates.map((c) => ({ id: c.id, name: c.name })) }
        : {}),
      qtyBase,
      unit: line.unit ?? null,
      unitPrice: line.unitPrice ?? null,
      lineAmount,
      status,
    });

    resolvedLines.push({
      rawLabel: line.rawLabel,
      articleId: matched?.id ?? null,
      articleName: line.articleName ?? null,
      formatQty: line.formatQty ?? null,
      formatSize: line.formatSize ?? null,
      unit: line.unit ?? null,
      unitPrice: line.unitPrice ?? null,
      amount: line.amount ?? null,
      status,
    });

    if (status === 'unmatched') {
      warnings.push({
        code: 'UNMATCHED_LINE',
        lineIndex: i,
        message: `Ligne « ${line.rawLabel} » : aucun article correspondant, un nouvel article sera créé à la confirmation (sauf résolution explicite).`,
      });
      const priorHits = await countUnmatchedRawLabelThisMonth(line.rawLabel);
      const totalHits = priorHits + 1;
      if (totalHits >= settings.recurrenceSuggestMinHits) {
        warnings.push({
          code: 'RECURRENCE_SUGGEST',
          lineIndex: i,
          message: `« ${line.rawLabel} » a été acheté ${totalHits} fois ce mois-ci sans article rapproché : envisagez de créer une référence dédiée.`,
        });
      }
    } else if (status === 'ambiguous') {
      warnings.push({
        code: 'AMBIGUOUS_LINE',
        lineIndex: i,
        message: `Ligne « ${line.rawLabel} » : ${candidates!.length} article(s) possible(s), précisez articleId à la confirmation.`,
      });
    }

    if (matched?.bulkPurchase) {
      warnings.push({
        code: 'BULK_RECHUTE',
        lineIndex: i,
        message: `« ${matched.name} » est habituellement acheté en gros : vérifiez qu'un réappro est nécessaire avant de confirmer.`,
      });
    }

    if (matched && line.unitPrice != null && recentFrom) {
      const stats = await getPurchaseFrequency(matched.id, {
        from: recentFrom,
        to: date,
      });
      const avg = stats[0]?.avgUnitPrice ?? null;
      if (
        avg != null &&
        avg > 0 &&
        line.unitPrice > avg * settings.priceAberrantFactor
      ) {
        warnings.push({
          code: 'PRICE_ABERRANT',
          lineIndex: i,
          message: `Ligne « ${line.rawLabel} » : prix unitaire (${line.unitPrice} F) très supérieur au prix moyen récent de « ${matched.name} » (${avg} F).`,
        });
      }
    }
  }

  const lineAmountSum = summaryLines.reduce(
    (s, l) => s + (l.lineAmount ?? 0),
    0
  );
  const hasUnknownAmount = summaryLines.some((l) => l.lineAmount == null);
  if (
    data.totalAmount != null &&
    !hasUnknownAmount &&
    lineAmountSum !== data.totalAmount
  ) {
    warnings.push({
      code: 'SUM_MISMATCH',
      message: `La somme des lignes (${lineAmountSum} F) ne correspond pas au montant total indiqué (${data.totalAmount} F).`,
    });
  }

  const totalForDuplicateCheck =
    data.totalAmount ?? (hasUnknownAmount ? null : lineAmountSum);
  if (data.supplier && totalForDuplicateCheck != null) {
    const supplierNorm = normalizeLabel(data.supplier);
    const { expenses } = await listExpenses({ dateFrom: date, dateTo: date });
    const duplicate = expenses.find(
      (e) =>
        e.supplier &&
        normalizeLabel(e.supplier) === supplierNorm &&
        e.amount === totalForDuplicateCheck
    );
    if (duplicate) {
      warnings.push({
        code: 'DUPLICATE_SUSPECTED',
        message: `Une dépense similaire existe déjà ce jour pour ${data.supplier} (${totalForDuplicateCheck} F, reçu ${duplicate.receiptNo ?? duplicate.id}).`,
      });
    }
  }

  const summary: PurchaseSummary = {
    lines: summaryLines,
    lineAmountSum,
    totalAmount: data.totalAmount ?? null,
  };
  const payload: PurchaseDraftPayload = {
    input: data,
    resolvedDate: dateStr,
    summary,
    resolvedLines,
  };

  const expiresAt = new Date(Date.now() + settings.draftTtlMinutes * 60_000);
  const draft = await prisma.purchaseDraft.create({
    data: {
      kind: 'purchase',
      payload: payload as unknown as Prisma.InputJsonValue,
      expiresAt,
      createdById: createdById ?? null,
    },
  });

  return { draftId: draft.id, expiresAt: draft.expiresAt, summary, warnings };
}

/**
 * Confirme un brouillon d'achat : applique les résolutions (exclusion,
 * override d'article/quantité/montant par index de ligne), construit les
 * `items[]` et délègue la création à `createExpense` (qui gère lui-même le
 * rapprochement final d'article — `ensureArticle` — et le calcul de
 * `qtyBase`). Aucun effet sur le stock (Phase 3, hors périmètre).
 */
export async function confirmPurchase(
  draftId: string,
  resolutions?: NonNullable<ConfirmPurchaseInput['resolutions']>,
  createdById?: string
) {
  // Validation défensive des résolutions (l'appelant MCP les valide déjà via
  // `confirmPurchaseSchema`, mais cette fonction reste appelable directement).
  const parsedResolutions = resolutions
    ? confirmPurchaseSchema.shape.resolutions.parse(resolutions)
    : undefined;

  const draft = await claimDraft(draftId, 'purchase');
  const payload = draft.payload as unknown as PurchaseDraftPayload;

  const resByIndex = new Map(
    (parsedResolutions?.lines ?? []).map((r) => [r.index, r])
  );

  const items: ExpenseItemInput[] = [];
  for (let i = 0; i < payload.resolvedLines.length; i++) {
    const base = payload.resolvedLines[i];
    const res = resByIndex.get(i);
    if (res?.excluded) continue;

    const formatQty = res?.formatQty ?? base.formatQty ?? undefined;
    const formatSize = res?.formatSize ?? base.formatSize ?? undefined;
    const unitPrice = res?.unitPrice ?? base.unitPrice ?? undefined;
    const amountOverride = res?.amount ?? base.amount ?? undefined;

    const amount = resolveExpenseItemAmount({
      amount: amountOverride ?? null,
      formatQty: formatQty ?? null,
      formatSize: formatSize ?? null,
      unitPrice: unitPrice ?? null,
    });
    if (amount == null) {
      throw new Error(
        `Ligne « ${base.rawLabel} » : montant manquant (indiquer un montant, ou un prix unitaire avec une quantité).`
      );
    }

    const item: ExpenseItemInput = { rawLabel: base.rawLabel, amount };

    const articleId =
      res?.articleId ??
      (res?.articleName ? undefined : (base.articleId ?? undefined));
    const articleName =
      res?.articleName ??
      (articleId ? undefined : (base.articleName ?? undefined));
    if (articleId) item.articleId = articleId;
    else if (articleName) item.articleName = articleName;

    if (formatQty != null) item.formatQty = formatQty;
    if (formatSize != null) item.formatSize = formatSize;
    if (base.unit) item.unit = base.unit;
    if (unitPrice != null) item.unitPrice = unitPrice;
    // Montant connu mais quantité pas (encore) renseignée : à compléter plus
    // tard (cf. `ExpenseItem.pendingQuantity`).
    if (formatQty == null) item.pendingQuantity = true;

    items.push(item);
  }

  if (items.length === 0) {
    throw new Error(
      'Toutes les lignes ont été exclues : aucun achat à enregistrer.'
    );
  }

  const lineSum = items.reduce((s, it) => s + (it.amount ?? 0), 0);
  if (
    parsedResolutions?.totalAmount != null &&
    parsedResolutions.totalAmount !== lineSum
  ) {
    throw new Error(
      `Le total fourni (${parsedResolutions.totalAmount} F) ne correspond pas à la somme des lignes (${lineSum} F).`
    );
  }
  const amount = parsedResolutions?.totalAmount ?? lineSum;

  const input = payload.input;
  return createExpense(
    {
      date: payload.resolvedDate,
      amount,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      supplier: input.supplier ?? null,
      items,
    },
    createdById
  );
}

// ─── Dépense simple (sans lignes) ──────────────────────────────────────────────

/**
 * Prépare un brouillon de dépense « globale » (pas de détail par article) :
 * pas de rapprochement, juste une validation + persistance du brouillon.
 */
export async function prepareOtherExpense(
  input: unknown,
  createdById?: string
): Promise<{
  draftId: string;
  expiresAt: Date;
  summary: {
    date: string;
    amount: number;
    categoryId: string;
    paymentMethod: string;
    supplier: string | null;
    note: string | null;
  };
}> {
  const data = prepareOtherExpenseSchema.parse(input);
  const settings = await getExpenseSettings();
  const dateStr = data.date ?? todayDateString();

  const summary = {
    date: dateStr,
    amount: data.amount,
    categoryId: data.categoryId,
    paymentMethod: data.paymentMethod ?? 'CASH',
    supplier: data.supplier ?? null,
    note: data.note ?? null,
  };

  const payload: OtherExpenseDraftPayload = {
    input: data,
    resolvedDate: dateStr,
  };
  const expiresAt = new Date(Date.now() + settings.draftTtlMinutes * 60_000);
  const draft = await prisma.purchaseDraft.create({
    data: {
      kind: 'other_expense',
      payload: payload as unknown as Prisma.InputJsonValue,
      expiresAt,
      createdById: createdById ?? null,
    },
  });

  return { draftId: draft.id, expiresAt: draft.expiresAt, summary };
}

/** Confirme un brouillon de dépense simple : aucune résolution possible (pas
 * de lignes), juste le claim atomique puis `createExpense`. */
export async function confirmOtherExpense(
  draftId: string,
  createdById?: string
) {
  const draft = await claimDraft(draftId, 'other_expense');
  const payload = draft.payload as unknown as OtherExpenseDraftPayload;
  const input = payload.input;

  return createExpense(
    {
      date: payload.resolvedDate,
      amount: input.amount,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      supplier: input.supplier ?? null,
      note: input.note ?? null,
    },
    createdById
  );
}

// ─── Purge (cron, câblage hors périmètre de ce step) ───────────────────────────

/** Supprime les brouillons expirés jamais confirmés. Idempotent. */
export async function purgeExpiredDrafts(): Promise<{ deleted: number }> {
  const result = await prisma.purchaseDraft.deleteMany({
    where: { expiresAt: { lt: new Date() }, confirmedAt: null },
  });
  return { deleted: result.count };
}
