// app/api/caisse/orders/closed/route.ts
//
// GET /api/caisse/orders/closed
// Commandes « closes » DU JOUR que la caisse peut remettre dans le process :
// récupérées (payées), annulées, remboursées et expirées (paiement en ligne).
// Cf. `getReopenPlan` (lib/orders/reopen.ts) pour la cible de chaque cas.
//
// Volontairement HORS de `fetchCashierQueue` : élargir la file principale
// polluerait le lot de disponibilité stock, les lots fidélité et les compteurs
// d'onglets à CHAQUE tick SSE. Lecture à la demande, à l'ouverture du tiroir.

import { NextResponse } from 'next/server';
import { endOfDay, startOfDay } from 'date-fns';
import { requireCashier } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

const LIMIT = 50;

export async function GET() {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const now = new Date();
    // staff-visibility: exempt — les commandes expirées (annulées avant paiement
    // en ligne) sont masquées du staff, et c'est justement ce tiroir qui permet de
    // les reprendre ; elles restent bornées au jour courant.
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
        OR: [
          { status: 'CANCELLED' },
          // Une récupérée NON payée reste dans « À encaisser » : hors liste.
          { status: 'COMPLETED', isPaid: true },
        ],
      },
      // La plus récente en tête : c'est l'erreur qu'on vient de faire.
      orderBy: { updatedAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        dailyNumber: true,
        reference: true,
        customerName: true,
        customerPhone: true,
        total: true,
        status: true,
        isPaid: true,
        paymentExpiresAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error('[GET /api/caisse/orders/closed]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
