import { expect, type MockedFunction } from 'vitest';
import { unwrapStaffVisible } from '@/lib/orders/visibility.test-utils';
import prisma from '@/lib/prisma';

export const mockFindMany = prisma.order.findMany as MockedFunction<
  typeof prisma.order.findMany
>;

export type Row = {
  id: string;
  reference: string;
  dailyNumber: number;
  status: string;
  total: number;
  isOnAccount: boolean;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    isTrusted: boolean;
  } | null;
};

/** Ligne par défaut = le cas nominal de l'ardoise : récupérée et impayée. */
export function row(over: Partial<Row> & Pick<Row, 'id' | 'createdAt'>): Row {
  return {
    reference: `EBA-${over.id}`,
    dailyNumber: 1,
    status: 'COMPLETED',
    total: 1000,
    isOnAccount: true,
    customerName: null,
    customerPhone: null,
    customer: null,
    ...over,
  } as Row;
}

export const AWA = {
  id: 'cust-awa',
  name: 'Awa',
  phone: '+2250708090910',
  isTrusted: true,
};
export const KOFFI = {
  id: 'cust-koffi',
  name: 'Koffi',
  phone: '+2250501020304',
  isTrusted: false,
};

/** Clause `where` réellement envoyée à Prisma au dernier appel. */
export function lastWhere(): Record<string, unknown> {
  const args = mockFindMany.mock.calls.at(-1)?.[0] as {
    where: Record<string, unknown>;
  };
  return unwrapStaffVisible(args.where);
}

/** Les deux branches du `OR` : [dette, à vérifier]. */
export function lastBranches(): [
  Record<string, unknown>,
  Record<string, unknown>,
] {
  const or = lastWhere().OR as Record<string, unknown>[];
  expect(or).toHaveLength(2);
  return [or[0], or[1]];
}
