// Ardoise : qui doit de l'argent au commerce, toutes dates confondues.
// Une dette = commande récupérée et non réglée ; la page n'est pas cadrée sur
// la journée. Seul l'encaissement réel (« Encaisser ») solde une dette. « À
// vérifier » : impayées anciennes jamais marquées récupérées, hors total.

import Link from 'next/link';
import { Info, NotebookPen } from 'lucide-react';
import { requireCashier } from '@/lib/auth-helpers';
import { fetchArdoise } from '@/lib/ardoise';
import { Button } from '@/components/ui/button';
import { DebtGroup } from './_components/debt-group';
import { priceFmt } from './_components/helpers';
import { ToCheckSection } from './_components/to-check-section';

export const dynamic = 'force-dynamic';

export default async function ArdoisePage({
  searchParams,
}: {
  searchParams: Promise<{ consentie?: string }>;
}) {
  await requireCashier();
  const params = await searchParams;

  const onlyOnAccount = params.consentie === '1';

  const now = new Date();
  const ardoise = await fetchArdoise({ onlyOnAccount });

  // Le filtre « consentie » ne porte que sur la dette : la section « À
  // vérifier » reste entière, un oubli de pointage n'étant jamais consenti.
  const consentieHref = onlyOnAccount
    ? '/dashboard/ardoise'
    : '/dashboard/ardoise?consentie=1';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <NotebookPen className="h-6 w-6" aria-hidden="true" />
            Ardoise
          </h1>
          <p className="text-sm text-muted-foreground">
            {ardoise.ordersCount} commande{ardoise.ordersCount > 1 ? 's' : ''}{' '}
            récupérée{ardoise.ordersCount > 1 ? 's' : ''} et non réglée
            {ardoise.ordersCount > 1 ? 's' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={onlyOnAccount ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link href={consentieHref}>Ardoise consentie seulement</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Total dû
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {priceFmt.format(ardoise.totalOwed)} F
        </p>
      </div>

      {/* Avertissement comptable : discret mais indispensable. Le CA est
          attribué par `Order.dailyDate` (lib/stats.ts), pas par la date de
          règlement. Encaisser une vieille ardoise n'alimente donc PAS la
          recette du jour. */}
      <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          La recette est attribuée au jour de la commande, pas au jour du
          paiement : encaisser une ardoise ancienne crédite le chiffre
          d’affaires de son jour d’origine — qui peut déjà être clôturé.
        </span>
      </div>

      <div className="space-y-3">
        {ardoise.groups.map((g) => (
          <DebtGroup key={g.key} g={g} now={now} />
        ))}

        {ardoise.groups.length === 0 && (
          <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">
            Aucune ardoise en cours. Tout est réglé.
          </p>
        )}
      </div>

      {ardoise.toCheck.length > 0 && <ToCheckSection ardoise={ardoise} />}
    </div>
  );
}
