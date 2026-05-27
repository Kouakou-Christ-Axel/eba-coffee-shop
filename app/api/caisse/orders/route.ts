// app/api/caisse/orders/route.ts
//
// POST /api/caisse/orders
// Crée une commande walk-in depuis l'écran caissier.
// Body : { items, customerName?, customerPhone?, orderType, note? }
//
// Calcul du dailyNumber thread-safe via lib/daily-numbering, retry sur conflit
// de l'index unique (dailyDate, dailyNumber).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireCashier } from '@/lib/auth-helpers';
import {
  getNextDailyNumber,
  todayDailyDate,
  DAILY_NUMBER_MAX_RETRIES,
} from '@/lib/daily-numbering';
import { generateOrderReference } from '@/lib/orders';
import { normalizeIvorianPhone } from '@/lib/phone';
import { createOrderSchema, orderTypeSchema } from '@/lib/schemas/order';

const bodySchema = createOrderSchema.extend({
  orderType: orderTypeSchema,
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Normalisation téléphone : on accepte une saisie libre, on stocke en E.164
  // si possible. Si le format n'est pas reconnu, on stocke quand même (saisie
  // libre — le caissier sait ce qu'il fait).
  const rawPhone = parsed.data.customerPhone?.trim() ?? null;
  const normalizedPhone = rawPhone
    ? (normalizeIvorianPhone(rawPhone) ?? rawPhone)
    : null;

  const dailyDate = todayDailyDate();

  for (let attempt = 0; attempt < DAILY_NUMBER_MAX_RETRIES; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const dailyNumber = await getNextDailyNumber(tx, dailyDate);
        const reference = generateOrderReference();

        return tx.order.create({
          data: {
            reference,
            dailyDate,
            dailyNumber,
            customerName: parsed.data.customerName ?? null,
            customerPhone: normalizedPhone,
            pickupTime: null,
            orderType: parsed.data.orderType,
            items: parsed.data.items,
            total: parsed.data.total,
            note: parsed.data.note ?? null,
            createdById: session.user.id,
          },
        });
      });

      return NextResponse.json(
        {
          id: order.id,
          reference: order.reference,
          dailyNumber: order.dailyNumber,
        },
        { status: 201 }
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < DAILY_NUMBER_MAX_RETRIES - 1
      ) {
        continue;
      }
      console.error('[POST /api/caisse/orders]', err);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: 'Impossible de générer un numéro de commande' },
    { status: 500 }
  );
}
