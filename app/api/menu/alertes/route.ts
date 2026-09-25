// app/api/menu/alertes/route.ts
//
// POST   /api/menu/alertes — { target: { productId, groupName?, optionName? },
//                              subscription: PushSubscription.toJSON() }
// DELETE /api/menu/alertes — { target, endpoint }
//
// Alerte « Préviens-moi quand c'est de retour » sur un produit (ou un goût)
// ÉPUISÉ de la carte publique, sans compte : l'appareil reçoit une
// notification push au retour du stock (lib/restock-alerts.ts).

import { NextResponse } from 'next/server';
import {
  restockAlertRemoveSchema,
  restockAlertSchema,
} from '@/lib/schemas/push';
import {
  RestockAlertError,
  removeRestockAlert,
  saveRestockAlert,
} from '@/lib/restock-alerts';
import { allowRestockAlert } from '@/lib/restock-alert-rate-limit';

async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: Request) {
  if (!allowRestockAlert(clientIp(req))) {
    return NextResponse.json(
      { error: 'Trop de tentatives : réessaie dans quelques minutes.' },
      { status: 429 }
    );
  }
  const parsed = restockAlertSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  try {
    await saveRestockAlert(parsed.data.target, parsed.data.subscription);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof RestockAlertError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('[POST /api/menu/alertes]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const parsed = restockAlertRemoveSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  try {
    await removeRestockAlert(parsed.data.target, parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/menu/alertes]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
