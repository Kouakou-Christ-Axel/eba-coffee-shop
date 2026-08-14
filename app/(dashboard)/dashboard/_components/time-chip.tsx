'use client';

// Le raccourci de temps du dashboard — UN seul style, partout.
//
// Pourquoi ce composant existe : les trois rangées de raccourcis de l'app ne se
// ressemblaient pas, et surtout la plus utilisée — les présets de créneau de
// « Modifier la prise en charge » — marquait le bouton actif avec un
// `bg-primary/10`, soit un violet à 10 % d'opacité. Sur la tablette du
// comptoir, lue de biais et à un mètre, ce fond ne se distingue pas d'un bouton
// inerte : le caissier cliquait « Dans 2h », l'heure changeait dans le champ,
// et rien ne le lui confirmait là où il regardait.
//
// L'état actif est donc PLEIN (fond primaire, texte inversé) + une coche. La
// coche n'est pas décorative : elle porte l'information sans dépendre de la
// couleur, pour un daltonien comme pour un écran délavé par le soleil.

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  onPress: () => void;
  /**
   * DÉRIVE cette valeur de la donnée soumise quand c'est possible (cf.
   * `isPickupAt`, lib/orders/scheduling.ts) plutôt que de la stocker à côté :
   * un état parallèle finit par mentir sur ce qui sera réellement enregistré.
   * Un préset relatif (« dans 2h ») fait exception — il n'est pas
   * reconnaissable après coup et garde un état explicite.
   */
  isActive: boolean;
  /** Action serveur en vol : le bouton se met en retrait et n'est plus cliquable. */
  isPending?: boolean;
  /** `sm` (h-9) pour cohabiter avec des boutons shadcn `sm` ; `md` (h-11) pour le tactile. */
  size?: 'sm' | 'md';
  className?: string;
};

export function TimeChip({
  children,
  onPress,
  isActive,
  isPending = false,
  size = 'md',
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isPending}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-sm',
        isActive
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-background hover:bg-muted',
        isPending && 'cursor-wait opacity-60',
        className
      )}
    >
      {isActive && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
