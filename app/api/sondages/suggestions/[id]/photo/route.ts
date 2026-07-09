// app/api/sondages/suggestions/[id]/photo/route.ts
//
// POST /api/sondages/suggestions/:id/photo — JSON { url }
//
// Le client a déjà uploadé sa photo directement vers Cloudinary (POST
// .../photo/sign puis upload direct navigateur, cf. lib/cloudinary-client.ts)
// depuis la page publique du sondage (aucune session) ; cette route confirme
// et persiste l'URL obtenue. Même modèle de confiance que la preuve de
// paiement (`preuve-paiement/route.ts`) : l'`id` cuid non devinable sert de
// capability URL. Refusé si la suggestion est déjà modérée
// (approuvée/rejetée) — on ne modifie pas une décision figée.

import { NextResponse } from 'next/server';
import { cloudinaryUrlSchema } from '@/lib/schemas/upload';
import { getSuggestion } from '@/lib/polls';
import { setPollSuggestionImage } from '@/lib/poll-mutations';

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

  // Re-vérifier la suggestion : la signature a pu être émise il y a un
  // moment, elle a pu être modérée entre-temps.
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
