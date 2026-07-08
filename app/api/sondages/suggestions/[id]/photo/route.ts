// app/api/sondages/suggestions/[id]/photo/route.ts
//
// POST /api/sondages/suggestions/:id/photo — multipart { file }
//
// Le client joint une photo à une suggestion de pâtisserie qu'il vient de
// soumettre depuis la page publique du sondage (aucune session). Même modèle
// de confiance que la preuve de paiement (`preuve-paiement/route.ts`) : l'`id`
// cuid non devinable sert de capability URL. Refusé si la suggestion est
// déjà modérée (approuvée/rejetée) — on ne modifie pas une décision figée.
//
// L'image passe par le pipeline commun `saveImage` (lib/uploads.ts) :
// validation MIME/taille, ré-encodage WebP, stockage /uploads/poll-options/.

import { NextResponse } from 'next/server';
import { paymentProofFileSchema } from '@/lib/schemas/upload';
import { savePollSuggestionImage } from '@/lib/uploads';
import { getSuggestion } from '@/lib/polls';
import { setPollSuggestionImage } from '@/lib/poll-mutations';

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
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await savePollSuggestionImage(buffer, file.type);
    await setPollSuggestionImage(id, url);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[POST /api/sondages/suggestions/:id/photo]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
