import type { getJekoLedger } from '@/lib/jeko/ledger';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

type Ledger = Awaited<ReturnType<typeof getJekoLedger>>;

/** Décomposition du solde attendu, depuis le début (pas limitée à la plage). */
export function LedgerDetail({ ledger: l }: { ledger: Ledger }) {
  const lines: [string, string, string?][] = [
    ['Payé par les clients', f(l.collected), `${l.count} paiement(s)`],
    ['dont frais clients (1 %)', f(l.customerFees)],
    ['Frais prélevés par Jèko', f(-l.gatewayFees)],
    ['Remboursements envoyés (frais compris)', f(-l.refunded)],
    ['Net arrivé sur Jèko', f(l.netReceived)],
    ['Retraits', f(-l.withdrawnTotal)],
    ['Frais de retrait', f(-l.withdrawalFeesTotal)],
  ];
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Comment le solde attendu est calculé
      </summary>
      {l.feeUnknownCount > 0 && (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {l.feeUnknownCount} paiement(s) n’ont pas leurs frais Jèko : le solde
          attendu peut être trop haut tant que le webhook ou la vérification n’a
          pas complété ces commandes.
        </p>
      )}
      <dl className="mt-3 divide-y text-sm">
        {lines.map(([label, value, hint]) => (
          <div key={label} className="flex justify-between py-2">
            <dt>
              {label}
              {hint && (
                <span className="ml-2 text-muted-foreground">{hint}</span>
              )}
            </dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
