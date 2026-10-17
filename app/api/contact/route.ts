// app/api/contact/route.ts
//
// POST /api/contact — formulaire de contact public (aussi canal de demande
// d'exercice des droits sur les données personnelles). Public, donc limité en
// débit par IP ; le message n'est pas stocké en base, seulement acheminé par
// e-mail (cf. politique de confidentialité : durée = traitement de la demande).

import { NextResponse } from 'next/server';
import { sendContactMessageEmail } from '@/lib/contact-email';
import { createRateLimiter } from '@/lib/rate-limit';
import { contactFormSchema } from '@/lib/schemas/contact';

export const dynamic = 'force-dynamic';

const allowContact = createRateLimiter(10 * 60_000, 5);

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowContact(ip)) {
    return NextResponse.json(
      { error: 'Trop de messages envoyés. Réessayez dans quelques minutes.' },
      { status: 429 }
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = contactFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Message invalide' },
      { status: 400 }
    );
  }

  const sent = await sendContactMessageEmail(parsed.data);
  if (!sent) {
    return NextResponse.json(
      {
        error:
          "Votre message n'a pas pu être transmis. Écrivez-nous directement par téléphone ou WhatsApp.",
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
