import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  parseDateOnlyToUTC,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import { getExpenseSettings } from '@/lib/expense-settings-db';
import { getPurchaseFrequency, listExpenses } from '@/lib/expenses';
import {
  resolveArticle,
  normalizeLabel,
  normalizeSupplierKey,
  type Article,
} from '@/lib/expense-matching';
import { toBaseQty } from '@/lib/expense-units';
import { preparePurchaseSchema } from '@/lib/schemas/purchase';
import { resolveExpenseItemAmount } from '@/lib/schemas/expense';
import type {
  PurchaseLineStatus,
  PurchaseLineSummary,
  PurchaseWarning,
  PurchaseSummary,
  PurchaseResolvedLine,
  PurchaseDraftPayload,
} from './types';
import { countUnmatchedRawLabelThisMonth } from './draft-store';

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
