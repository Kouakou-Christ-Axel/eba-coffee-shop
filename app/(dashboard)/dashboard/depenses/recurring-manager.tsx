'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  deleteRecurringExpenseAction,
} from './actions';

type Category = { id: string; name: string };

export type RecurringRow = {
  id: string;
  label: string;
  categoryId: string;
  categoryName: string;
  expectedAmount: number | null;
  active: boolean;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function RecurringManager({
  recurring,
  categories,
}: {
  recurring: RecurringRow[];
  categories: Category[];
}) {
  const [label, setLabel] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const l = label.trim();
    if (!l) return;
    if (!categoryId) {
      setError('Choisis une catégorie');
      return;
    }
    setError(null);
    const amountInt = amount ? Math.round(Number(amount)) : null;
    startTransition(async () => {
      const r = await createRecurringExpenseAction({
        label: l,
        categoryId,
        expectedAmount: amountInt && amountInt > 0 ? amountInt : null,
      });
      if (!r.ok) setError(r.error);
      else {
        setLabel('');
        setAmount('');
      }
    });
  }

  function toggleActive(row: RecurringRow) {
    setError(null);
    startTransition(async () => {
      const r = await updateRecurringExpenseAction(row.id, {
        active: !row.active,
      });
      if (!r.ok) setError(r.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteRecurringExpenseAction(id);
      if (!r.ok) setError(r.error);
    });
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crée d’abord une catégorie pour définir une dépense récurrente.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Définis tes dépenses récurrentes (loyer, abonnements, salaires…). Tu
        seras alerté si elles ne sont pas saisies dans le mois.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="rec-label">Libellé</Label>
          <Input
            id="rec-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ex. Loyer"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-cat">Catégorie</Label>
          <select
            id="rec-cat"
            className={selectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-amount">Montant (opt.)</Label>
          <Input
            id="rec-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-28"
          />
        </div>
      </div>
      <Button onClick={add} disabled={pending || !label.trim()} size="sm">
        {pending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-1.5 h-4 w-4" />
        )}
        Ajouter
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {recurring.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune dépense récurrente définie.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {recurring.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.categoryName}
                  {r.expectedAmount
                    ? ` · ${priceFmt.format(r.expectedAmount)} F`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={r.active}
                  onCheckedChange={() => toggleActive(r)}
                  aria-label={r.active ? 'Désactiver' : 'Activer'}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(r.id)}
                  disabled={pending}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
