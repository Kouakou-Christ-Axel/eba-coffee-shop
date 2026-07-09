import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';
import {
  saveProductImage,
  savePollOptionImage,
  savePollImage,
} from '@/lib/uploads';

const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024));

// Upload admin générique (dashboard) : `subdir` choisit la famille de
// destination parmi une whitelist explicite (pas de chemin arbitraire).
// Défaut `products` pour rester compatible avec les appels existants.
const SAVERS = {
  products: saveProductImage,
  'poll-options': savePollOptionImage,
  polls: savePollImage,
} as const;
type AdminUploadSubdir = keyof typeof SAVERS;

function isAdminUploadSubdir(v: string): v is AdminUploadSubdir {
  return v in SAVERS;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    !ROLE_GROUPS.MANAGER_PLUS.includes(session.user.role as UserRole)
  ) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const subdirParam = formData.get('subdir');
  const subdir =
    typeof subdirParam === 'string' && isAdminUploadSubdir(subdirParam)
      ? subdirParam
      : 'products';

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
    const url = await SAVERS[subdir](buffer, file.type);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec du traitement' },
      { status: 400 }
    );
  }
}
