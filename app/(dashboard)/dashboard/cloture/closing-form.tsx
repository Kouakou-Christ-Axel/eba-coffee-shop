'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { computeClosing } from '@/lib/cash-closing-compute';
import { saveCashClosingAction } from './actions';

const fmt = new Intl.NumberFormat('fr-FR');

type ExistingClosing = {
  openingFloat: number;
  countedCash: number;
  note: string | null;
  closedByLabel: string | null;
  updatedAt: string;
} | null;

export function ClosingForm({
  date,
  cashSales,
  cashExpenses,
  existing,
}: {
  date: string;
  cashSales: number;
  cashExpenses: number;
  existing: ExistingClosing;
}) {
  const [openingFloat, setOpeningFloat] = useState(
    String(existing?.openingFloat ?? 0)
  );
  const [countedCash, setCountedCash] = useState(
    existing ? String(existing.countedCash) : ''
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const floatN = Number(openingFloat) || 0;
  const countedN = Number(countedCash) || 0;
  const { expectedCash, difference } = computeClosing({
    openingFloat: floatN,
    cashSales,
    cashExpenses,
    countedCash: countedN,
  });

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await saveCashClosingAction({
        date,
        openingFloat: Math.round(floatN),
        countedCash: Math.round(countedN),
        note: note.trim() || null,
      });
      if (!r.ok) setError(r.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-5">
      {/* Récapitulatif espèces */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Ventes espèces" value={cashSales} />
        <Figure label="Dépenses espèces" value={cashExpenses} negative />
        <div className="space-y-1.5">
          <Label htmlFor="float">Fond de caisse</Label>
          <Input
            id="float"
            type="number"
            min={0}
            inputMode="numeric"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </div>
        <Figure label="Caisse théorique" value={expectedCash} strong />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="counted">Espèces comptées</Label>
          <Input
            id="counted"
            type="number"
            min={0}
            inputMode="numeric"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            placeholder="Montant réel dans le tiroir"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Écart</Label>
          <div
            className={cn(
              'flex h-9 items-center rounded-md border px-3 text-sm font-bold tabular-nums',
              difference === 0
                ? 'text-muted-foreground'
                : difference > 0
                  ? 'text-green-600'
                  : 'text-destructive'
            )}
          >
            {difference > 0 ? '+' : ''}
            {fmt.format(difference)} F
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {difference === 0
                ? '(équilibrée)'
                : difference > 0
                  ? '(excédent)'
                  : '(manquant)'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cl-note">Note (optionnel)</Label>
        <Input
          id="cl-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. billet manquant, erreur de rendu…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-600">Clôture enregistrée.</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {existing ? 'Mettre à jour la clôture' : 'Clôturer la caisse'}
        </Button>
        {existing && (
          <span className="text-xs text-muted-foreground">
            Dernière clôture : {existing.updatedAt}
            {existing.closedByLabel ? ` · ${existing.closedByLabel}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className={cn(
          'flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums',
          strong && 'font-bold'
        )}
      >
        {negative && value > 0 ? '−' : ''}
        {fmt.format(value)} F
      </div>
    </div>
  );
}
