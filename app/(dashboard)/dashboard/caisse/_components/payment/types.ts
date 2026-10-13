import type { PaymentMode } from '@/generated/prisma/client';

export type PaymentLine = { mode: PaymentMode; amount: number };

export type Line = { mode: PaymentMode | null; amount: number };
