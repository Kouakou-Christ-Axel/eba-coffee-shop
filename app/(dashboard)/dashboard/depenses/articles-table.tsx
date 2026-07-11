'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  History,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  renameExpenseArticleAction,
  deleteExpenseArticleAction,
} from './actions';

export type ArticleStatRow = {
  articleId: string;
  name: string;
  purchaseCount: number;
  totalAmount: number;
  totalQuantity: number | null;
  unit: string | null;
  avgUnitPrice: number | null;
  lastPurchaseDate: string | null;
  avgIntervalDays: number | null;
  monthlyAvgCount: number;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Fréquence d'achat par article sur la sélection courante : répond à
 * « combien de fois a-t-on acheté la farine T45 ? ». Recherche instantanée
 * côté client ; l'icône historique ouvre le drill-down (`?article=`).
 */
export function ArticlesTable({ stats }: { stats: ArticleStatRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter((s) => s.name.toLowerCase().includes(q));
  }, [stats, query]);

  function openHistory(articleId: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('article', articleId);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await renameExpenseArticleAction(id, { name });
      if (!r.ok) setError(r.error);
      else setEditingId(null);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteExpenseArticleAction(id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un article (ex. farine)"
          className="pl-8"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead className="text-right">Achats</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">PU moyen</TableHead>
              <TableHead>Dernier achat</TableHead>
              <TableHead className="text-right">Intervalle moyen</TableHead>
              <TableHead className="text-right">Cadence / mois</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.articleId}>
                <TableCell className="font-medium">
                  {editingId === s.articleId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && saveRename(s.articleId)
                        }
                        className="h-8 max-w-[200px]"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => saveRename(s.articleId)}
                        disabled={pending}
                        aria-label="Valider"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setEditingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    s.name
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.purchaseCount}×
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {priceFmt.format(s.totalAmount)} F
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.totalQuantity != null
                    ? `${qtyFmt.format(s.totalQuantity)} ${s.unit ?? ''}`.trim()
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.avgUnitPrice != null
                    ? `${priceFmt.format(s.avgUnitPrice)} F`
                    : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-sm">
                  {s.lastPurchaseDate ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.avgIntervalDays != null ? `${s.avgIntervalDays} j` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.monthlyAvgCount}×
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openHistory(s.articleId)}
                      aria-label={`Historique de « ${s.name} »`}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(s.articleId);
                        setEditName(s.name);
                      }}
                      aria-label="Renommer l'article"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(s.articleId)}
                      disabled={pending}
                      aria-label="Retirer l'article du référentiel"
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {stats.length === 0
                    ? 'Aucune dépense détaillée sur cette sélection — détaille les articles à la saisie pour alimenter ces statistiques.'
                    : 'Aucun article ne correspond à la recherche.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
