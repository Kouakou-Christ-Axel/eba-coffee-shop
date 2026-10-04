// lib/schemas/payment-mode.test.ts
//
// `paymentModeSchema` valide les modes saisis en caisse, au dashboard et par les
// outils MCP. Il doit accepter exactement les modes de la source unique.

import { describe, expect, it } from 'vitest';
import { PAYMENT_MODES } from '@/lib/payment-modes';
import { paymentModeSchema } from './order';

describe('paymentModeSchema', () => {
  it('accepte chaque mode de la source unique', () => {
    for (const mode of PAYMENT_MODES) {
      expect(paymentModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it('refuse un mode inconnu', () => {
    expect(paymentModeSchema.safeParse('BITCOIN').success).toBe(false);
  });

  it('refuse un mode en minuscules', () => {
    expect(paymentModeSchema.safeParse('mtn_money').success).toBe(false);
  });
});
