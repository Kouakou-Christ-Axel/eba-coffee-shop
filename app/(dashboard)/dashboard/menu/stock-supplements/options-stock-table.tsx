'use client';

import { useMemo, useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockBadge } from '@/components/(dashboard)/stock-badge';
import { setOptionStockAction } from '../actions';

export type OptionStockRowWithPending = {
  id: string;
  optionName: string;
  price: number;
  stockQuantity: number | null;
  groupName: string;
  isGlobal: boolean;
  productId: string | null;
  productName: string | null;
  categoryName: string | null;
  pending: number;
};

const priceFmt = new Intl.NumberFormat('fr-FR');

export function OptionsStockTable({
  rows,
}: {
  rows: OptionStockRowWithPending[];
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.optionName.toLowerCase().includes(q) ||
        r.groupName.toLowerCase().includes(q) ||
        (r.productName ?? '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:w-[280px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un goût, un groupe, un produit…"
          className="pl-8 h-9"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead>Goût / option</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>En attente</TableHead>
            <TableHead className="text-right">Modifier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.isGlobal ? (
                  <Badge variant="secondary">Extra global</Badge>
                ) : (
                  <span>
                    {r.productName}
                    {r.categoryName && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({r.categoryName})
                      </span>
                    )}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.groupName}
              </TableCell>
              <TableCell>{r.optionName}</TableCell>
              <TableCell>{priceFmt.format(r.price)} FCFA</TableCell>
              <TableCell>
                <StockBadge stockQuantity={r.stockQuantity} />
              </TableCell>
              <TableCell>
                {r.pending > 0 ? (
                  <span
                    className="text-sm text-amber-700 dark:text-amber-400"
                    title="Quantité déjà demandée par des commandes non payées"
                  >
                    {r.pending}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <StockQuickEdit
                  optionId={r.id}
                  stockQuantity={r.stockQuantity}
                />
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {rows.length === 0
                  ? 'Aucune option à stock suivi pour le moment.'
                  : 'Aucune option ne correspond à la recherche.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StockQuickEdit({
  optionId,
  stockQuantity,
}: {
  optionId: string;
  stockQuantity: number | null;
}) {
  const [value, setValue] = useState(String(stockQuantity ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError('Invalide');
      return;
    }
    startTransition(async () => {
      try {
        await setOptionStockAction(optionId, quantity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="h-8 w-20 text-right"
      />
      <Button size="sm" variant="outline" disabled={isPending} onClick={save}>
        {isPending ? '…' : 'OK'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
