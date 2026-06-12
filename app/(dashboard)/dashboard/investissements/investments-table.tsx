'use client';

import { useState, useTransition } from 'react';
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  Trash2,
} from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { todayDateString } from '@/lib/timezone';
import { deleteInvestmentAction } from './actions';
import {
  InvestmentForm,
  emptyInvestment,
  type InvestmentFormValues,
} from './investment-form';
import { SourceManager } from './source-manager';

type Source = { id: string; name: string };
type SourceWithCount = Source & { _count: { investments: number } };

export type InvestmentRow = {
  id: string;
  date: string;
  amount: number;
  paymentLabel: string;
  paymentMethod: string;
  sourceId: string;
  sourceName: string;
  financier: string | null;
  note: string | null;
  documentUrl: string | null;
  reimbursable: boolean;
  amountRepaid: number;
  outstanding: number;
  dueDate: string | null;
};

const priceFmt = new Intl.NumberFormat('fr-FR');

function rowToValues(
  r: InvestmentRow,
  mode: 'edit' | 'duplicate'
): InvestmentFormValues {
  return {
    id: mode === 'edit' ? r.id : undefined,
    date: mode === 'duplicate' ? todayDateString() : r.date,
    amount: String(r.amount),
    sourceId: r.sourceId,
    paymentMethod: r.paymentMethod,
    financier: r.financier ?? '',
    note: r.note ?? '',
    documentUrl: mode === 'duplicate' ? null : r.documentUrl,
    reimbursable: r.reimbursable,
    amountRepaid: r.reimbursable ? String(r.amountRepaid) : '',
    dueDate: r.dueDate ?? '',
  };
}

export function InvestmentsTable({
  investments,
  sources,
  total,
  totalOutstanding,
}: {
  investments: InvestmentRow[];
  sources: SourceWithCount[];
  total: number;
  totalOutstanding: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sheet de saisie (création / édition / duplication).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<InvestmentFormValues>(() =>
    emptyInvestment(sources)
  );
  // Sheet de gestion des sources.
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const plainSources: Source[] = sources.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  function openCreate() {
    setFormMode('create');
    setFormInitial(emptyInvestment(sources));
    setFormOpen(true);
  }

  function openEdit(r: InvestmentRow) {
    setFormMode('edit');
    setFormInitial(rowToValues(r, 'edit'));
    setFormOpen(true);
  }

  function openDuplicate(r: InvestmentRow) {
    setFormMode('create');
    setFormInitial(rowToValues(r, 'duplicate'));
    setFormOpen(true);
  }

  function remove(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await deleteInvestmentAction(id);
      setPendingId(null);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSourcesOpen(true)}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Gérer les sources
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nouvel apport
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Financeur</TableHead>
              <TableHead>Remboursement</TableHead>
              <TableHead>Justif.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {investments.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="whitespace-nowrap font-mono text-sm">
                  {i.date}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{i.sourceName}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {priceFmt.format(i.amount)} F
                </TableCell>
                <TableCell className="text-sm">{i.paymentLabel}</TableCell>
                <TableCell className="text-sm">{i.financier ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  {!i.reimbursable ? (
                    <span className="text-muted-foreground">
                      Non remboursable
                    </span>
                  ) : i.outstanding === 0 ? (
                    <Badge variant="outline" className="text-green-600">
                      Soldé
                    </Badge>
                  ) : (
                    <span className="tabular-nums">
                      Reste {priceFmt.format(i.outstanding)} F
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {i.documentUrl ? (
                    <a
                      href={i.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline"
                      aria-label="Voir le justificatif"
                    >
                      <Receipt className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(i)}
                      aria-label="Modifier l’apport"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openDuplicate(i)}
                      aria-label="Dupliquer l’apport"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(i.id)}
                      disabled={pendingId === i.id}
                      aria-label="Supprimer l’apport"
                    >
                      {pendingId === i.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {investments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun apport sur cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
        {totalOutstanding > 0 && (
          <span className="text-muted-foreground">
            Restant dû :{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {priceFmt.format(totalOutstanding)} F
            </span>
          </span>
        )}
        <span className="text-muted-foreground">
          Total investi :{' '}
          <span className="font-bold tabular-nums text-foreground">
            {priceFmt.format(total)} F
          </span>
        </span>
      </div>

      {/* Sheet de saisie */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {formMode === 'edit' ? 'Modifier l’apport' : 'Nouvel apport'}
            </SheetTitle>
            <SheetDescription>
              Apport ou financement injecté dans l’affaire.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <InvestmentForm
              // Remonte le formulaire à chaque ouverture (reset des champs).
              key={`${formMode}-${formInitial.id ?? 'new'}-${formOpen}`}
              sources={plainSources}
              mode={formMode}
              initial={formInitial}
              onSuccess={() => setFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de gestion des sources */}
      <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sources de financement</SheetTitle>
            <SheetDescription>
              Capital propre, prêt, apport d’associé, subvention…
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <SourceManager sources={sources} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
