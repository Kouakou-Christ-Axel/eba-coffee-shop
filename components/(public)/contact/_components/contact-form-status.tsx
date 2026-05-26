'use client';

import type { ContactSubmitStatus } from '@/lib/hooks/use-contact-form';

type Props = {
  status: ContactSubmitStatus;
  submitError?: string;
};

export function ContactFormStatus({ status, submitError }: Props) {
  if (status === 'success') {
    return (
      <p
        role="status"
        className="rounded-2xl border border-success-200/60 bg-success-50/70 px-4 py-3 text-sm font-medium text-success-700"
      >
        Merci ! Votre message a bien ete envoye. Nous revenons vers vous tres
        vite.
      </p>
    );
  }

  if (status === 'error' && submitError) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-danger-200/60 bg-danger-50/70 px-4 py-3 text-sm font-medium text-danger-700"
      >
        {submitError}
      </p>
    );
  }

  return null;
}
