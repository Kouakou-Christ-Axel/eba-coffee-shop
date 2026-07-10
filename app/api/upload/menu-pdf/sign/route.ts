// app/api/upload/menu-pdf/sign/route.ts
//
// POST /api/upload/menu-pdf/sign — paramètres d'upload Cloudinary signés pour
// la carte PDF (subdir figé `menu-pdf`, `resource_type: 'raw'`). Même garde
// (session + rôle gestion menu) que les autres routes `/sign`.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';
import { buildMenuPdfSignedUploadParams } from '@/lib/cloudinary';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    !ROLE_GROUPS.MANAGER_PLUS.includes(session.user.role as UserRole)
  ) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const params = buildMenuPdfSignedUploadParams();
    return NextResponse.json(params);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec de signature' },
      { status: 500 }
    );
  }
}
