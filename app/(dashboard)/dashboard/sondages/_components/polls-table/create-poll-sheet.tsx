'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PollFormFields } from '../../poll-form-fields';
import type { PollsTableState } from './use-polls-table';

export function CreatePollSheet({ table }: { table: PollsTableState }) {
  const { createOpen, setCreateOpen, values, setValues, error, pending } =
    table;
  const { submitCreate } = table;
  return (
    <Sheet open={createOpen} onOpenChange={setCreateOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouveau sondage</SheetTitle>
          <SheetDescription>
            Crée un sondage avec ses options de vote (au moins 2). Il est créé
            en préparation — ouvre-le ensuite pour lancer le vote.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <PollFormFields
            values={values}
            onChange={(v) => setValues({ ...v, options: values.options })}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Options</p>
            {values.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const options = [...values.options];
                    options[i] = e.target.value;
                    setValues({ ...values, options });
                  }}
                  placeholder={`Option ${i + 1}`}
                />
                {values.options.length > 2 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setValues({
                        ...values,
                        options: values.options.filter((_, j) => j !== i),
                      })
                    }
                    aria-label="Retirer l’option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setValues({ ...values, options: [...values.options, ''] })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Ajouter une option
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="mt-2" onClick={submitCreate} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Créer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
