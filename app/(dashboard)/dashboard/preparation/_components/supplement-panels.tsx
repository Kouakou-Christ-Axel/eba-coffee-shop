import { cn } from '@/lib/utils';
import type {
  AggregatedSupplement,
  AggregatedSupplementLine,
} from '@/lib/orders/format';

type Size = 'sm' | 'md' | 'lg';

// Goûts et suppléments sont affichés dans deux cadres de couleurs différentes :
// en cuisine, un « Chocolat » dans le produit et un « Chocolat » ajouté
// dessus ne doivent jamais se lire comme la même chose.
const KIND_STYLE = {
  flavor: {
    title: 'Goûts',
    box: 'border-primary/30 bg-primary/5',
    heading: 'text-primary',
    options: 'text-primary',
  },
  extra: {
    title: 'Suppléments',
    box: 'border-secondary-200 bg-secondary-50/60 dark:border-secondary-900 dark:bg-secondary-950/20',
    heading: 'text-secondary-700 dark:text-secondary-300',
    options: 'text-secondary-700 dark:text-secondary-300',
  },
} as const;

const SIZE_STYLE: Record<
  Size,
  { box: string; heading: string; list: string; item: string; product: string }
> = {
  sm: {
    box: 'rounded-lg p-2',
    heading: 'text-[11px]',
    list: 'mt-1 space-y-0.5',
    item: 'text-sm',
    product: 'font-semibold',
  },
  md: {
    box: 'rounded-lg p-2',
    heading: 'text-xs',
    list: 'mt-1 space-y-1',
    item: 'text-sm',
    product: 'font-semibold',
  },
  lg: {
    box: 'mt-4 rounded-xl p-4',
    heading: 'text-sm',
    list: 'mt-2 space-y-2',
    item: 'text-lg',
    product: 'font-bold',
  },
};

function label(s: AggregatedSupplement): string {
  return s.quantity > 1 ? `${s.optionName} ×${s.quantity}` : s.optionName;
}

function KindPanel({
  kind,
  lines,
  size,
}: {
  kind: 'flavor' | 'extra';
  lines: AggregatedSupplementLine[];
  size: Size;
}) {
  const k = KIND_STYLE[kind];
  const sz = SIZE_STYLE[size];
  // Une ligne ne garde que les éléments de CETTE nature ; sans aucun, elle disparaît du cadre.
  const rows = lines
    .map((line) => ({
      line,
      picked: line.supplements.filter((s) => (s.kind ?? 'extra') === kind),
    }))
    .filter((r) => r.picked.length > 0);
  if (rows.length === 0) return null;

  return (
    <div className={cn('border', k.box, sz.box)}>
      <p
        className={cn(
          'font-bold uppercase tracking-wide',
          k.heading,
          sz.heading
        )}
      >
        {k.title}
      </p>
      <ul className={sz.list}>
        {rows.map(({ line, picked }) => (
          <li key={line.key} className={sz.item}>
            <span className={sz.product}>
              {line.productName}
              {line.quantity > 1 ? ` ×${line.quantity}` : ''}
            </span>{' '}
            <span className={cn('font-medium', k.options)}>
              {picked.map(label).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Zone « Goûts » puis « Suppléments » d'un ticket de cuisine, fusionnée par
 * produit + jeu de choix avec quantité totale explicite (voir
 * `aggregateOrderSupplements`) pour ne jamais lire « 1 » là où il y en a 2.
 */
export function SupplementPanels({
  lines,
  size,
}: {
  lines: AggregatedSupplementLine[];
  size: Size;
}) {
  if (lines.length === 0) return null;
  return (
    <>
      <KindPanel kind="flavor" lines={lines} size={size} />
      <KindPanel kind="extra" lines={lines} size={size} />
    </>
  );
}
