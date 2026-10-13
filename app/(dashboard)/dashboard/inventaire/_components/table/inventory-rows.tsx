'use client';

import { Archive, ArchiveRestore, Loader2, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InventoryTableState } from './use-inventory-table';

const f = new Intl.NumberFormat('fr-FR');

export function InventoryRows({ table }: { table: InventoryTableState }) {
  const { filtered, showArchived, pendingId, openEdit, archive, restore } =
    table;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Réf.</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>PMP</TableHead>
            <TableHead>Valeur</TableHead>
            <TableHead>Seuil</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {it.sku}
              </TableCell>
              <TableCell className="text-sm font-medium">{it.name}</TableCell>
              <TableCell>
                {it.category ? (
                  <Badge variant="secondary">{it.category}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {f.format(it.currentQuantity)} {it.unit}
              </TableCell>
              <TableCell className="tabular-nums">
                {f.format(it.avgUnitCost)} F
              </TableCell>
              <TableCell className="tabular-nums">
                {f.format(it.stockValue)} F
              </TableCell>
              <TableCell className="tabular-nums">
                {f.format(it.safetyStock)}
              </TableCell>
              <TableCell>
                {it.isLowStock ? (
                  <Badge variant="destructive">Bas</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(it)}
                    aria-label="Modifier la référence"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => (it.active ? archive(it) : restore(it))}
                    disabled={pendingId === it.id}
                    aria-label={
                      it.active
                        ? 'Archiver la référence'
                        : 'Restaurer la référence'
                    }
                  >
                    {pendingId === it.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : it.active ? (
                      <Archive className="h-4 w-4 text-destructive" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {showArchived
                  ? 'Aucune référence archivée.'
                  : 'Aucune référence.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
