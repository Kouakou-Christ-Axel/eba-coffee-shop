import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { getActiveJekoAccount } from '@/lib/jeko/active-account';
import { configuredJekoAccounts } from '@/lib/jeko/config';
import { getJekoLedger } from '@/lib/jeko/ledger';
import { getEarliestJekoPayment } from '@/lib/jeko/stats';
import {
  ChartCardSkeleton,
  KpiGridSkeleton,
} from '@/components/(dashboard)/skeletons';
import { AccountSwitch } from './account-switch';
import { BalanceSection } from './balance-section';
import { JekoToolbar } from './jeko-toolbar';
import { LedgerDetail } from './ledger-detail';
import { LimitBars } from './limit-bars';
import { parseJekoSearchParams } from './parse-search-params';
import { PeriodStats } from './period-stats';
import { WithdrawalsSection } from './withdrawals-section';

export const dynamic = 'force-dynamic';

export default async function JekoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await requireRoleOrAnalyst(['ADMIN']);
  const canWrite = user.role !== 'ANALYSTE';
  const parsed = parseJekoSearchParams(await searchParams);
  const { account } = parsed;

  const active = await getActiveJekoAccount();
  const configured = configuredJekoAccounts();
  // Le compte A (historique) est toujours listé : il porte les anciens paiements
  // même si ses variables ont été retirées.
  const accounts = Array.from(
    new Set<JekoAccount>(['A', ...configured, active])
  ).sort();
  const scope = account ? [account] : accounts;

  let fromStr = parsed.fromStr;
  if (parsed.isAll) {
    fromStr = (await getEarliestJekoPayment(account)) ?? fromStr;
  }

  // Un solde par compte : les barres de plafond les veulent tous, quel que soit le filtre.
  const perAccount = await Promise.all(accounts.map((a) => getJekoLedger(a)));
  const ledger = account
    ? perAccount[accounts.indexOf(account)]
    : await getJekoLedger(null);
  const balances = Object.fromEntries(
    accounts.map((a, i) => [a, perAccount[i].balance])
  ) as Record<JekoAccount, number>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solde Jèko</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui doit se trouver sur chaque compte Jèko, d’après les paiements
          en ligne encaissés et les retraits enregistrés ici, et l’activité de
          la période.
        </p>
      </div>

      {user.role === 'ADMIN' && (
        <AccountSwitch active={active} accounts={configured} />
      )}

      <JekoToolbar
        accounts={accounts}
        from={fromStr}
        to={parsed.toStr}
        isAll={parsed.isAll}
      />

      <BalanceSection ledger={ledger} scope={scope} />
      <LimitBars
        rows={accounts
          .filter((a) => scope.includes(a))
          .map((a) => ({
            account: a,
            monthCollected: perAccount[accounts.indexOf(a)].monthCollected,
          }))}
        active={active}
      />

      <Suspense
        key={`${account}-${fromStr}-${parsed.toStr}`}
        fallback={
          <div className="space-y-6">
            <KpiGridSkeleton count={8} />
            <ChartCardSkeleton height={260} />
          </div>
        }
      >
        <PeriodStats account={account} from={fromStr} to={parsed.toStr} />
      </Suspense>

      <WithdrawalsSection
        ledger={ledger}
        accounts={accounts}
        fixedAccount={account}
        balances={balances}
        canWrite={canWrite}
      />
      <LedgerDetail ledger={ledger} />
    </div>
  );
}
