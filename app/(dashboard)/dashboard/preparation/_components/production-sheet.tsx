'use client';

// « À produire » — la charge de travail de la cuisine, par jour.
//
// Entièrement DÉRIVÉE des commandes (cf. lib/orders/production-plan.ts) : rien
// à saisir, rien à tenir à jour. Le cuisinier ouvre ce panneau le matin et sait
// combien de sponge cakes il doit faire, et dans quels goûts.
//
// Seuls les jours AYANT des commandes apparaissent : une semaine d'onglets à
// « 0 » n'aiderait personne. Le premier jour de la liste est sélectionné
// d'office — donc « Aujourd'hui » s'il y a du travail aujourd'hui, sinon
// directement le prochain jour concerné.
//
// Typographie volontairement large : cet écran se lit de loin, depuis le plan
// de travail, souvent les mains prises.

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import { shiftDateString } from '@/lib/timezone';
import type { ProductionDay } from '@/lib/orders/production-plan';

type Props = {
  plan: ProductionDay[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** « Aujourd'hui » / « Demain » / « lun. 18 » — même vocabulaire que `formatPickup`. */
function dayLabel(date: string): string {
  const today = todayDateString();
  if (date === today) return "Aujourd'hui";
  if (date === shiftDateString(today, 1)) return 'Demain';
  const parsed = parseDateOnlyToUTC(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    weekday: 'short',
    day: '2-digit',
  }).format(parsed);
}

export function ProductionSheet({ plan, open, onOpenChange }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Jour affiché DÉRIVÉ, sans effet de synchronisation : le plan se recalcule à
  // chaque commande lancée et peut vider un jour entier. Retomber sur le
  // premier jour disponible se fait naturellement ici — un `useEffect` qui
  // corrigerait l'état provoquerait un rendu en cascade pour rien.
  const day = plan.find((d) => d.date === selectedDate) ?? plan[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[70vh] max-h-[90vh] gap-0 rounded-t-3xl p-0"
      >
        <SheetHeader className="border-b p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ClipboardList className="h-5 w-5" />À produire
          </SheetTitle>
          <SheetDescription>
            Quantités minimales dictées par les commandes déjà passées
          </SheetDescription>
        </SheetHeader>

        {plan.length === 0 ? (
          <p className="flex-1 px-4 py-10 text-center text-muted-foreground">
            Rien à produire pour l’instant.
          </p>
        ) : (
          <>
            {/* Puces de jour : uniquement les jours réellement chargés. */}
            <div className="flex gap-2 overflow-x-auto border-b px-4 py-3">
              {plan.map((d) => {
                const active = d.date === day?.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    aria-pressed={active}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-muted/50'
                    )}
                  >
                    {dayLabel(d.date)}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-sm tabular-nums',
                        active ? 'bg-white/20' : 'bg-muted'
                      )}
                    >
                      {d.totalItems}
                    </span>
                  </button>
                );
              })}
            </div>

            <ul className="flex-1 divide-y overflow-y-auto">
              {day?.lines.map((line) => (
                <li key={line.productId} className="flex gap-4 px-5 py-4">
                  <span className="min-w-[3ch] shrink-0 text-right font-mono text-3xl font-bold leading-none tabular-nums text-primary">
                    {line.quantity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold leading-tight">
                      {line.productName}
                    </p>
                    {line.flavours.length > 0 && (
                      <p className="mt-1 text-base font-medium text-secondary-600">
                        {line.flavours
                          .map((f) => `${f.quantity} ${f.optionName}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
