'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectItem } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';
import type { InventoryItemView } from '@/lib/inventory';
import { todayDateString } from '@/lib/timezone';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { batchRestockAction } from './actions';

const f = new Intl.NumberFormat('fr-FR');

type PaymentMethod = 'CASH' | 'WAVE' | 'BANK' | 'OTHER';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque' },
  { value: 'OTHER', label: 'Autre' },
];

type Line = {
  itemId: string;
  quantity: string;
  unitCost: string;
};

export function RestockGrid({
  items,
  expenseCategories,
}: {
  items: InventoryItemView[];
  expenseCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState<string>(todayDateString());
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [createExpense, setCreateExpense] = useState(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const itemMap = useMemo(() => {
    const m = new Map<string, InventoryItemView>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const availableItems = useMemo(() => {
    const used = new Set(lines.map((l) => l.itemId));
    return items.filter((it) => !used.has(it.id));
  }, [items, lines]);

  const subtotal = (l: Line) => Number(l.quantity) * Number(l.unitCost);

  const grandTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const s = subtotal(l);
        return sum + (Number.isFinite(s) ? s : 0);
      }, 0),
    [lines]
  );

  function addLine(itemId: string) {
    const item = itemMap.get(itemId);
    if (!item) return;
    setSuccess(false);
    setLines((prev) => [
      ...prev,
      {
        itemId,
        quantity: '',
        unitCost: String(item.avgUnitCost),
      },
    ]);
  }

  function updateLine(itemId: string, patch: Partial<Line>) {
    setSuccess(false);
    setLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l))
    );
  }

  function removeLine(itemId: string) {
    setSuccess(false);
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  const lineInvalid = (l: Line) => {
    const q = Number(l.quantity);
    const c = Number(l.unitCost || 0);
    if (l.quantity.trim() === '' || !Number.isFinite(q) || q <= 0) return true;
    if (!Number.isFinite(c) || c < 0) return true;
    return false;
  };

  const hasInvalidLine = lines.some(lineInvalid);
  const missingCategory = createExpense && !expenseCategoryId;

  const canSubmit =
    lines.length > 0 && !hasInvalidLine && !missingCategory && !pending;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSuccess(false);

    const payloadLines = lines
      .filter((l) => Number(l.quantity) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost || 0),
      }));

    const input = {
      date,
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
      createExpense,
      expenseCategoryId: createExpense ? expenseCategoryId : undefined,
      paymentMethod,
      lines: payloadLines,
    };

    startTransition(async () => {
      const res = await batchRestockAction(input);
      if (res.ok) {
        setLines([]);
        setSuccess(true);
        setError(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune référence d&apos;inventaire. Créez d&apos;abord des articles
          pour enregistrer un réappro.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre de réappro (réglages globaux) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Réapprovisionnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="restock-date">Date</Label>
              <Input
                id="restock-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-supplier">Fournisseur (optionnel)</Label>
              <Input
                id="restock-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nom du fournisseur"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-payment">Mode de paiement</Label>
              <Select
                id="restock-payment"
                aria-label="Mode de paiement"
                size="sm"
                disallowEmptySelection
                selectedKeys={[paymentMethod]}
                onSelectionChange={(keys) =>
                  setPaymentMethod(
                    String(Array.from(keys)[0] ?? 'CASH') as PaymentMethod
                  )
                }
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restock-note">Note (optionnel)</Label>
              <Input
                id="restock-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Remarque"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="restock-create-expense"
                checked={createExpense}
                onCheckedChange={(v) => {
                  setCreateExpense(v);
                  setSuccess(false);
                }}
              />
              <Label
                htmlFor="restock-create-expense"
                className="cursor-pointer"
              >
                Créer une dépense liée
              </Label>
            </div>
            {createExpense && (
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="restock-expense-cat">
                  Catégorie de dépense
                </Label>
                <Select
                  id="restock-expense-cat"
                  aria-label="Catégorie de dépense"
                  size="sm"
                  placeholder="Choisir une catégorie"
                  selectedKeys={expenseCategoryId ? [expenseCategoryId] : []}
                  onSelectionChange={(keys) =>
                    setExpenseCategoryId(String(Array.from(keys)[0] ?? ''))
                  }
                >
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id}>{c.name}</SelectItem>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Éditeur de lignes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Références reçues</CardTitle>
          <div className="w-full max-w-xs">
            <Select
              aria-label="Ajouter une référence"
              size="sm"
              placeholder="Ajouter une référence"
              selectedKeys={[]}
              isDisabled={availableItems.length === 0}
              startContent={<Plus className="size-4 shrink-0" />}
              onSelectionChange={(keys) => {
                const id = String(Array.from(keys)[0] ?? '');
                if (id) addLine(id);
              }}
            >
              {availableItems.map((it) => (
                <SelectItem key={it.id}>
                  {it.sku} — {it.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ajoutez une référence pour commencer le réappro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead className="w-32">Qté reçue</TableHead>
                    <TableHead className="w-40">Coût unitaire (F)</TableHead>
                    <TableHead className="w-32 text-right">
                      Sous-total
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const item = itemMap.get(l.itemId);
                    const s = subtotal(l);
                    return (
                      <TableRow key={l.itemId}>
                        <TableCell>
                          <div className="font-medium">
                            {item?.sku} — {item?.name}
                          </div>
                          {item?.unit && (
                            <Badge variant="secondary" className="mt-1">
                              {item.unit}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={l.quantity}
                            aria-label="Quantité reçue"
                            onChange={(e) =>
                              updateLine(l.itemId, { quantity: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={l.unitCost}
                            aria-label="Coût unitaire"
                            onChange={(e) =>
                              updateLine(l.itemId, { unitCost: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {`${f.format(Number.isFinite(s) ? Math.round(s) : 0)} F`}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Retirer la ligne"
                            onClick={() => removeLine(l.itemId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Total général : </span>
              <span className="text-lg font-semibold tabular-nums">
                {`${f.format(Math.round(grandTotal))} F`}
              </span>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {pending ? 'Enregistrement…' : 'Valider le réappro'}
              </Button>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-green-600" role="status">
                  Réappro enregistré
                </p>
              )}
              {missingCategory && (
                <p className="text-sm text-muted-foreground">
                  Choisissez une catégorie de dépense.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
