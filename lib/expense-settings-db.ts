// lib/expense-settings-db.ts
import prisma from '@/lib/prisma';
import {
  DEFAULT_EXPENSE_SETTINGS,
  expenseSettingsFromRow,
  expenseSettingsSchema,
  type ExpenseSettings,
} from '@/lib/expense-settings';

export async function getExpenseSettings(): Promise<ExpenseSettings> {
  const row = await prisma.expenseSettings.findUnique({
    where: { id: 'singleton' },
  });
  return expenseSettingsFromRow(row);
}

export async function updateExpenseSettings(
  input: unknown
): Promise<ExpenseSettings> {
  const data = expenseSettingsSchema.parse(input);
  const row = await prisma.expenseSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  return expenseSettingsFromRow(row);
}

export { DEFAULT_EXPENSE_SETTINGS };
