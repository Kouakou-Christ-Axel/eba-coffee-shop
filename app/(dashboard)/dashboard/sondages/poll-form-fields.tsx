'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

const MAX_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

export type PollScalarValues = {
  title: string;
  description: string;
  imageUrl: string | null;
  allowSuggestions: boolean;
  resultsVisibility: 'LIVE' | 'AFTER_CLOSE';
};

export const emptyPollScalarValues: PollScalarValues = {
  title: '',
  description: '',
  imageUrl: null,
  allowSuggestions: false,
  resultsVisibility: 'AFTER_CLOSE',
};

/** Champs communs à la création et à l'édition d'un sondage (hors options,
 * gérées séparément — cf. PollOption). Réutilisé par `polls-table.tsx`
 * (création + édition) et `edit-poll-sheet.tsx`. */
export function PollFormFields({
  values,
  onChange,
  idPrefix = 'poll',
}: {
  values: PollScalarValues;
  onChange: (v: PollScalarValues) => void;
  idPrefix?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    if (!isAllowedImageMimeType(file.type)) {
      setUploadError(
        `Format non supporté (autorisés : ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}).`
      );
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError(`Fichier trop volumineux (max ${MAX_MB} MB).`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subdir', 'polls');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      onChange({ ...values, imageUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Titre</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="Ex. La pâtisserie de la semaine"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>
          Description (optionnel)
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) =>
            onChange({ ...values, description: e.target.value })
          }
          placeholder="Contexte affiché aux clients…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Image de couverture (optionnel)</Label>
        {values.imageUrl && (
          <div className="flex items-center gap-3">
            <Image
              src={values.imageUrl}
              alt="Aperçu"
              width={96}
              height={96}
              className="size-24 rounded-md object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...values, imageUrl: null })}
            >
              <X className="mr-1.5 h-4 w-4" />
              Retirer
            </Button>
          </div>
        )}
        <Input
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {uploading && (
          <p className="text-xs text-muted-foreground">Upload en cours…</p>
        )}
        {uploadError && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Suggestions de la communauté</p>
          <p className="text-xs text-muted-foreground">
            Autorise les clients à proposer des options (modération requise).
          </p>
        </div>
        <Switch
          checked={values.allowSuggestions}
          onCheckedChange={(checked) =>
            onChange({ ...values, allowSuggestions: checked })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-visibility`}>
          Visibilité des résultats
        </Label>
        <Select
          id={`${idPrefix}-visibility`}
          aria-label="Visibilité des résultats"
          size="sm"
          selectedKeys={[values.resultsVisibility]}
          disallowEmptySelection
          onSelectionChange={(keys) =>
            onChange({
              ...values,
              resultsVisibility: String(
                Array.from(keys)[0] ?? 'AFTER_CLOSE'
              ) as 'LIVE' | 'AFTER_CLOSE',
            })
          }
        >
          <SelectItem key="AFTER_CLOSE">Après la clôture du vote</SelectItem>
          <SelectItem key="LIVE">Pendant le vote (en direct)</SelectItem>
        </Select>
      </div>
    </div>
  );
}
