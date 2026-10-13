'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Chip } from './chip';
import { CountProgress } from './count-progress';
import type { CountViewState } from './use-count-view';

export function CountToolbar({
  view,
  total,
}: {
  view: CountViewState;
  total: number;
}) {
  const {
    entered,
    search,
    zone,
    filter,
    zones,
    selectSearch,
    selectFilter,
    selectZone,
  } = view;
  return (
    <>
      {/* Barre de travail. Elle reste à l'écran pendant tout le comptage : elle
          est donc tenue au strict nécessaire — sur 844 px de haut, chaque ligne
          gagnée est une référence de plus visible. */}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <CountProgress entered={entered} total={total} />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher une référence"
            value={search}
            onChange={(e) => selectSearch(e.target.value)}
            className="h-10 pl-8"
            aria-label="Rechercher une référence"
          />
        </div>

        {/* Filtres puis zones sur une seule ligne défilante : les trois filtres
            restent visibles sans geste, les zones se parcourent au pouce. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <div className="flex w-max items-center gap-1.5">
            <Chip
              active={filter === 'todo'}
              onClick={() => selectFilter('todo')}
              label="À compter"
            />
            <Chip
              active={filter === 'diff'}
              onClick={() => selectFilter('diff')}
              label="Écarts"
            />
            <Chip
              active={filter === 'all'}
              onClick={() => selectFilter('all')}
              label="Toutes"
            />

            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

            <Chip
              active={zone === 'all'}
              onClick={() => selectZone('all')}
              label="Toutes zones"
            />
            {zones.map((z) => (
              <Chip
                key={z.name}
                active={zone === z.name}
                onClick={() => selectZone(z.name)}
                label={`${z.name} ${z.done}/${z.total}`}
                done={z.done === z.total}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
