import { createLoader, type SearchParams } from 'nuqs/server';
import type { RefundStatus } from '@/generated/prisma/client';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { refundsParsers, type RefundTab } from './search-params';

export type RefundsSearchParams = SearchParams;

const load = createLoader(refundsParsers);

/** Statuts affichés par onglet. */
export const TAB_STATUSES: Record<RefundTab, RefundStatus[] | undefined> = {
  validate: ['REQUESTED'],
  fix: ['FAILED', 'UNCERTAIN'],
  progress: ['APPROVED', 'PROCESSING'],
  history: ['PAID', 'REJECTED', 'CANCELLED'],
};

export function parseRefundsSearchParams(params: RefundsSearchParams) {
  const raw = load(params);
  const isAll = raw.range === 'all';
  // Les files de travail n'ont pas de plage : tout ce qui attend est montré.
  const useRange = raw.tab === 'history' && !isAll;
  const fromStr = useRange ? (raw.from ?? '') : '';
  const toStr = useRange ? (raw.to ?? '') : '';
  const from = parseDateOnlyToUTC(fromStr || undefined);
  const to = parseDateOnlyToUTC(toStr || undefined);
  return {
    page: Math.max(1, raw.page),
    tab: raw.tab,
    channel: raw.channel ?? undefined,
    status: TAB_STATUSES[raw.tab],
    from: from ?? undefined,
    toExclusive: to ? new Date(to.getTime() + 86_400_000) : undefined,
    fromStr: from ? fromStr : '',
    toStr: to ? toStr : '',
    isAll: isAll || !from,
  };
}
