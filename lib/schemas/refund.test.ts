import { describe, expect, it } from 'vitest';
import {
  RefundDelivery,
  RefundLineKind,
  RefundReason,
  RefundSource,
  RefundStatus,
} from '@/generated/prisma/enums';
import {
  ACTIVE_REFUND_STATUSES,
  REFUND_DELIVERIES,
  REFUND_LINE_KINDS,
  REFUND_REASONS,
  REFUND_REASON_LABELS,
  REFUND_SOURCES,
  REFUND_STATUSES,
  createRefundSchema,
  updateRefundDestinationSchema,
} from './refund';

describe('miroirs des enums Prisma', () => {
  it.each([
    ['statuts', REFUND_STATUSES, RefundStatus],
    ['modes d’envoi', REFUND_DELIVERIES, RefundDelivery],
    ['motifs', REFUND_REASONS, RefundReason],
    ['sources', REFUND_SOURCES, RefundSource],
    ['natures de ligne', REFUND_LINE_KINDS, RefundLineKind],
  ])('%s : aucun oubli ni doublon', (_n, list, prisma) => {
    expect([...list].sort()).toEqual(Object.values(prisma).sort());
  });

  it('libelle chaque motif', () => {
    for (const reason of REFUND_REASONS) {
      expect(REFUND_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it('ne compte ni les refusés ni les annulés dans le plafond', () => {
    expect(ACTIVE_REFUND_STATUSES).not.toContain('REJECTED');
    expect(ACTIVE_REFUND_STATUSES).not.toContain('CANCELLED');
    expect(ACTIVE_REFUND_STATUSES).toContain('FAILED');
  });
});

describe('createRefundSchema', () => {
  const base = { orderId: 'o1', amount: 500, reason: 'QUALITY' as const };

  it('pose les défauts : pas de remise en stock, aucune ligne', () => {
    expect(createRefundSchema.parse(base)).toMatchObject({
      restockItems: false,
      lines: [],
    });
  });

  it.each([0, -5, 1.5])('refuse le montant %s', (amount) => {
    expect(createRefundSchema.safeParse({ ...base, amount }).success).toBe(
      false
    );
  });
});

describe('updateRefundDestinationSchema', () => {
  it('exige au moins une modification', () => {
    expect(updateRefundDestinationSchema.safeParse({ id: 'r1' }).success).toBe(
      false
    );
    expect(
      updateRefundDestinationSchema.safeParse({
        id: 'r1',
        destinationPhone: '0707070707',
      }).success
    ).toBe(true);
  });
});
