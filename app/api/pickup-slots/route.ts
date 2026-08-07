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
//
// `?minDays=N` (optionnel) : étend l'horizon au-delà de
// `settings.visibleDays` quand le panier contient un article exigeant une
// commande à l'avance de N jours (voir `Product.advanceOrderDays`,
// lib/menu.ts) — n'étend JAMAIS en deçà du réglage global, et reste plafonné
// à `ADVANCE_ORDER_DAYS_MAX` (défense en profondeur contre une valeur
// aberrante en entrée).

import { NextResponse } from 'next/server';
import {
  getAvailablePickupSlots,
  getPickupSettings,
} from '@/lib/pickup-settings-db';
import { formatDateKey, getRangesForDay } from '@/lib/pickup-settings';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const now = new Date();
    const baseSettings = await getPickupSettings();

    const minDaysParam = Number(
      new URL(req.url).searchParams.get('minDays') ?? '0'
    );
    const minDays = Number.isFinite(minDaysParam)
      ? Math.min(Math.max(0, Math.trunc(minDaysParam)), ADVANCE_ORDER_DAYS_MAX)
      : 0;
    const settings = {
      ...baseSettings,
      visibleDays: Math.max(baseSettings.visibleDays, minDays),
    };

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
