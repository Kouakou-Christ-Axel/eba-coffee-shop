import { AlertTriangle, Clock, Percent, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { getRefundStats } from '@/lib/refunds/stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { REFUND_REASON_LABELS } from '@/lib/schemas/refund';

const fmt = new Intl.NumberFormat('fr-FR');
const pct = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count?: number; amount: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée.</p>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <span>
                  {r.label}
                  {r.count !== undefined && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ×{r.count}
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {fmt.format(r.amount)} F
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Remboursements partis sur la période (jour où l'argent est parti), avec leurs
// files d'attente. Le CA affiché plus haut est déjà net de ces montants.
export async function RefundsSection({ from, to }: { from: Date; to: Date }) {
  const s = await getRefundStats(from, to);
  const waiting = s.queues.toApprove + s.queues.toFix;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Remboursements</h2>
          <p className="text-sm text-muted-foreground">
            Argent rendu aux clients sur la période. Déjà déduit du CA encaissé.
          </p>
        </div>
        <Link
          href="/dashboard/remboursements"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Ouvrir les remboursements
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Remboursé"
          value={`${fmt.format(s.amount)} F`}
          Icon={RotateCcw}
          hint={`${s.count} remboursement${s.count > 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Part du CA brut"
          value={pct.format(s.rateOfGrossRevenue)}
          Icon={Percent}
          hint={
            s.transferFees > 0
              ? `frais de transfert : ${fmt.format(s.transferFees)} F`
              : undefined
          }
        />
        <KpiCard
          label="En attente"
          value={String(waiting)}
          Icon={AlertTriangle}
          valueClassName={waiting > 0 ? 'text-amber-600' : undefined}
          hint={`${s.queues.toApprove} à valider · ${s.queues.toFix} à corriger`}
        />
        <KpiCard
          label="Validation"
          value={
            s.avgApprovalMinutes === null ? '—' : `${s.avgApprovalMinutes} min`
          }
          Icon={Clock}
          hint={`échec des transferts : ${pct.format(s.transferFailureRate)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Breakdown
          title="Par motif"
          rows={s.byReason.map((r) => ({
            label: REFUND_REASON_LABELS[r.reason],
            count: r.count,
            amount: r.amount,
          }))}
        />
        <Breakdown
          title="Par canal"
          rows={PAYMENT_MODES.filter((m) => s.byChannel[m] > 0).map((m) => ({
            label: PAYMENT_MODE_LABELS[m],
            amount: s.byChannel[m],
          }))}
        />
        <Breakdown
          title="Par demandeur"
          rows={s.byRequester.map((r) => ({
            label: r.name ?? 'Système / MCP',
            count: r.count,
            amount: r.amount,
          }))}
        />
        <Breakdown
          title="Par produit (articles rattachés)"
          rows={s.byProduct.slice(0, 8).map((p) => ({
            label: p.name,
            count: p.quantity,
            amount: p.amount,
          }))}
        />
      </div>
    </div>
  );
}
