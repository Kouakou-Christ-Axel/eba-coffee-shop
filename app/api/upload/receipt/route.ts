import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import { saveReceiptImage } from '@/lib/uploads';

const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

// Upload d'un justificatif de dépense (photo). Réservé à l'ADMIN, même
// validation que l'upload produit mais stocké sous /uploads/receipts/.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (!isAllowedImageMimeType(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporté (JPEG, PNG, WebP, AVIF, HEIC)' },
      { status: 400 }
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_UPLOAD_SIZE_MB} MB)` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await saveReceiptImage(buffer, file.type);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec du traitement' },
      { status: 400 }
    );
  }
}
