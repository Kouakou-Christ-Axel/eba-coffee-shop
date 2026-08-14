'use client';

import { useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '../order-card';
import { OrderCardActions } from '../order-card-actions';
import {
  formatPickup,
  getUrgencyLevel,
  isAwaitingKitchenLaunch,
  minutesUntilPickup,
} from '../urgency';
import { LAUNCH_ALERT_MINUTES } from '@/config/constants';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { ContactSettings } from '@/lib/contact-settings';

type Props = {
  orders: CashierOrder[];
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
 * Section repliable des commandes programmées : retrait encore lointain, OU
 * commande à créneau pas encore lancée en cuisine (cf. `filterScheduledAhead`).
 * Repliée par défaut : elle signale leur présence sans encombrer le flux actif.
 *
 * MAIS elle s'ouvre d'elle-même dès qu'une commande y devient urgente — repliée,
 * elle rendait l'alerte invisible au moment précis où elle compte. La bordure
 * passe alors au rouge, et l'en-tête annonce combien sont à lancer.
 */
export function ScheduledSection({
  orders,
  menu,
  contactSettings,
  now,
}: Props) {
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);

  if (orders.length === 0) return null;

  const next = orders[0]?.pickupTime;
  // Commandes à créneau non lancées dont le retrait approche : c'est le signal
  // « il faut s'en occuper maintenant ».
  const toLaunch = orders.filter((o) => {
    if (!isAwaitingKitchenLaunch(o)) return false;
    const m = minutesUntilPickup(o, now);
    return m !== null && m <= LAUNCH_ALERT_MINUTES;
  }).length;
  const urgent = toLaunch > 0;
  // Un choix explicite du caissier prime toujours sur l'ouverture automatique.
  const open = manuallyToggled ?? urgent;

  return (
    <section
      className={cn(
        'rounded-2xl border-2',
        urgent
          ? 'border-red-400 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
          : 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20'
      )}
    >
      <button
        type="button"
        onClick={() => setManuallyToggled(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <span
          className={cn(
            'flex items-center gap-2 text-sm font-semibold',
            urgent
              ? 'text-red-900 dark:text-red-100'
              : 'text-indigo-900 dark:text-indigo-100'
          )}
        >
          <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />
          Programmées
          <span
            className={cn(
              'rounded-full px-1.5 text-xs font-semibold tabular-nums text-white',
              urgent ? 'bg-red-600' : 'bg-indigo-600'
            )}
          >
            {orders.length}
          </span>
          {urgent ? (
            <span className="font-semibold text-red-700 dark:text-red-300">
              · {toLaunch} à lancer maintenant
            </span>
          ) : (
            next && (
              <span className="font-normal text-indigo-700 dark:text-indigo-300">
                · prochain retrait {formatPickup(next, now)}
              </span>
            )
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 transition-transform',
            urgent
              ? 'text-red-700 dark:text-red-300'
              : 'text-indigo-700 dark:text-indigo-300',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              urgency={getUrgencyLevel(o, 'in-progress', now)}
              now={now}
              actions={
                <OrderCardActions
                  order={o}
                  menu={menu}
                  contactSettings={contactSettings}
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
