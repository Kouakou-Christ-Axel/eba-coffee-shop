// app/api/customers/stats/route.ts
//
// GET /api/customers/stats?search=&page=&sort=&dir=
// Stats CRM (commandes, total acheté net des remboursements, dernière commande)
// des clients de la page demandée. Mêmes paramètres, même validation
// (`loadClientsSearchParams`) et même sélection (`listCustomers`) que la liste
// de /dashboard/clients : le client n'a pas à énumérer d'ids, il rejoue l'URL
// de la page. La liste, elle, ne calcule plus ces agrégats — elle s'affiche et
// se recherche sans les attendre.
//
// Borné par construction à une page (`ORDERS_PAGE_SIZE`) : l'endpoint ne sert
// pas à aspirer les chiffres de tout le fichier clients.

import { NextResponse } from 'next/server';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { listCustomers } from '@/lib/customers';
import { loadClientsSearchParams } from '@/app/(dashboard)/dashboard/clients/search-params';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireRoleOrAnalyst(['ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { page, search, sort, dir } = loadClientsSearchParams(req.url);

  try {
    const { customers } = await listCustomers({
      search: search?.trim() || undefined,
      page: Math.max(1, page),
      sort: sort ?? undefined,
      dir,
      withStats: true,
    });
    const stats = Object.fromEntries(
      customers.map((c) => [
        c.id,
        c.stats && {
          ...c.stats,
          lastOrderAt: c.stats.lastOrderAt?.toISOString() ?? null,
        },
      ])
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
