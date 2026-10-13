'use client';

import Link from 'next/link';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Package,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RowActionsState } from './use-row-actions';

export function RowActionsMenu({
  actions,
  name,
  stockQuantity,
  isFirst,
  isLast,
  canReorder,
  statsHref,
}: {
  actions: RowActionsState;
  name: string;
  stockQuantity: number | null;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
  statsHref: string;
}) {
  const {
    isPending,
    optimisticFeatured,
    setIsRestockOpen,
    setConfirmDelete,
    toggleFeatured,
    handleMove,
  } = actions;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Autres actions pour ${name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={statsHref}>
            <BarChart3 className="size-4" />
            Statistiques
          </Link>
        </DropdownMenuItem>
        {stockQuantity !== null && (
          <DropdownMenuItem onSelect={() => setIsRestockOpen(true)}>
            <Package className="size-4" />
            Ajouter une fournée
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={!canReorder || isFirst}
          onSelect={() => handleMove('up')}
        >
          <ChevronUp className="size-4" />
          Monter
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canReorder || isLast}
          onSelect={() => handleMove('down')}
        >
          <ChevronDown className="size-4" />
          Descendre
        </DropdownMenuItem>
        {/* Le miroir mobile de l'interrupteur « en vedette », masqué sous sm. */}
        <DropdownMenuItem
          className="sm:hidden"
          onSelect={() => toggleFeatured(!optimisticFeatured)}
        >
          <Star className="size-4" />
          {optimisticFeatured
            ? 'Retirer des incontournables'
            : 'Mettre en avant'}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
