'use client';

import { useState, useTransition } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteInvestmentAction } from './actions';
import { emptyInvestment, type InvestmentFormValues } from './investment-form';
import { InvestmentSheets } from './_components/investments-table/investment-sheets';
import { InvestmentTotals } from './_components/investments-table/investment-totals';
import { InvestmentsRows } from './_components/investments-table/investments-rows';
import { rowToValues } from './_components/investments-table/row-to-values';
import type {
  InvestmentRow,
  Source,
  SourceWithCount,
} from './_components/investments-table/types';

export type { InvestmentRow } from './_components/investments-table/types';

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
      <InvestmentsRows
        investments={investments}
        pendingId={pendingId}
        onEdit={openEdit}
        onDuplicate={openDuplicate}
        onRemove={remove}
      />

      <InvestmentTotals total={total} totalOutstanding={totalOutstanding} />

      <InvestmentSheets
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        formMode={formMode}
        formInitial={formInitial}
        plainSources={plainSources}
        sourcesOpen={sourcesOpen}
        setSourcesOpen={setSourcesOpen}
        sources={sources}
      />
    </div>
  );
}
