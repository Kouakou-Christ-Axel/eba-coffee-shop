// app/api/commandes/[id]/preuve-paiement/route.ts
//
// POST /api/commandes/:id/preuve-paiement — multipart { file }
//
// Le client envoie sa capture de paiement Wave depuis la page publique de
// suivi (au lieu d'un screenshot WhatsApp). Même modèle de confiance que le
// GET public : l'`id` cuid non devinable sert de capability URL. Refusé si la
// commande est déjà encaissée ou annulée (setOrderPaymentProof) — la
// validation reste un geste caisse (« Valider le paiement Wave »).
//
// L'image passe par le pipeline commun `saveImage` (lib/uploads.ts) :
// validation MIME/taille, ré-encodage WebP, stockage /uploads/payment-proofs/.

import { NextResponse } from 'next/server';
import { paymentProofFileSchema } from '@/lib/schemas/upload';
import { savePaymentProofImage } from '@/lib/uploads';
import {
  OrderMutationError,
  assertOrderAcceptsPaymentProof,
  setOrderPaymentProof,
} from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let file: File;
  try {
    const formData = await req.formData();
    const parsed = paymentProofFileSchema.safeParse(formData.get('file'));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Fichier invalide' },
        { status: 400 }
      );
    }
    file = parsed.data;
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide (multipart attendu)' },
      { status: 400 }
    );
  }

  try {
    // Valider la commande AVANT d'écrire sur disque : pas de fichier orphelin
    // pour un id inexistant/déjà finalisé.
    await assertOrderAcceptsPaymentProof(id);
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await savePaymentProofImage(buffer, file.type);
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
      // saveImage lève des messages lisibles (format, taille, image illisible).
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[POST /api/commandes/:id/preuve-paiement]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
