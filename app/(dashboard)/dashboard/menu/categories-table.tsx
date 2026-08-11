'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScheduleOption } from '@/components/(dashboard)/schedule-field';
import { CategoryRowActions } from './category-row-actions';

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

type Visibility = 'all' | 'visible' | 'hidden';

export function CategoriesTable({
  categories,
  schedules,
}: {
  categories: CategoryRow[];
  schedules: ScheduleOption[];
}) {
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('all');

  const isFiltered = query.trim().length > 0 || visibility !== 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.includes(q)) {
        return false;
      }
      if (visibility === 'visible' && !c.available) return false;
      if (visibility === 'hidden' && c.available) return false;
      return true;
    });
  }, [categories, query, visibility]);

  // Réordonner ne peut se faire que sur la liste complète : sous filtre, la
  // ligne « au-dessus » à l'écran n'est pas forcément la voisine réelle, et un
  // échange de `sortOrder` produirait un résultat incompréhensible.
  const reorderDisabledReason = isFiltered
    ? 'Réinitialisez les filtres pour réordonner'
    : undefined;

  // Position réelle dans la carte, pour désactiver la flèche des extrémités.
  const positions = useMemo(
    () => new Map(categories.map((c, i) => [c.id, i])),
    [categories]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une catégorie…"
            className="h-9 pl-8"
            aria-label="Rechercher une catégorie"
          />
        </div>

        <Tabs
          value={visibility}
          onValueChange={(v) => setVisibility(v as Visibility)}
        >
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="visible">Visibles</TabsTrigger>
            <TabsTrigger value="hidden">Masquées</TabsTrigger>
          </TabsList>
        </Tabs>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setVisibility('all');
            }}
          >
            Réinitialiser
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {categories.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="hidden md:table-cell">Slug</TableHead>
            <TableHead className="text-right">Produits</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((cat) => {
            const position = positions.get(cat.id) ?? 0;
            return (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/menu/${cat.id}`}
                    className="hover:underline"
                  >
                    {cat.name}
                  </Link>
                  <span className="block font-mono text-xs font-normal text-muted-foreground md:hidden">
                    {cat.slug}
                  </span>
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {cat.slug}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {cat.productCount > 0 ? (
                    <Link
                      href={`/dashboard/menu/${cat.id}`}
                      className="hover:underline"
                    >
                      {cat.productCount}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
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
                    {cat.advanceOrderDays !== null && (
                      <Badge
                        variant="outline"
                        title="Délai minimum entre la commande et le retrait"
                      >
                        J+{cat.advanceOrderDays}
                      </Badge>
                    )}
                    {cat.available && cat.productCount === 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700 dark:text-amber-400"
                        title="Catégorie visible mais vide : rien ne s’affiche sur la carte"
                      >
                        Vide
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <CategoryRowActions
                    id={cat.id}
                    name={cat.name}
                    available={cat.available}
                    scheduleId={cat.scheduleId}
                    advanceOrderDays={cat.advanceOrderDays}
                    productCount={cat.productCount}
                    schedules={schedules}
                    isFirst={position === 0}
                    isLast={position === categories.length - 1}
                    reorderDisabledReason={reorderDisabledReason}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {categories.length === 0
                  ? 'Aucune catégorie. Créez-en une avec « + Nouvelle catégorie ».'
                  : 'Aucune catégorie ne correspond aux filtres.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
