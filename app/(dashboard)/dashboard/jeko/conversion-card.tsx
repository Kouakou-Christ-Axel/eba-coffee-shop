import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JekoStats } from '@/lib/jeko/stats';

const fmt = new Intl.NumberFormat('fr-FR');

/** Commandes en ligne créées sur la plage : combien ont abouti. */
export function ConversionCard({
  conversion: c,
  averageBasket,
}: {
  conversion: JekoStats['conversion'];
  averageBasket: number;
}) {
  const rows: [string, number, string][] = [
    ['Payées', c.paid, 'bg-primary'],
    ['Expirées ou annulées', c.failed, 'bg-destructive'],
    ['En attente de paiement', c.pending, 'bg-muted-foreground/50'],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversion des paiements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {c.created === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune commande en ligne créée sur cette période.
          </p>
        ) : (
          <>
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {c.successRate === null
                  ? '—'
                  : `${Math.round(c.successRate * 100)} %`}
              </p>
              <p className="text-xs text-muted-foreground">
                de réussite parmi les paiements terminés (les paiements en
                attente ne comptent pas) · panier moyen payé{' '}
                {fmt.format(averageBasket)} F
              </p>
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={rows.map(([l, n]) => `${l} : ${n}`).join(', ')}
            >
              {rows.map(([label, n, color]) => (
                <div
                  key={label}
                  className={color}
                  style={{ width: `${(n / c.created) * 100}%` }}
                />
              ))}
            </div>
            <dl className="divide-y text-sm">
              {rows.map(([label, n, color]) => (
                <div key={label} className="flex justify-between py-1.5">
                  <dt className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${color}`} />
                    {label}
                  </dt>
                  <dd className="font-medium tabular-nums">{fmt.format(n)}</dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 text-muted-foreground">
                <dt>Commandes en ligne créées</dt>
                <dd className="tabular-nums">{fmt.format(c.created)}</dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
