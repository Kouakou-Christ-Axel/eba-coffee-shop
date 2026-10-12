'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Availability } from './types';
import type { ProductFilters } from './use-product-filters';

export function ProductFiltersBar({
  filters,
  shown,
  total,
}: {
  filters: ProductFilters;
  shown: number;
  total: number;
}) {
  const {
    query,
    setQuery,
    availability,
    setAvailability,
    featuredOnly,
    setFeaturedOnly,
    hasFilters,
    resetFilters,
  } = filters;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-[260px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="h-9 pl-8 pr-8"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery('')}
            aria-label="Effacer la recherche"
            className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Scroll horizontal : sur mobile les onglets élargiraient toute la page. */}
      <div className="min-w-0 max-w-full overflow-x-auto">
        <Tabs
          value={availability}
          onValueChange={(v) => setAvailability(v as Availability)}
          className="w-fit"
        >
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="visible">Visibles</TabsTrigger>
            <TabsTrigger value="hidden">Masqués</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="featured-only"
          checked={featuredOnly}
          onCheckedChange={setFeaturedOnly}
        />
        <Label htmlFor="featured-only" className="text-sm">
          En vedette
        </Label>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Réinitialiser
        </Button>
      )}

      <span className="ml-auto text-sm text-muted-foreground">
        {shown} / {total}
      </span>
    </div>
  );
}
