// app/api/upload/sign/route.ts
//
// POST /api/upload/sign — JSON { subdir? } → paramètres d'upload Cloudinary
// signés. Même garde (session + MANAGER_PLUS) et même whitelist de `subdir`
// que `/api/upload` (dont cette route remplace le rôle de réception des
// octets : le fichier part directement du navigateur vers Cloudinary après
// cet appel, cf. lib/cloudinary-client.ts).

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';
import { buildSignedUploadParams } from '@/lib/cloudinary';

const ADMIN_UPLOAD_SUBDIRS = ['products', 'poll-options', 'polls'] as const;
type AdminUploadSubdir = (typeof ADMIN_UPLOAD_SUBDIRS)[number];

function isAdminUploadSubdir(v: string): v is AdminUploadSubdir {
  return (ADMIN_UPLOAD_SUBDIRS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    !ROLE_GROUPS.MANAGER_PLUS.includes(session.user.role as UserRole)
  ) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const subdirParam = typeof body.subdir === 'string' ? body.subdir : '';
  const subdir = isAdminUploadSubdir(subdirParam) ? subdirParam : 'products';

  try {
    const params = buildSignedUploadParams(subdir);
    return NextResponse.json(params);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec de signature' },
      { status: 500 }
    );
  }
}
