'use client';

import { useState } from 'react';
import { Button, Input, Textarea } from '@heroui/react';
import { Send } from 'lucide-react';
import { submitPollSuggestionAction } from '@/app/(public)/sondages/actions';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import {
  uploadToCloudinary,
  confirmCloudinaryUrl,
} from '@/lib/cloudinary-client';

const MAX_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

async function uploadSuggestionPhoto(suggestionId: string, file: File) {
  const url = await uploadToCloudinary(
    file,
    `/api/sondages/suggestions/${suggestionId}/photo/sign`
  );
  await confirmCloudinaryUrl(
    `/api/sondages/suggestions/${suggestionId}/photo`,
    url
  );
}

function PastrySuggestionForm({ pollId }: { pollId: string }) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Le nom de la pâtisserie est requis.');
      return;
    }
    if (photo) {
      if (!isAllowedImageMimeType(photo.type)) {
        setError(
          `Format non supporté (autorisés : ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}).`
        );
        return;
      }
      if (photo.size > MAX_UPLOAD_SIZE_BYTES) {
        setError(`Photo trop volumineuse (max ${MAX_MB} MB).`);
        return;
      }
    }

    setStatus('submitting');
    try {
      const r = await submitPollSuggestionAction(pollId, {
        label: label.trim(),
        description: description.trim() || undefined,
        submitterName: submitterName.trim() || undefined,
        submitterPhone: submitterPhone.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        setStatus('idle');
        return;
      }
      if (photo) {
        await uploadSuggestionPhoto(r.id, photo).catch(() => {
          // La suggestion est déjà enregistrée sans photo — pas bloquant.
        });
      }
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm">
        Merci ! Ta proposition a bien été envoyée à l’équipe pour validation.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-default-200/70 bg-background/80 p-5"
    >
      <p className="text-sm font-semibold">Propose une pâtisserie</p>
      <Input
        label="Nom de la pâtisserie"
        value={label}
        onValueChange={setLabel}
        isRequired
      />
      <Textarea
        label="Description (optionnel)"
        value={description}
        onValueChange={setDescription}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Ton prénom (optionnel)"
          value={submitterName}
          onValueChange={setSubmitterName}
        />
        <Input
          label="Ton téléphone (optionnel)"
          type="tel"
          value={submitterPhone}
          onValueChange={setSubmitterPhone}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-default-600">
          Photo (optionnel)
        </label>
        <input
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button
        type="submit"
        color="primary"
        isLoading={status === 'submitting'}
        isDisabled={status === 'submitting'}
        endContent={<Send className="h-4 w-4" />}
      >
        Envoyer ma suggestion
      </Button>
    </form>
  );
}

export default PastrySuggestionForm;
