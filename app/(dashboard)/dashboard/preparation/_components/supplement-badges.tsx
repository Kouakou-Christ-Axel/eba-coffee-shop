import { cn } from '@/lib/utils';
import { formatSupplementLabel } from '@/lib/orders/format';
import { splitSupplementsByKind } from '@/lib/supplements/kind';
import type { CartItemSupplement } from '@/lib/cart-store';

type Size = 'sm' | 'md' | 'lg';

// Goûts et suppléments sont des badges de couleurs différentes : en cuisine, un
// « Chocolat » dans le produit et un « Chocolat » ajouté dessus ne doivent
// jamais se lire comme la même chose. Le « + » des suppléments évite de
// reposer sur la seule couleur.
const KIND_STYLE = {
  flavor: 'bg-primary/15 text-primary',
  extra:
    'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/40 dark:text-secondary-200',
} as const;

const SIZE_STYLE: Record<Size, { wrap: string; badge: string }> = {
  sm: { wrap: 'mt-0.5 gap-1', badge: 'px-2 py-0.5 text-xs font-semibold' },
  md: { wrap: 'mt-1 gap-1', badge: 'px-2 py-0.5 text-sm font-semibold' },
  lg: { wrap: 'mt-2 gap-2', badge: 'px-3 py-1 text-lg font-semibold' },
};

/**
 * Choix d'UNE ligne de commande, sous le nom du produit (qu'ils n'ont donc pas
 * besoin de répéter) : goûts d'abord, puis suppléments. Le rendu est par ligne
 * (`cartId`) et non fusionné : deux fondants ajoutés séparément restent deux
 * lignes, jamais une seule unité.
 */
export function SupplementBadges({
  supplements,
  size,
}: {
  supplements: CartItemSupplement[];
  size: Size;
}) {
  if (supplements.length === 0) return null;
  const { flavors, extras } = splitSupplementsByKind(supplements);
  const sz = SIZE_STYLE[size];

  return (
    <ul className={cn('flex flex-wrap', sz.wrap)}>
      {[
        ...flavors.map((s) => ({ s, kind: 'flavor' as const })),
        ...extras.map((s) => ({ s, kind: 'extra' as const })),
      ].map(({ s, kind }) => (
        <li
          key={`${kind}:${s.groupName}:${s.optionName}`}
          className={cn('rounded-full', KIND_STYLE[kind], sz.badge)}
        >
          {kind === 'extra' ? '+ ' : ''}
          {formatSupplementLabel(s)}
        </li>
      ))}
    </ul>
  );
}
