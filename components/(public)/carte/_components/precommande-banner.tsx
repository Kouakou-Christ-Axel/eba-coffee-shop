// components/(public)/carte/_components/precommande-banner.tsx
//
// Statut UNIQUE et global du panier en mode précommande — un seul composant,
// partagé par le panier (cart-drawer.tsx) et le checkout (checkout-form.tsx),
// plutôt que deux messages qui pourraient diverger. Même style indigo que
// `deferredPickupLabel` sur la page de suivi (order-tracking.tsx) : c'est le
// même concept (commande pour un jour ultérieur), affiché dans le même
// registre visuel à chaque étape du parcours.

import { CalendarClock } from 'lucide-react';
import { formatAbidjanTime } from '@/lib/timezone';

type PrecommandeBannerProps = {
  /** ISO du créneau choisi ; absent si pas encore choisi (affiche juste le jour). */
  pickupTime?: string | null;
  className?: string;
};

export function PrecommandeBanner({
  pickupTime,
  className = '',
}: PrecommandeBannerProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-indigo-300/60 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30 ${className}`}
    >
      <CalendarClock
        className="h-5 w-5 shrink-0 text-indigo-700 dark:text-indigo-300"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
        Panier précommande — retrait demain
        {pickupTime ? `, ${formatAbidjanTime(new Date(pickupTime))}` : ''}
      </p>
    </div>
  );
}
