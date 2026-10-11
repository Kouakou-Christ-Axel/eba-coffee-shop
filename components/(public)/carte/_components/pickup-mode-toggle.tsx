// components/(public)/carte/_components/pickup-mode-toggle.tsx
//
// Les deux cartes « Dès que possible / Planifier » du `SlotPicker` —
// extraites dans ce fichier séparé pour garder slot-picker.tsx sous le seuil
// de 300 lignes (CLAUDE.md) après l'ajout du régime « précommande pure ».

import { CalendarClock, Zap } from 'lucide-react';
import type { PickupTiming } from '@/lib/hooks/use-checkout-form';
import { cn } from '@/lib/utils';

type PickupModeToggleProps = {
  timing: PickupTiming;
  onTimingChange: (timing: PickupTiming) => void;
  openNow: boolean;
  minAllowedDate: string | null;
  soldOutRestricted: boolean;
  cartAvailableNow: boolean;
  leadTimeMin: number;
};

export function PickupModeToggle({
  timing,
  onTimingChange,
  openNow,
  minAllowedDate,
  soldOutRestricted,
  cartAvailableNow,
  leadTimeMin,
}: PickupModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Moment du retrait"
      className="grid grid-cols-2 gap-2"
    >
      <button
        type="button"
        role="radio"
        aria-checked={timing === 'asap'}
        disabled={!openNow}
        onClick={() => onTimingChange('asap')}
        className={cn(
          'flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-3 text-left transition-all',
          timing === 'asap' && openNow
            ? 'border-primary bg-primary/5'
            : 'border-foreground/10',
          openNow
            ? 'hover:border-primary/40 hover:bg-primary/5'
            : 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            timing === 'asap' && openNow ? 'text-primary' : 'text-foreground'
          )}
        >
          <Zap className="h-4 w-4" />
          Dès que possible
        </span>
        <span className="text-xs text-foreground/50">
          {minAllowedDate
            ? // Dire la VRAIE raison : « commande à l'avance » ferait
              // croire à une règle du produit alors que c'est un simple
              // état du jour (et le client se demanderait pourquoi son
              // gâteau habituel exige soudain un délai).
              soldOutRestricted
              ? 'Épuisé aujourd’hui'
              : 'Commande à l’avance requise'
            : !cartAvailableNow
              ? "Indisponible aujourd'hui"
              : openNow
                ? `Prête dans ~${leadTimeMin} min`
                : 'Fermé actuellement'}
        </span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={timing === 'scheduled'}
        onClick={() => onTimingChange('scheduled')}
        className={cn(
          'flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5',
          timing === 'scheduled'
            ? 'border-primary bg-primary/5'
            : 'border-foreground/10'
        )}
      >
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            timing === 'scheduled' ? 'text-primary' : 'text-foreground'
          )}
        >
          <CalendarClock className="h-4 w-4" />
          Planifier
        </span>
        <span className="text-xs text-foreground/50">Choisir jour et heure</span>
      </button>
    </div>
  );
}
