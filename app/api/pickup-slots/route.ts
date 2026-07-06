// app/api/pickup-slots/route.ts
//
// GET /api/pickup-slots — créneaux de retrait disponibles pour le checkout.
//
// Réponse enrichie pour le sélecteur du modal :
//   - `slots`       : ISO strings des créneaux réservables (lead time +
//                     capacité déjà appliqués) ;
//   - `leadTimeMin` : délai de préparation (affiche « prête dans ~30 min »
//                     pour l'option « Dès que possible ») ;
//   - `days`        : plages d'ouverture par jour visible (affiche « Ouvert :
//                     7h30 – 21h30 » / « Fermé ce jour ») ;
//   - `pickupAddress` / `pickupMapsUrl` : lieu de retrait, montré dès le modal
//     quand le client choisit « J'envoie un livreur » (estimation de la course
//     AVANT de payer, comme dans le processus WhatsApp manuel).

import { NextResponse } from 'next/server';
import {
  getAvailablePickupSlots,
  getPickupSettings,
} from '@/lib/pickup-settings-db';
import { formatDateKey, getRangesForDay } from '@/lib/pickup-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const settings = await getPickupSettings();
    const slots = await getAvailablePickupSlots(now, settings);

    const days = Array.from({ length: settings.visibleDays }, (_, offset) => {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      return {
        date: formatDateKey(day),
        ranges: getRangesForDay(day, settings),
      };
    });

    return NextResponse.json({
      slots: slots.map((s) => s.toISOString()),
      leadTimeMin: settings.leadTimeMin,
      days,
      pickupAddress: settings.pickupAddress,
      pickupMapsUrl: settings.pickupMapsUrl,
    });
  } catch {
    return NextResponse.json(
      { error: 'Impossible de charger les créneaux' },
      { status: 500 }
    );
  }
}
