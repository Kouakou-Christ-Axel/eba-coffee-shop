'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadToCloudinary } from '@/lib/cloudinary-client';
import { createInvestmentAction, updateInvestmentAction } from '../../actions';
import type { InvestmentFormValues } from './types';

export type InvestmentFormState = ReturnType<typeof useInvestmentForm>;

export function useInvestmentForm({
  mode,
  initial,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  initial: InvestmentFormValues;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<InvestmentFormValues>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof InvestmentFormValues>(
    key: K,
    value: InvestmentFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, '/api/upload/receipt/sign');
      set('documentUrl', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    const amountInt = Number(values.amount);
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!values.sourceId) {
      setError('Choisis une source');
      return;
    }
    const repaidInt = values.reimbursable
      ? Number(values.amountRepaid || 0)
      : 0;
    if (values.reimbursable && repaidInt > amountInt) {
      setError('Le montant remboursé dépasse le montant de l’apport');
      return;
    }

    const payload = {
      date: values.date,
      amount: Math.round(amountInt),
      sourceId: values.sourceId,
      paymentMethod: values.paymentMethod,
      financier: values.financier.trim() || null,
      note: values.note.trim() || null,
      documentUrl: values.documentUrl,
      reimbursable: values.reimbursable,
      amountRepaid: values.reimbursable ? Math.round(repaidInt) : 0,
      dueDate: values.reimbursable && values.dueDate ? values.dueDate : null,
    };

    startTransition(async () => {
      const result =
        mode === 'edit' && values.id
          ? await updateInvestmentAction(values.id, payload)
          : await createInvestmentAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return {
    mode,
    values,
    set,
    uploading,
    error,
    pending,
    busy: pending || uploading,
    fileRef,
    onPickFile,
    submit,
  };
}
