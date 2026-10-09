import { createExpense } from '@/lib/expense-mutations';
import {
  confirmPurchaseSchema,
  type ConfirmPurchaseInput,
} from '@/lib/schemas/purchase';
import {
  resolveExpenseItemAmount,
  type ExpenseItemInput,
} from '@/lib/schemas/expense';
import type { PurchaseDraftPayload } from './types';
import { claimDraft } from './draft-store';

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
