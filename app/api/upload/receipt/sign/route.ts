// app/api/upload/receipt/sign/route.ts
//
// POST /api/upload/receipt/sign — paramètres d'upload Cloudinary signés pour
// la famille `receipts` (justificatifs de dépense ET documents
// d'investissement, cf. lib/uploads.ts). Même garde (session + FINANCE) que
// `/api/upload/receipt`.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';
import { buildSignedUploadParams } from '@/lib/cloudinary';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    !ROLE_GROUPS.FINANCE.includes(session.user.role as UserRole)
  ) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const params = buildSignedUploadParams('receipts');
    return NextResponse.json(params);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec de signature' },
      { status: 500 }
    );
  }
}
