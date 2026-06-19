'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectItem } from '@heroui/react';
import { AlertCircle, CheckCircle2, ClipboardList, Search } from 'lucide-react';

import type { InventoryItemView } from '@/lib/inventory';
import { todayDateString } from '@/lib/timezone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { recordInventoryCountAction } from './actions';

const f = new Intl.NumberFormat('fr-FR');

type Props = {
  items: InventoryItemView[];
};

export function InventoryCountGrid({ items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState<string>(todayDateString());
  const [label, setLabel] = useState('');
  const [note] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [counts, setCounts] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Refs des inputs « Compté » pour la navigation clavier (ordre d'affichage).
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Catégories distinctes pour le filtre.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  // Tri par catégorie puis nom, puis filtrage recherche + catégorie.
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ca = a.category ?? '';
      const cb = b.category ?? '';
      const byCat = ca.localeCompare(cb, 'fr');
      if (byCat !== 0) return byCat;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((it) => {
      if (category !== 'all' && (it.category ?? '') !== category) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        (it.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [sorted, search, category]);

  // Lignes saisies (valeur non vide et numérique valide).
  const modifiedCount = useMemo(() => {
    let n = 0;
    for (const value of Object.values(counts)) {
      const trimmed = value.trim();
      if (trimmed === '') continue;
      const num = Number(trimmed);
      if (!Number.isNaN(num) && num >= 0) n++;
    }
    return n;
  }, [counts]);

  function setCount(id: string, value: string) {
    setCounts((prev) => ({ ...prev, [id]: value }));
    setSuccess(null);
  }

  function focusNext(index: number) {
    for (let i = index + 1; i < inputRefs.current.length; i++) {
      const el = inputRefs.current[i];
      if (el) {
        el.focus();
        el.select();
        return;
      }
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusNext(index);
    }
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    const lines: { itemId: string; countedQuantity: number }[] = [];
    for (const [itemId, value] of Object.entries(counts)) {
      const trimmed = value.trim();
      if (trimmed === '') continue;
      const num = Number(trimmed);
      if (Number.isNaN(num) || num < 0) continue;
      lines.push({ itemId, countedQuantity: num });
    }

    if (lines.length === 0) {
      setError('Aucune référence saisie.');
      return;
    }

    startTransition(async () => {
      const result = await recordInventoryCountAction({
        date,
        label: label.trim() || undefined,
        note: note.trim() || undefined,
        lines,
      });
      if (result.ok) {
        setCounts({});
        setSuccess(`Inventaire enregistré : ${lines.length} référence(s).`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <ClipboardList className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aucune référence active à compter. Ajoutez d&apos;abord des articles à
          l&apos;inventaire.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre supérieure */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="count-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Date
            </label>
            <Input
              id="count-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="count-label"
              className="text-xs font-medium text-muted-foreground"
            >
              Libellé (optionnel)
            </label>
            <Input
              id="count-label"
              type="text"
              placeholder="Inventaire juin"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-[200px]"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="count-search"
              className="text-xs font-medium text-muted-foreground"
            >
              Rechercher
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="count-search"
                type="text"
                placeholder="Nom ou réf."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[180px] pl-8"
              />
            </div>
          </div>

          <Select
            aria-label="Filtrer par catégorie"
            size="sm"
            variant="bordered"
            radius="md"
            selectedKeys={[category]}
            disallowEmptySelection
            className="w-[180px]"
            onSelectionChange={(keys) => {
              if (keys === 'all') return;
              setCategory(String(Array.from(keys)[0] ?? 'all'));
            }}
          >
            <>
              <SelectItem key="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </>
          </Select>
        </div>
      </Card>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tableau */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-background">
                Réf
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background">
                Nom
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background">
                Catégorie
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background text-right">
                Stock système
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background text-right">
                Seuil
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background">
                Statut
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background text-right">
                Compté
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-background text-right">
                Écart
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune référence ne correspond à votre recherche.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((it, index) => {
                const raw = counts[it.id] ?? '';
                const trimmed = raw.trim();
                const num = trimmed === '' ? null : Number(trimmed);
                const hasCount = num !== null && !Number.isNaN(num) && num >= 0;
                const diff = hasCount ? num - it.currentQuantity : null;

                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {it.sku}
                    </TableCell>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {it.category ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.format(it.currentQuantity)}{' '}
                      <span className="text-muted-foreground">{it.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {f.format(it.safetyStock)}
                    </TableCell>
                    <TableCell>
                      {it.isLowStock ? (
                        <Badge variant="destructive">Bas</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={raw}
                        onChange={(e) => setCount(it.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onFocus={(e) => e.currentTarget.select()}
                        className="ml-auto h-8 w-28 text-right tabular-nums"
                        aria-label={`Quantité comptée pour ${it.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {diff === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : diff === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : diff > 0 ? (
                        <span className="font-medium text-green-600 dark:text-green-400">
                          +{f.format(diff)}
                        </span>
                      ) : (
                        <span className="font-medium text-destructive">
                          {f.format(diff)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Barre de validation */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{modifiedCount}</span>{' '}
          référence(s) saisie(s)
        </p>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={modifiedCount === 0 || isPending}
        >
          {isPending ? 'Enregistrement…' : "Valider l'inventaire"}
        </Button>
      </div>
    </div>
  );
}
