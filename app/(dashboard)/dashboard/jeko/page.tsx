import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { getActiveJekoAccount } from '@/lib/jeko/active-account';
import { fetchRemoteBalance } from '@/lib/jeko/balance';
import { configuredJekoAccounts, jekoConfig } from '@/lib/jeko/config';
import { getJekoLedger } from '@/lib/jeko/ledger';
import { AccountSection } from './account-section';
import { AccountSwitch } from './account-switch';

export const dynamic = 'force-dynamic';

export default async function JekoPage() {
  const { user } = await requireRoleOrAnalyst(['ADMIN']);
  const canWrite = user.role !== 'ANALYSTE';
  const active = await getActiveJekoAccount();
  // Le compte A (historique) est toujours listé : il porte les anciens paiements
  // même si ses variables ont été retirées.
  const accounts = Array.from(
    new Set(['A', ...configuredJekoAccounts(), active])
  ).sort() as ('A' | 'B')[];
  const [ledgers, remotes] = await Promise.all([
    Promise.all(accounts.map((a) => getJekoLedger(a))),
    Promise.all(accounts.map((a) => fetchRemoteBalance(jekoConfig(a)))),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Solde Jèko</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui doit se trouver sur chaque compte Jèko, d’après les paiements
          en ligne encaissés et les retraits enregistrés ici.
        </p>
      </div>

      {user.role === 'ADMIN' && (
        <AccountSwitch active={active} accounts={configuredJekoAccounts()} />
      )}

      {accounts.map((account, i) => (
        <AccountSection
          key={account}
          account={account}
          active={account === active}
          ledger={ledgers[i]}
          remote={remotes[i]}
          canWrite={canWrite}
        />
      ))}
    </div>
  );
}
