'use client';

import type { ReactNode } from 'react';
import { Bike, CheckCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildGroupDriverRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { orderRef } from '@/lib/orders/customer-groups';
import {
  summarizeKitchenGroup,
  type KitchenGroup,
} from '@/lib/orders/kitchen-group';
import type { ContactSettings } from '@/lib/contact-settings';
import { groupColor } from './group-color';
import { GroupPills } from './group-pills';

type Props = {
  group: KitchenGroup;
  pending: boolean;
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
  onReadyMany: (ids: string[]) => void;
  onRequestDriverMany: (ids: string[]) => void;
  /** Les tickets du groupe (cartes de la grille). */
  children: ReactNode;
};

const driverTone =
  'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100';

/**
 * Les commandes d'un même client regroupées dans la grille de cuisine : un
 * cadre de couleur, ce qui cuit / ce qui attend déjà, et deux gestes pour tout
 * le groupe — « Tout prêt » et UNE demande de livreur — sans toucher aux
 * boutons de chaque ticket.
 */
export function KitchenGroupCluster({
  group,
  pending,
  contactSettings,
  onReadyMany,
  onRequestDriverMany,
  children,
}: Props) {
  const color = groupColor(group.key);
  const s = summarizeKitchenGroup(group);
  const readyIds = s.cooking.map((o) => o.id);
  const driverIds = s.driverTargets.map((o) => o.id);
  const driverLink = buildWhatsAppLink(
    group.customerPhone,
    buildGroupDriverRequestMessage({
      customerName: group.customerName,
      dailyNumbers: s.deliveries.map((o) => o.dailyNumber),
      yangoLandmark: contactSettings.yangoLandmark,
      phone: contactSettings.phone,
    })
  );
  const driverBtn =
    'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors';

  return (
    <section
      aria-label={`Commandes groupées de ${group.customerName ?? 'ce client'}`}
      className={cn(
        'col-span-full rounded-3xl border-2 p-3',
        color.border,
        color.bg
      )}
    >
      <header className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold',
              color.chip
            )}
          >
            <Users className="h-4 w-4" aria-hidden />
            {s.total} commandes ensemble
          </span>
          <h3 className="text-lg font-bold">
            {group.customerName ?? 'Client'}
          </h3>
          {s.deliveries.length > 1 && (
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Bike className="h-4 w-4" aria-hidden />
              un seul livreur
            </span>
          )}
        </div>

        <GroupPills group={group} />

        {s.ready.length > 0 && s.cooking.length > 0 && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            {s.ready.map(orderRef).join(' · ')} déjà prête
            {s.ready.length > 1 ? 's' : ''} — attendre{' '}
            {s.cooking.map(orderRef).join(' · ')} pour emballer et partir
            ensemble
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {readyIds.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onReadyMany(readyIds)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
            >
              <CheckCheck className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              Tout prêt ({readyIds.length})
            </button>
          )}
          {driverIds.length > 0 &&
            (driverLink ? (
              <a
                href={driverLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!pending) onRequestDriverMany(driverIds);
                }}
                className={cn(driverBtn, driverTone)}
              >
                <Bike className="h-4 w-4" aria-hidden />
                Demander le livreur ({driverIds.length})
              </a>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => onRequestDriverMany(driverIds)}
                className={cn(driverBtn, driverTone, 'disabled:opacity-50')}
              >
                <Bike className="h-4 w-4" aria-hidden />
                Demander le livreur ({driverIds.length})
              </button>
            ))}
          {s.deliveries.length > 0 && driverIds.length === 0 && (
            <span className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <Bike className="h-4 w-4" aria-hidden />
              Livreur demandé pour tout le groupe
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
