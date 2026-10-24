import {
  JEKO_MONTHLY_LIMIT_FCFA,
  JEKO_MONTHLY_WARN_RATIO,
} from '@/config/constants';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { cn } from '@/lib/utils';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

/**
 * Plafond MENSUEL d'encaissement, une barre par compte. Indépendante de la plage
 * choisie : la limite de Jèko est le mois civil en cours, un retrait ne la libère pas.
 */
export function LimitBars({
  rows,
  active,
}: {
  rows: { account: JekoAccount; monthCollected: number }[];
  active: JekoAccount;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-medium">Plafond mensuel d’encaissement</h2>
        <p className="text-xs text-muted-foreground">
          {f(JEKO_MONTHLY_LIMIT_FCFA)} par compte et par mois civil. Un retrait
          ne libère pas de place.
        </p>
      </div>
      {rows.map(({ account, monthCollected }) => {
        const ratio = monthCollected / JEKO_MONTHLY_LIMIT_FCFA;
        const warn = ratio >= JEKO_MONTHLY_WARN_RATIO;
        return (
          <div key={account} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                Compte {account}
                {account === active && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    actif
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {f(monthCollected)} · {Math.round(ratio * 100)} %
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`Plafond mensuel du compte ${account}`}
              aria-valuenow={Math.round(ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  ratio >= 1
                    ? 'bg-destructive'
                    : warn
                      ? 'bg-amber-500'
                      : 'bg-primary'
                )}
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            </div>
            {warn && (
              <p className="text-xs text-amber-600">
                {ratio >= 1 ? 'Plafond atteint : ' : 'Proche du plafond : '}
                {account === active
                  ? 'passez sur l’autre compte pour les prochains paiements.'
                  : 'ne basculez pas dessus.'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
