'use client';

import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { OrderCard } from '../order-card';
import { OrderCardActions } from '../order-card-actions';
import { isScheduledAhead, type TabKey } from '../urgency';
import type { UrgencyIndex } from './use-urgency-counts';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { ContactSettings } from '@/lib/contact-settings';

// Pastille de statut : la file de recherche est INTER-ONGLETS, il faut donc
// dire d'où vient chaque commande. Libellés alignés sur les onglets.
const TAB_PILL: Record<TabKey, { label: string; className: string }> = {
  'to-pay': {
    label: 'À encaisser',
    className:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  },
  'in-progress': {
    label: 'En cours',
    className:
      'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100',
  },
  ready: {
    label: 'Prête',
    className:
      'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100',
  },
};

type Props = {
  orders: CashierOrder[];
  urgencyIndex: UrgencyIndex;
  /** Terme saisi, pour le repli « chercher dans toutes les commandes ». */
  term: string;
  menu: MenuCategory[];
  contactSettings: Pick<
    ContactSettings,
    | 'yangoLandmark'
    | 'mapsDirectionsUrl'
    | 'wavePaymentNumber'
    | 'orangeMoneyPaymentNumber'
  >;
  now: Date;
};

/**
 * Résultats de recherche caisse, tous onglets confondus (la file du jour tenue
 * en mémoire contient déjà « à encaisser » + « en cours » + « prêtes » +
 * « programmées »).
 *
 * Quand rien ne sort : la file caisse est bornée au jour et exclut les
 * commandes annulées, donc l'absence de résultat ne veut PAS dire que la
 * commande n'existe pas. On propose la recherche serveur de
 * `/dashboard/commandes`, qui n'a aucune de ces restrictions.
 */
export function CaisseSearchResults({
  orders,
  urgencyIndex,
  term,
  menu,
  contactSettings,
  now,
}: Props) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-8 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          Aucune commande du jour ne correspond à « {term} »
        </p>
        <Link
          href={`/dashboard/commandes?search=${encodeURIComponent(term)}`}
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Chercher dans toutes les commandes →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {orders.length} résultat{orders.length > 1 ? 's' : ''} — tous les
        onglets
      </p>
      {orders.map((o) => {
        const entry = urgencyIndex.get(o.id);
        const tabs = entry?.tabs ?? [];
        return (
          <div key={o.id} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {tabs.map((t) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TAB_PILL[t].className}`}
                >
                  {TAB_PILL[t].label}
                </span>
              ))}
              {tabs.length === 0 && isScheduledAhead(o, now) && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100">
                  Programmée
                </span>
              )}
            </div>
            <OrderCard
              order={o}
              urgency={entry?.level ?? 'normal'}
              now={now}
              actions={
                <OrderCardActions
                  order={o}
                  menu={menu}
                  contactSettings={contactSettings}
                />
              }
            />
          </div>
        );
      })}
    </div>
  );
}
