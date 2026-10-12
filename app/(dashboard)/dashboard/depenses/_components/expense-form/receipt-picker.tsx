'use client';

import { Loader2, Paperclip, X } from 'lucide-react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Button } from '@/components/ui/button';
import type { ExpenseFormState } from './use-expense-form';

export function ReceiptPicker({ form }: { form: ExpenseFormState }) {
  const { values, set, uploading, fileRef, onPickFile } = form;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
        }}
      />
      {values.receiptUrl ? (
        <div className="flex items-center gap-2">
          <Image
            src={values.receiptUrl}
            alt="Justificatif"
            width={40}
            height={40}
            className="size-10 rounded-md object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => set('receiptUrl', null)}
          >
            <X className="mr-1 h-4 w-4" /> Retirer
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="mr-1.5 h-4 w-4" />
          )}
          Justificatif (photo)
        </Button>
      )}
    </div>
  );
}
