'use client';

// lib/hooks/use-contact-form.ts
//
// Hook simple pour le formulaire de contact public. Validation via un schéma
// Zod local (pas d'API backend dédiée pour l'instant ; la soumission renvoie
// simplement un statut succès simulé après le `await submit()`).
//
// Le composant `<ContactFormSection>` reste responsable de l'UI ; il consomme
// values / errors / status / setField / submit.

import { useCallback, useState } from 'react';
import { z } from 'zod';

// ─── Schéma ──────────────────────────────────────────────────────────────────

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(80, 'Nom trop long (max 80 caractères)'),
  email: z.string().trim().email('Email invalide').max(120, 'Email trop long'),
  phone: z
    .string()
    .trim()
    .max(30, 'Téléphone trop long')
    .optional()
    .or(z.literal('')),
  subject: z.enum(['question', 'reservation', 'partenariat'], {
    message: 'Choisissez un motif',
  }),
  message: z
    .string()
    .trim()
    .min(10, 'Message trop court (min 10 caractères)')
    .max(2000, 'Message trop long (max 2000 caractères)'),
});

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  subject: '' | 'question' | 'reservation' | 'partenariat';
  message: string;
};

export type ContactFormErrors = Partial<
  Record<keyof ContactFormValues | 'submit', string>
>;

export type ContactSubmitStatus = 'idle' | 'success' | 'error';

export type UseContactFormResult = {
  values: ContactFormValues;
  errors: ContactFormErrors;
  isSubmitting: boolean;
  status: ContactSubmitStatus;
  setField: <K extends keyof ContactFormValues>(
    key: K,
    value: ContactFormValues[K]
  ) => void;
  submit: () => Promise<boolean>;
  reset: () => void;
};

const INITIAL: ContactFormValues = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

// ─── Validation pure ─────────────────────────────────────────────────────────

export function validateContactForm(
  values: ContactFormValues
): ContactFormErrors {
  const parsed = contactFormSchema.safeParse({
    name: values.name,
    email: values.email,
    phone: values.phone,
    subject: values.subject || undefined,
    message: values.message,
  });

  if (parsed.success) return {};

  const flat = parsed.error.flatten().fieldErrors;
  const errors: ContactFormErrors = {};
  (['name', 'email', 'phone', 'subject', 'message'] as const).forEach((key) => {
    const msg = flat[key]?.[0];
    if (msg) errors[key] = msg;
  });
  return errors;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useContactForm(): UseContactFormResult {
  const [values, setValues] = useState<ContactFormValues>(INITIAL);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<ContactSubmitStatus>('idle');

  const setField = useCallback<UseContactFormResult['setField']>(
    (key, value) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key] && !prev.submit) return prev;
        const next = { ...prev };
        delete next[key];
        delete next.submit;
        return next;
      });
      if (status !== 'idle') setStatus('idle');
    },
    [status]
  );

  const reset = useCallback(() => {
    setValues(INITIAL);
    setErrors({});
    setStatus('idle');
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    const validation = validateContactForm(values);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setStatus('error');
      return false;
    }

    setIsSubmitting(true);
    setErrors({});
    // TODO: brancher sur une vraie route /api/contact quand elle existera.
    // Pour l'instant on simule un succès court (préserve le comportement
    // visuel sans inventer de side-effect serveur).
    await new Promise((r) => setTimeout(r, 300));
    setIsSubmitting(false);
    setStatus('success');
    setValues(INITIAL);
    return true;
  }, [values]);

  return { values, errors, isSubmitting, status, setField, submit, reset };
}
