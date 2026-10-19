import { requireRefundsView } from '@/lib/auth-helpers';
import {
  REFUND_APPROVER_ROLES,
  REFUND_REQUEST_ROLES,
} from '@/config/constants';
import { Pagination } from '@/components/(dashboard)/pagination';
import {
  countRefundQueues,
  getRefundDetail,
  listRefunds,
} from '@/lib/refunds/queries';
import { refreshPendingRefunds } from '@/lib/refunds/refresh';
import { RefundDetailSheet } from './_components/refund-detail-sheet';
import { RefundsList } from './_components/refunds-list';
import { RefundsToolbar } from './_components/refunds-toolbar';
import {
  parseRefundsSearchParams,
  type RefundsSearchParams,
} from './parse-search-params';
import { toDetail, toRow } from './serialize';

export const dynamic = 'force-dynamic';

const EMPTY: Record<string, string> = {
  validate: 'Aucun remboursement à valider.',
  fix: 'Aucun remboursement à corriger.',
  progress: 'Aucun remboursement en cours.',
  history: 'Aucun remboursement dans cet historique.',
};

export default async function RemboursementsPage({
  searchParams,
}: {
  searchParams: Promise<RefundsSearchParams>;
}) {
  const session = await requireRefundsView();
  const role = session.user.role;
  const viewer = {
    userId: session.user.id,
    canRequest: REFUND_REQUEST_ROLES.includes(role),
    canApprove: REFUND_APPROVER_ROLES.includes(role),
  };

  // Relit les transferts Jèko en cours (opportuniste, jamais bloquant).
  void refreshPendingRefunds().catch(() => {});

  const params = await searchParams;
  const {
    page,
    tab,
    channel,
    status,
    from,
    toExclusive,
    fromStr,
    toStr,
    isAll,
  } = parseRefundsSearchParams(params);
  const openId = typeof params.open === 'string' ? params.open : undefined;

  const [list, counts, detail] = await Promise.all([
    listRefunds({ page, status, channel, from, toExclusive }),
    countRefundQueues(),
    openId ? getRefundDetail(openId) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Remboursements</h1>
        <p className="text-sm text-muted-foreground">
          Un remboursement se demande depuis la fiche de la commande. Un
          administrateur le valide avant que l’argent ne parte.
        </p>
      </div>

      <RefundsToolbar counts={counts} from={fromStr} to={toStr} isAll={isAll} />

      {list.refunds.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {EMPTY[tab]}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {list.total} remboursement{list.total > 1 ? 's' : ''} ·{' '}
            {new Intl.NumberFormat('fr-FR').format(list.totalAmount)} F
          </p>
          <RefundsList rows={list.refunds.map(toRow)} />
        </>
      )}

      {list.totalPages > 1 && <Pagination totalPages={list.totalPages} />}

      <RefundDetailSheet
        refund={
          detail ? toDetail(detail, { seePhone: viewer.canRequest }) : null
        }
        viewer={viewer}
      />
    </div>
  );
}
