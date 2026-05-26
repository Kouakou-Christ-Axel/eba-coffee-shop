import { describe, it, expect } from 'vitest';
import { normalizeOrderDates } from './format';

describe('normalizeOrderDates', () => {
  it('convertit createdAt en Date', () => {
    const iso = '2026-05-26T10:00:00.000Z';
    const result = normalizeOrderDates({
      pickupTime: null,
      createdAt: iso,
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(iso);
  });

  it('convertit pickupTime en Date quand non null', () => {
    const result = normalizeOrderDates({
      pickupTime: '2026-05-26T12:30:00.000Z',
      createdAt: '2026-05-26T10:00:00.000Z',
    });
    expect(result.pickupTime).toBeInstanceOf(Date);
    expect(result.pickupTime?.toISOString()).toBe('2026-05-26T12:30:00.000Z');
  });

  it('laisse pickupTime à null quand le champ est null', () => {
    const result = normalizeOrderDates({
      pickupTime: null,
      createdAt: '2026-05-26T10:00:00.000Z',
    });
    expect(result.pickupTime).toBeNull();
  });

  it('préserve les autres clés intactes', () => {
    const result = normalizeOrderDates({
      id: 'abc-123',
      reference: 'CMD-001',
      total: 5000,
      pickupTime: null,
      createdAt: '2026-05-26T10:00:00.000Z',
    });
    expect(result.id).toBe('abc-123');
    expect(result.reference).toBe('CMD-001');
    expect(result.total).toBe(5000);
  });

  it('ne mute pas le payload source', () => {
    const raw = {
      pickupTime: '2026-05-26T12:30:00.000Z',
      createdAt: '2026-05-26T10:00:00.000Z',
    };
    normalizeOrderDates(raw);
    expect(typeof raw.pickupTime).toBe('string');
    expect(typeof raw.createdAt).toBe('string');
  });
});
