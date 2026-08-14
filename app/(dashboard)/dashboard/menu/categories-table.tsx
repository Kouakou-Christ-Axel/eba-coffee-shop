'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScheduleOption } from '@/components/(dashboard)/schedule-field';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { CategoryRowActions } from './category-row-actions';
import { reorderCategoriesAction } from './actions';

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  available: boolean;
  scheduleId: string | null;
  scheduleName: string | null;
  advanceOrderDays: number | null;
  productCount: number;
};

/** Le cas « aucune catégorie » est traité en amont par `MenuCategoriesView`,
 * qui affiche un état vide porteur d'une action à la place du tableau : une
 * ligne vide dans un tableau ne dit ni ce qu'est une catégorie ni comment en
 * créer une. */
export function CategoriesTable({
  categories,
  schedules,
}: {
  categories: CategoryRow[];
  schedules: ScheduleOption[];
}) {
  const { pushToast } = useUndoToast();
  const reduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  // Ordre local : il porte le glisser en cours et sert de source de vérité
  // optimiste jusqu'au re-rendu serveur. La clé sérialise les lignes entières
  // (et pas seulement les ids) pour que le state se réinitialise aussi sur un
  // renommage ou un changement de disponibilité, pas seulement sur un
  // ajout/suppression. Les listes font quelques dizaines d'entrées.
  const [order, setOrder] = useResettableState(
    JSON.stringify(categories),
    () => categories
  );

  function persist(next: CategoryRow[]) {
    const previous = order;
    setOrder(() => next);
    startTransition(async () => {
      const result = await reorderCategoriesAction(next.map((c) => c.id));
      if (!result.ok) {
        setOrder(() => previous);
        pushToast(result.error, 'error');
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <span className="sr-only">Réordonner</span>
          </TableHead>
          <TableHead>Nom</TableHead>
          <TableHead className="hidden lg:table-cell">Slug</TableHead>
          <TableHead className="hidden sm:table-cell">Produits</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <Reorder.Group
        as="tbody"
        axis="y"
        values={order}
        onReorder={(next: CategoryRow[]) => setOrder(() => next)}
        layoutScroll
        className="[&_tr:last-child]:border-0"
      >
        {order.map((cat, idx) => (
          <CategoryTableRow
            key={cat.id}
            category={cat}
            schedules={schedules}
            isFirst={idx === 0}
            isLast={idx === order.length - 1}
            reduceMotion={!!reduceMotion}
            onDrop={() => persist(order)}
          />
        ))}
      </Reorder.Group>
    </Table>
  );
}

function CategoryTableRow({
  category: cat,
  schedules,
  isFirst,
  isLast,
  reduceMotion,
  onDrop,
}: {
  category: CategoryRow;
  schedules: ScheduleOption[];
  isFirst: boolean;
  isLast: boolean;
  reduceMotion: boolean;
  onDrop: () => void;
}) {
  // `dragListener={false}` + contrôles manuels : sans ça, un glisser démarré
  // n'importe où dans la ligne empêcherait de cliquer l'interrupteur ou le lien.
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="tr"
      value={cat}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      layout="position"
      // `prefers-reduced-motion` : le réagencement devient instantané, mais le
      // glisser reste fonctionnel — réduire le mouvement n'est pas retirer une
      // fonctionnalité.
      transition={reduceMotion ? { duration: 0 } : undefined}
      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
    >
      <TableCell className="w-8 pr-0">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Déplacer ${cat.name}`}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">
        <Link href={`/dashboard/menu/${cat.id}`} className="hover:underline">
          {cat.name}
        </Link>
        <span className="block text-xs text-muted-foreground sm:hidden">
          {cat.productCount} produit{cat.productCount > 1 ? 's' : ''}
        </span>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
        {cat.slug}
      </TableCell>
      <TableCell className="hidden sm:table-cell">{cat.productCount}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={cat.available ? 'default' : 'outline'}>
            {cat.available ? 'Visible' : 'Masquée'}
          </Badge>
          {cat.scheduleName && (
            <Badge variant="outline" title="Planning récurrent">
              {cat.scheduleName}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden md:inline-flex"
          >
            <Link href={`/dashboard/menu/${cat.id}`}>Produits →</Link>
          </Button>
          <CategoryRowActions
            id={cat.id}
            name={cat.name}
            available={cat.available}
            scheduleId={cat.scheduleId}
            advanceOrderDays={cat.advanceOrderDays}
            productCount={cat.productCount}
            schedules={schedules}
            isFirst={isFirst}
            isLast={isLast}
          />
        </div>
      </TableCell>
    </Reorder.Item>
  );
}
