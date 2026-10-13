'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ItemForm } from '../../item-form';
import type { InventoryTableState } from './use-inventory-table';

export function ItemSheets({
  table,
  categories,
}: {
  table: InventoryTableState;
  categories: string[];
}) {
  const {
    pending,
    formError,
    createOpen,
    setCreateOpen,
    createValues,
    setCreateValues,
    editItem,
    setEditItem,
    editValues,
    setEditValues,
    submitCreate,
    submitEdit,
  } = table;
  return (
    <>
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Nouvelle référence</SheetTitle>
            <SheetDescription>
              Ajoute un article au stock (avec un stock d’ouverture optionnel).
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ItemForm
              values={createValues}
              onChange={setCreateValues}
              isNew
              categories={categories}
            />
            {formError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button className="mt-4" onClick={submitCreate} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Modifier la référence</SheetTitle>
            <SheetDescription>
              Mise à jour des informations de l’article.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <ItemForm
              values={editValues}
              onChange={setEditValues}
              isNew={false}
              categories={categories}
            />
            {formError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button className="mt-4" onClick={submitEdit} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
