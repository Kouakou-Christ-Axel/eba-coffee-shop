import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/refunds/create', () => ({ createRefund: vi.fn() }));
vi.mock('@/lib/refunds/queries', () => ({
  listRefunds: vi.fn().mockResolvedValue({ refunds: [] }),
  getRefundDetail: vi.fn(),
}));
vi.mock('@/lib/refunds/stats', () => ({ getRefundStats: vi.fn() }));

import { createRefund } from '@/lib/refunds/create';
import { getRefundDetail, listRefunds } from '@/lib/refunds/queries';
import { getRefundStats } from '@/lib/refunds/stats';
import {
  FINANCE_TOOL_NAMES,
  READ_ONLY_TOOL_NAMES,
  toolsByName,
} from './registry';

const tool = (name: string) => toolsByName.get(name)!;

describe('outils MCP — remboursements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expose lecture et DEMANDE seulement : ni validation, ni envoi, ni règlement manuel', () => {
    const names = [...toolsByName.keys()].filter((n) => /refund/.test(n));
    expect(names.sort()).toEqual([
      'create_refund',
      'get_refund',
      'get_refund_summary',
      'list_refunds',
    ]);
  });

  it('les lectures sont ouvertes à l’analyste, la demande non ; toutes aux rôles finance', () => {
    for (const n of ['list_refunds', 'get_refund', 'get_refund_summary']) {
      expect(READ_ONLY_TOOL_NAMES.has(n)).toBe(true);
      expect(FINANCE_TOOL_NAMES.has(n)).toBe(true);
    }
    expect(READ_ONLY_TOOL_NAMES.has('create_refund')).toBe(false);
    expect(FINANCE_TOOL_NAMES.has('create_refund')).toBe(true);
  });

  it('create_refund : demandeur anonyme non-admin (l’admin est prévenu), aucune validation', async () => {
    vi.mocked(createRefund).mockResolvedValue({ id: 'r1' } as never);
    const input = { orderId: 'o1', amount: 500, reason: 'QUALITY' };

    await tool('create_refund').handler(
      tool('create_refund').inputSchema.parse(input)
    );

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o1', restockItems: false }),
      { id: null, role: 'MANAGER' }
    );
  });

  it('list_refunds : la fin de plage est inclusive (borne exclusive J+1)', async () => {
    await tool('list_refunds').handler({
      from: '2026-10-01',
      to: '2026-10-03',
    });
    const arg = vi.mocked(listRefunds).mock.calls[0][0]!;
    expect(arg.from).toEqual(new Date(Date.UTC(2026, 9, 1)));
    expect(arg.toExclusive).toEqual(new Date(Date.UTC(2026, 9, 4)));
  });

  it('get_refund : erreur claire si introuvable', async () => {
    vi.mocked(getRefundDetail).mockResolvedValue(null);
    await expect(tool('get_refund').handler({ id: 'x' })).rejects.toThrow(
      'introuvable'
    );
  });

  it('get_refund_summary : plage inversée remise dans l’ordre', async () => {
    await tool('get_refund_summary').handler({
      from: '2026-10-09',
      to: '2026-10-01',
    });
    const [from, to] = vi.mocked(getRefundStats).mock.calls[0];
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});
