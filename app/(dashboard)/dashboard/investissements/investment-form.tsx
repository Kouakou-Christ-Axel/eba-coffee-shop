'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayDateString } from '@/lib/timezone';
import { DocumentPicker } from './_components/investment-form/document-picker';
import { InvestmentFieldsSection } from './_components/investment-form/investment-fields-section';
import { RepaymentSection } from './_components/investment-form/repayment-section';
import type {
  InvestmentFormValues,
  Source,
} from './_components/investment-form/types';
import { useInvestmentForm } from './_components/investment-form/use-investment-form';

export type { InvestmentFormValues } from './_components/investment-form/types';

/** Valeurs par défaut d'un nouvel apport (formulaire vierge). */
export function emptyInvestment(sources: Source[]): InvestmentFormValues {
  return {
    date: todayDateString(),
    amount: '',
    sourceId: sources[0]?.id ?? '',
    paymentMethod: 'CASH',
    financier: '',
    note: '',
    documentUrl: null,
    reimbursable: false,
    amountRepaid: '',
    dueDate: '',
  };
}

export function InvestmentForm({
  sources,
  mode,
  initial,
  onSuccess,
}: {
  sources: Source[];
  mode: 'create' | 'edit';
  initial: InvestmentFormValues;
  /** Appelé après une écriture réussie (fermeture du Sheet par le parent). */
  onSuccess: () => void;
}) {
  const form = useInvestmentForm({ mode, initial, onSuccess });
  const { error, pending, busy, submit } = form;

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crée d’abord une source de financement pour pouvoir saisir un apport.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <InvestmentFieldsSection form={form} sources={sources} />

      <RepaymentSection form={form} />

      <DocumentPicker form={form} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={submit}
        disabled={busy}
        className={cn(busy && 'opacity-70')}
      >
        {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {mode === 'edit'
          ? 'Enregistrer les modifications'
          : 'Enregistrer l’apport'}
      </Button>
    </div>
  );
}
