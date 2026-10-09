import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { todayDateString } from '@/lib/timezone';
import { getExpenseSettings } from '@/lib/expense-settings-db';
import { createExpense } from '@/lib/expense-mutations';
import { prepareOtherExpenseSchema } from '@/lib/schemas/purchase';
import type { OtherExpenseDraftPayload } from './types';
import { claimDraft } from './draft-store';

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
