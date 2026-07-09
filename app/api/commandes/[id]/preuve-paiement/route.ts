// app/api/commandes/[id]/preuve-paiement/route.ts
//
// POST /api/commandes/:id/preuve-paiement — JSON { url }
//
// Le client a déjà uploadé sa capture de paiement Wave directement vers
// Cloudinary (POST .../preuve-paiement/sign puis upload direct navigateur,
// cf. lib/cloudinary-client.ts) ; cette route confirme et persiste l'URL
// obtenue. Même modèle de confiance que le GET public : l'`id` cuid non
// devinable sert de capability URL. Refusé si la commande est déjà encaissée
// ou annulée (setOrderPaymentProof) — la validation reste un geste caisse
// (« Valider le paiement Wave »).

import { NextResponse } from 'next/server';
import { cloudinaryUrlSchema } from '@/lib/schemas/upload';
import {
  OrderMutationError,
  assertOrderAcceptsPaymentProof,
  setOrderPaymentProof,
} from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let url: string;
  try {
    const body = await req.json();
    const parsed = cloudinaryUrlSchema.safeParse(body?.url);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'URL invalide' },
        { status: 400 }
      );
    }
    url = parsed.data;
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide (JSON attendu)' },
      { status: 400 }
    );
  }

  try {
    // Re-vérifier la commande : la signature a pu être émise il y a un
    // moment, l'état a pu changer entre-temps (paiement caisse concurrent).
    await assertOrderAcceptsPaymentProof(id);
    await setOrderPaymentProof(id, url);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[POST /api/commandes/:id/preuve-paiement]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
