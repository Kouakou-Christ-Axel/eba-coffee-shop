'use client';

// lib/hooks/use-contact-form.ts
//
// Hook du formulaire de contact public. Validation via le schéma partagé
// (lib/schemas/contact.ts), puis envoi à POST /api/contact.
//
// Le composant `<ContactFormSection>` reste responsable de l'UI ; il consomme
// values / errors / status / setField / submit.

import { useCallback, useState } from 'react';
import { contactFormSchema } from '@/lib/schemas/contact';

// ─── Schéma ──────────────────────────────────────────────────────────────────

export { contactFormSchema };

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
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErrors({
          submit:
            data?.error ??
            "Impossible d'envoyer votre message pour le moment. Réessayez.",
        });
        setStatus('error');
        return false;
      }
    } catch {
      setErrors({
        submit: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
      });
      setStatus('error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
    setStatus('success');
    setValues(INITIAL);
    return true;
  }, [values]);

  return { values, errors, isSubmitting, status, setField, submit, reset };
}
