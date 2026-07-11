'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type ArticleHistoryLine = {
  id: string;
  label: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  date: string;
  receiptNo: string | null;
  supplier: string | null;
  categoryName: string;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Drill-down d'un article (« farine T45 ») : chaque achat avec sa dépense.
 * Ouvert quand `?article=` est présent ; la fermeture retire le paramètre.
 */
export function ArticleHistorySheet({
  articleName,
  lines,
}: {
  articleName: string;
  lines: ArticleHistoryLine[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('article');
    router.replace(sp.size > 0 ? `?${sp.toString()}` : '?', { scroll: false });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{articleName}</SheetTitle>
          <SheetDescription>
            {lines.length} achat{lines.length > 1 ? 's' : ''} sur la sélection —{' '}
            {priceFmt.format(total)} F au total.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>N° reçu</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">PU</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Fournisseur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    {l.date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {l.receiptNo ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.quantity != null
                      ? `${qtyFmt.format(l.quantity)} ${l.unit ?? ''}`.trim()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.unitPrice != null
                      ? `${priceFmt.format(l.unitPrice)} F`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {priceFmt.format(l.amount)} F
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                    {l.supplier ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucun achat sur cette sélection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
