// app/api/commandes/[id]/livreur/route.ts
//
// PATCH /api/commandes/:id/livreur
// Body : { driverName: string | null, driverPhone: string | null }
//
// Le client renseigne (ou change — « ça peut changer ») le livreur qu'il
// envoie récupérer sa commande, depuis la page publique de suivi. Les deux
// champs à null effacent le livreur. Même modèle de confiance que le GET :
// l'`id` cuid non devinable sert de capability URL.

import { NextResponse } from 'next/server';
import { setOrderDriverSchema } from '@/lib/schemas/order';
import { OrderMutationError, setOrderDriver } from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = setOrderDriverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await setOrderDriver(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('[PATCH /api/commandes/:id/livreur]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
