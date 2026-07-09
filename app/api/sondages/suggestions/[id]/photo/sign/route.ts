// app/api/sondages/suggestions/[id]/photo/sign/route.ts
//
// POST /api/sondages/suggestions/:id/photo/sign — paramètres d'upload
// Cloudinary signés pour la photo jointe à une suggestion de pâtisserie.
// Public (capability URL), réémet le même garde-fou métier qu'aujourd'hui
// AVANT de signer : pas de signature pour une suggestion déjà modérée.
//
// Flux complet : (1) POST ici → signature ; (2) upload direct navigateur →
// Cloudinary ; (3) POST sur la route existante (`.../photo`) avec `{ url }`
// pour persister — qui revérifie le même garde-fou.

import { NextResponse } from 'next/server';
import { buildSignedUploadParams } from '@/lib/cloudinary';
import { getSuggestion } from '@/lib/polls';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const suggestion = await getSuggestion(id);
  if (!suggestion) {
    return NextResponse.json(
      { error: 'Suggestion introuvable' },
      { status: 404 }
    );
  }
  if (suggestion.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Cette suggestion a déjà été modérée' },
      { status: 409 }
    );
  }

  try {
    const signedParams = buildSignedUploadParams('poll-options');
    return NextResponse.json(signedParams);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Échec de signature' },
      { status: 500 }
    );
  }
}
