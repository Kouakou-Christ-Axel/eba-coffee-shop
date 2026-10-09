import { Prisma } from '@/generated/prisma/client';

/** Decimal Prisma → number (les quantités stock tiennent largement dans un float). */
export function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}
