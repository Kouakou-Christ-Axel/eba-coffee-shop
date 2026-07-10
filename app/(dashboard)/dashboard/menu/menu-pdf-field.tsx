'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MENU_PDF_MAX_SIZE_BYTES,
  isAllowedDocumentMimeType,
} from '@/lib/schemas/upload';
import { uploadRawToCloudinary } from '@/lib/cloudinary-client';
import { saveMenuPdfUrlAction } from './actions';

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const MAX_MB = Math.round(MENU_PDF_MAX_SIZE_BYTES / (1024 * 1024));

type Props = {
  initialUrl: string | null;
};

export function MenuPdfField({ initialUrl }: Props) {
  const [pdfUrl, setPdfUrl] = useState(initialUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    if (!isAllowedDocumentMimeType(file.type)) {
      setError('Format non supporté (PDF uniquement).');
      return;
    }
    if (file.size > MENU_PDF_MAX_SIZE_BYTES) {
      setError(`Fichier trop volumineux (max ${MAX_MB} MB).`);
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadRawToCloudinary(
        file,
        '/api/upload/menu-pdf/sign'
      );
      startTransition(async () => {
        const res = await saveMenuPdfUrlAction(url);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setPdfUrl(url);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await saveMenuPdfUrlAction(null);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setPdfUrl(null);
    });
  }

  const busy = isUploading || isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte au format PDF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-primary underline underline-offset-2"
          >
            Voir le PDF actuel
          </a>
        )}
        <Input
          type="file"
          accept={ACCEPT}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {busy && (
          <p className="text-xs text-muted-foreground">
            {isUploading ? 'Upload en cours…' : 'Enregistrement…'}
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {pdfUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={handleRemove}
          >
            Retirer le PDF
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
