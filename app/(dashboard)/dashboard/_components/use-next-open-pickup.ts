'use client';

// Raccourci « jour ouvert suivant » (typiquement « Demain 11h »), partagé par
// les deux modales dashboard qui le proposent : la caisse
// (`caisse/edit-fulfillment-modal.tsx`) et l'admin
// (`commandes/[id]/edit-order-details.tsx`).
//
// Centralisé ici pour que les deux écrans posent EXACTEMENT le même jour et
// affichent le même libellé — deux calculs parallèles (deux appels
// `pickOpenDayTime` distincts) finiraient par diverger sur un arrondi ou une
// mise à jour des horaires appliquée à l'un et pas à l'autre.
//
// Dégradation gracieuse : tant que les horaires ne sont pas chargés (ou en
// erreur), on retombe sur demain à `DEFERRED_PICKUP_DEFAULT_TIME` plutôt que
// de faire disparaître le raccourci — une panne de `/api/pickup-slots` ne doit
// pas retirer une fonctionnalité au staff. Le raccourci n'est masqué QUE si
// les horaires sont chargés et indiquent que tous les jours sont fermés
// (`pickOpenDayTime` renvoie `null`).

import { usePickupInfo } from '@/lib/hooks/use-pickup-info';
import { pickOpenDayTime } from '@/lib/pickup-slots';
import {
  formatPickup,
  pickupDayString,
  pickupISOAt,
} from '@/lib/orders/scheduling';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';

export type NextOpenPickupTarget = { date: string; time: string };

export type NextOpenPickup = {
  target: NextOpenPickupTarget;
  /** Libellé capitalisé, ex. « Demain 11h00 », « 16/06 11h00 » si demain est fermé. */
  label: string;
} | null;

function capitalize(label: string): string {
  return label.length ? label[0].toUpperCase() + label.slice(1) : label;
}

/**
 * `enabled` : passe-plat vers `usePickupInfo` — l'appelant y met `isOpen` de
 * sa modale pour ne charger les horaires qu'à l'ouverture.
 *
 * Renvoie `null` si le raccourci ne doit pas être proposé (tous les jours
 * fermés) ; sinon la cible à poser et son libellé.
 */
export function useNextOpenPickup(enabled: boolean): NextOpenPickup {
  const info = usePickupInfo(0, enabled);

  const target: NextOpenPickupTarget | null =
    info.status === 'ready'
      ? pickOpenDayTime(
          info.days,
          pickupDayString(1),
          DEFERRED_PICKUP_DEFAULT_TIME
        )
      : { date: pickupDayString(1), time: DEFERRED_PICKUP_DEFAULT_TIME };

  if (target === null) return null;

  const iso = pickupISOAt(target.date, target.time);
  if (!iso) return null;

  return { target, label: capitalize(formatPickup(new Date(iso), new Date())) };
}
