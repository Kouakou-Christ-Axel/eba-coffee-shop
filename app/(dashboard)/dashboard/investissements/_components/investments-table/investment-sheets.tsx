'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  InvestmentForm,
  type InvestmentFormValues,
} from '../../investment-form';
import { SourceManager } from '../../source-manager';
import type { Source, SourceWithCount } from './types';

export function InvestmentSheets({
  formOpen,
  setFormOpen,
  formMode,
  formInitial,
  plainSources,
  sourcesOpen,
  setSourcesOpen,
  sources,
}: {
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  formMode: 'create' | 'edit';
  formInitial: InvestmentFormValues;
  plainSources: Source[];
  sourcesOpen: boolean;
  setSourcesOpen: (open: boolean) => void;
  sources: SourceWithCount[];
}) {
  return (
    <>
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
    </>
  );
}
