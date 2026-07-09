// app/api/commandes/[id]/preuve-paiement/sign/route.ts
//
// POST /api/commandes/:id/preuve-paiement/sign — paramètres d'upload
// Cloudinary signés pour la preuve de paiement d'une commande. Public
// (capability URL, même modèle de confiance que la route de confirmation),
// mais réémet le même garde-fou métier AVANT de signer : pas de signature
// pour une commande déjà encaissée/annulée/inexistante.
//
// Flux complet : (1) POST ici → signature ; (2) upload direct navigateur →
// Cloudinary ; (3) POST sur la route existante (`.../preuve-paiement`) avec
// `{ url }` pour persister — qui revérifie le même garde-fou.

import { NextResponse } from 'next/server';
import { buildSignedUploadParams } from '@/lib/cloudinary';
import {
  OrderMutationError,
  assertOrderAcceptsPaymentProof,
} from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  try {
    await assertOrderAcceptsPaymentProof(id);
    const signedParams = buildSignedUploadParams('payment-proofs');
    return NextResponse.json(signedParams);
  } catch (err) {
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error('[POST /api/commandes/:id/preuve-paiement/sign]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
