// app/api/customers/stats/route.ts
//
// GET /api/customers/stats?ids=a,b,c
// Stats CRM (commandes, total acheté net des remboursements, dernière commande)
// d'une poignée de clients — celles de la page affichée dans
// /dashboard/clients. La liste ne les calcule plus elle-même : elle s'affiche
// et se recherche sans attendre l'agrégation sur les commandes.
//
// Plafonné à une page (`ORDERS_PAGE_SIZE`) : l'endpoint ne sert pas à aspirer
// les chiffres de tout le fichier clients.

import { NextResponse } from 'next/server';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { statsByCustomer, ZERO_STATS } from '@/lib/customers/stats';
import { ORDERS_PAGE_SIZE } from '@/config/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireRoleOrAnalyst(['ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const ids = [
    ...new Set(
      (new URL(req.url).searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) return NextResponse.json({ stats: {} });
  if (ids.length > ORDERS_PAGE_SIZE) {
    return NextResponse.json(
      { error: `${ORDERS_PAGE_SIZE} clients au plus par requête` },
      { status: 400 }
    );
  }

  try {
    const byId = await statsByCustomer(ids);
    const stats = Object.fromEntries(
      ids.map((id) => {
        const s = byId.get(id) ?? ZERO_STATS;
        return [
          id,
          { ...s, lastOrderAt: s.lastOrderAt?.toISOString() ?? null },
        ];
      })
    );
    return NextResponse.json(
      { stats },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[GET /api/customers/stats]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
