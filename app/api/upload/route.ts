import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { auth } from '@/lib/auth';
import {
  MAX_UPLOAD_SIZE_BYTES,
  imageExtensionFromMime,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

const UPLOAD_SUBDIR = ['public', 'uploads', 'products'] as const;

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
      { error: 'Format non supporté (JPEG, PNG, WebP, AVIF uniquement)' },
      { status: 400 }
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 5 MB)' },
      { status: 400 }
    );
  }

  const ext = imageExtensionFromMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
  }
  const filename = `${randomUUID()}.${ext}`;

  const dir = join(process.cwd(), ...UPLOAD_SUBDIR);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/products/${filename}` });
}
