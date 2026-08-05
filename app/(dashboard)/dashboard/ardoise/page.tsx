// Ardoise : qui doit de l'argent au commerce, toutes dates confondues.
//
// Une dette = marchandise remise (commande récupérée) et argent pas reçu. La
// page n'est volontairement PAS cadrée sur la journée (contrairement à la
// caisse) : c'est tout l'intérêt du module `lib/ardoise.ts`. Ces commandes
// restent impayées — aucune écriture comptable n'a lieu ici, seul
// l'encaissement réel (bouton « Encaisser », même chemin que la section
// Commandes) solde une dette.
//
// La section « À vérifier » montre les impayées anciennes jamais marquées
// comme récupérées : hors total, elles se corrigent sur la fiche commande.

import Link from 'next/link';
import { startOfDay } from 'date-fns';
import { Handshake, Info, NotebookPen, TriangleAlert } from 'lucide-react';
import { requireCashier } from '@/lib/auth-helpers';
import { fetchArdoise } from '@/lib/ardoise';
import { formatPhoneForDisplay } from '@/lib/phone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EncaisserButton } from '../commandes/encaisser-button';

export const dynamic = 'force-dynamic';

const priceFmt = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Libellés des statuts « en cours » (même convention locale que /dashboard/clients/[id]). */
const IN_FLIGHT_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
};

/** Ancienneté d'une dette, en français court : « aujourd'hui », « 3 jours ». */
function formatDebtAge(from: Date, now: Date): string {
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(from).getTime()) / 86_400_000
  );
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 31) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

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
          <details
            key={g.key}
            className="group rounded-xl border bg-card open:shadow-sm"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {g.customerId ? (
                    <Link
                      href={`/dashboard/clients/${g.customerId}`}
                      className="hover:underline"
                    >
                      {g.name ?? 'Client'}
                    </Link>
                  ) : (
                    <span>{g.name ?? 'Client anonyme'}</span>
                  )}
                  {g.isTrusted && (
                    <Badge className="bg-blue-600">
                      <Handshake className="h-3 w-3" aria-hidden="true" />
                      Confiance
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.phone ? (
                    <span className="font-mono">
                      {formatPhoneForDisplay(g.phone)}
                    </span>
                  ) : (
                    'Sans téléphone'
                  )}{' '}
                  · {g.ordersCount} commande{g.ordersCount > 1 ? 's' : ''} ·
                  depuis {formatDebtAge(g.oldestUnpaidAt, now)}
                </p>
              </div>
              <span className="shrink-0 text-lg font-bold tabular-nums">
                {priceFmt.format(g.totalOwed)} F
              </span>
            </summary>

            <div className="overflow-x-auto border-t px-4 py-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>N°</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">
                        {dateFmt.format(o.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/dashboard/commandes/${o.id}`}
                          className="hover:underline"
                        >
                          #{String(o.dailyNumber).padStart(3, '0')}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {priceFmt.format(o.total)} F
                      </TableCell>
                      <TableCell>
                        {o.isOnAccount ? (
                          <Badge variant="secondary">Ardoise</Badge>
                        ) : (
                          <Badge variant="outline">Impayée</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <EncaisserButton
                          orderId={o.id}
                          orderRef={`#${String(o.dailyNumber).padStart(3, '0')}`}
                          amount={o.total}
                          variant="outline"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        ))}

        {ardoise.groups.length === 0 && (
          <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">
            Aucune ardoise en cours. Tout est réglé.
          </p>
        )}
      </div>

      {/* Garde-fou : impayées anciennes jamais marquées « récupérée ». On les
          montre pour qu'un oubli de pointage ne cache pas une dette réelle,
          mais on ne les compte pas — tant que le statut n'est pas corrigé, on
          ne sait pas si la marchandise est partie. */}
      {ardoise.toCheck.length > 0 && (
        <section className="rounded-xl border border-dashed bg-muted/30 p-4">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />À
            vérifier
            <Badge variant="outline">
              {ardoise.toCheckCount} commande
              {ardoise.toCheckCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline">
              {priceFmt.format(ardoise.toCheckTotal)} F — non compté dans le
              total dû
            </Badge>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ces commandes ne sont pas payées et n’ont jamais été marquées comme
            récupérées : soit le retrait n’a pas été enregistré, soit elles
            devraient être annulées. Corrigez le statut sur la fiche commande —
            une fois marquée récupérée, la commande rejoint l’ardoise ci-dessus.
          </p>

          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ardoise.toCheck.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">
                      {dateFmt.format(o.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/dashboard/commandes/${o.id}`}
                        className="hover:underline"
                      >
                        #{String(o.dailyNumber).padStart(3, '0')}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.name ?? 'Client anonyme'}
                      {o.phone && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {formatPhoneForDisplay(o.phone)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {IN_FLIGHT_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {priceFmt.format(o.total)} F
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
