'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectItem } from '@heroui/react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { todayDateString } from '@/lib/timezone';

type Mode = 'references' | 'count' | 'purchases';

type ImportResult = {
  error?: string;
  created?: number;
  updated?: number;
  lineCount?: number;
  errors?: string[];
};

const MODE_OPTIONS = [
  { value: 'references', label: 'Références (catalogue)' },
  { value: 'count', label: 'Comptage d’inventaire' },
  { value: 'purchases', label: 'Achats / réappro' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'BANK', label: 'Banque' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export function ImportDialog({
  expenseCategories,
}: {
  expenseCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>('references');
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<string>(todayDateString());
  const [label, setLabel] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [createExpense, setCreateExpense] = useState(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

  const [result, setResult] = useState<ImportResult | null>(null);

  function handleSubmit() {
    if (!file) return;
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    if (mode === 'count') {
      formData.append('date', date);
      if (label) formData.append('label', label);
    }

    if (mode === 'purchases') {
      formData.append('date', date);
      if (supplier) formData.append('supplier', supplier);
      if (note) formData.append('note', note);
      formData.append('paymentMethod', paymentMethod);
      formData.append('createExpense', createExpense ? 'true' : 'false');
      if (createExpense && expenseCategoryId) {
        formData.append('expenseCategoryId', expenseCategoryId);
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/inventory/import', {
          method: 'POST',
          body: formData,
        });
        const data: ImportResult = await res.json();
        setResult(data);
        if (!data.error && (!data.errors || data.errors.length === 0)) {
          router.refresh();
        }
      } catch {
        setResult({ error: 'Erreur réseau lors de l’import.' });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" />
          Importer Excel
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Importer Excel</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <p className="text-sm text-muted-foreground">
            Importez vos données depuis un fichier Excel. Utilisez le modèle
            pour respecter le format attendu.{' '}
            <a
              href="/api/inventory/import-template"
              className="font-medium text-primary underline"
            >
              Télécharger le modèle
            </a>
          </p>

          <div className="space-y-1.5">
            <Label>Type d’import</Label>
            <Select
              aria-label="Type d’import"
              size="sm"
              selectedKeys={[mode]}
              disallowEmptySelection
              onSelectionChange={(keys) =>
                setMode(String(Array.from(keys)[0] ?? 'references') as Mode)
              }
            >
              {MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value}>{o.label}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-file">Fichier (.xlsx, .xls)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {mode === 'count' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="import-date">Date</Label>
                <Input
                  id="import-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-label">Libellé (optionnel)</Label>
                <Input
                  id="import-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex. Comptage mensuel"
                />
              </div>
            </div>
          )}

          {mode === 'purchases' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="import-date">Date</Label>
                <Input
                  id="import-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-supplier">Fournisseur</Label>
                <Input
                  id="import-supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex. Grossiste local"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-note">Note (optionnel)</Label>
                <Input
                  id="import-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Détails…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mode de paiement</Label>
                <Select
                  aria-label="Mode de paiement"
                  size="sm"
                  selectedKeys={[paymentMethod]}
                  disallowEmptySelection
                  onSelectionChange={(keys) =>
                    setPaymentMethod(String(Array.from(keys)[0] ?? 'CASH'))
                  }
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value}>{o.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="import-create-expense"
                  checked={createExpense}
                  onCheckedChange={setCreateExpense}
                />
                <Label htmlFor="import-create-expense">
                  Créer une dépense liée
                </Label>
              </div>
              {createExpense && (
                <div className="space-y-1.5">
                  <Label>Catégorie de dépense</Label>
                  <Select
                    aria-label="Catégorie de dépense"
                    size="sm"
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
          )}

          <Button
            className="w-full"
            disabled={!file || isPending}
            onClick={handleSubmit}
          >
            {isPending ? 'Import en cours…' : 'Importer'}
          </Button>

          {result && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              {result.error ? (
                <p className="text-destructive">{result.error}</p>
              ) : (
                <>
                  {mode === 'references' && (
                    <p>
                      {result.created ?? 0} créées, {result.updated ?? 0} mises
                      à jour
                    </p>
                  )}
                  {mode === 'count' && <p>{result.lineCount ?? 0} ligne(s)</p>}
                  {mode === 'purchases' && <p>Lot créé</p>}
                  {result.errors && result.errors.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-destructive">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
