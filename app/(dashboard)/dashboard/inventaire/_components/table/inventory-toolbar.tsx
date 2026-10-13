'use client';

import { Plus } from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InventoryTableState } from './use-inventory-table';

export function InventoryToolbar({
  table,
  categories,
  archivedCount,
}: {
  table: InventoryTableState;
  categories: string[];
  archivedCount: number;
}) {
  const {
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    showArchived,
    setShowArchived,
    openCreate,
  } = table;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (nom, réf.)…"
        className="w-full sm:max-w-xs"
      />
      <Select
        aria-label="Filtrer par catégorie"
        size="sm"
        className="w-full sm:max-w-[200px]"
        selectedKeys={[categoryFilter]}
        disallowEmptySelection
        onSelectionChange={(keys) =>
          setCategoryFilter(String(Array.from(keys)[0] ?? 'all'))
        }
      >
        <>
          <SelectItem key="all">Toutes les catégories</SelectItem>
          <>
            {categories.map((c) => (
              <SelectItem key={c}>{c}</SelectItem>
            ))}
          </>
        </>
      </Select>
      {archivedCount > 0 && (
        <Button
          size="sm"
          variant={showArchived ? 'secondary' : 'ghost'}
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
        >
          {showArchived ? 'Voir les actives' : `Archivées (${archivedCount})`}
        </Button>
      )}
      <div className="ml-auto">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvelle référence
        </Button>
      </div>
    </div>
  );
}
