'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

const ACCEPT = ALLOWED_IMAGE_MIME_TYPES.join(',');
const MAX_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

type Props = {
  imageUrl: string | null;
  isUploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onUploaded: (url: string) => void;
  onRemove: () => void;
};

export function ProductImagesField({
  imageUrl,
  isUploading,
  onUploadStart,
  onUploadEnd,
  onUploaded,
  onRemove,
}: Props) {
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
    onUploadStart();
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      onUploaded(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      onUploadEnd();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="Aperçu"
            width={160}
            height={160}
            className="size-40 rounded-md object-cover"
          />
        )}
        <Input
          type="file"
          accept={ACCEPT}
          disabled={isUploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {isUploading && (
          <p className="text-xs text-muted-foreground">Upload en cours…</p>
        )}
        {uploadError && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
        {imageUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Retirer l&apos;image
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
