// app/api/caisse/orders/cancelled/route.ts
//
// GET /api/caisse/orders/cancelled
// Commandes ANNULÉES du jour, pour la caisse : un client revient réclamer une
// commande annulée faute d'attente, il faut pouvoir la ramener « à encaisser »
// sans la ressaisir.
//
// Volontairement HORS de `fetchCashierQueue` : élargir la file principale aux
// annulées polluerait le lot de disponibilité stock, les lots fidélité et les
// compteurs d'onglets à CHAQUE tick SSE. Ici, lecture à la demande — le tiroir
// caisse n'appelle cette route qu'à son ouverture.

import { NextResponse } from 'next/server';
import { endOfDay, startOfDay } from 'date-fns';
import { requireCashier } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const now = new Date();
    const orders = await prisma.order.findMany({
      where: {
        status: 'CANCELLED',
        createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      // L'annulation la plus récente en tête : c'est celle qu'on vient de faire
      // par erreur, ou celle dont le client revient le plus vite discuter.
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        dailyNumber: true,
        reference: true,
        customerName: true,
        customerPhone: true,
        total: true,
        isPaid: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error('[GET /api/caisse/orders/cancelled]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
