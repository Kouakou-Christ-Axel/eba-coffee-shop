// lib/email.tsx
import React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import NewOrderEmail from '@/emails/new-order';
import OtpCodeEmail from '@/emails/otp-code';
import type { CartItem } from '@/lib/cart-store';

type OrderData = {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  pickupTime: Date;
  items: CartItem[];
  total: number;
};

export async function sendNewOrderEmail(order: OrderData): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    console.warn('[email] OWNER_EMAIL non défini — notification ignorée');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = await render(React.createElement(NewOrderEmail, { order }));

  await resend.emails.send({
    from: 'EBA Coffee Shop <noreply@ebacoffeeshop.ci>',
    to: ownerEmail,
    subject: `🛎️ Nouvelle commande EBA — Réf. ${order.reference}`,
    html,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = await render(React.createElement(OtpCodeEmail, { code }));
  const from =
    process.env.RESEND_FROM ?? 'EBA Coffee Shop <onboarding@resend.dev>';

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `Votre code de connexion EBA : ${code}`,
    html,
  });

  if (error) {
    console.error('[email] Resend OTP error:', error);
    throw new Error(`Resend a refusé l'envoi : ${error.message}`);
  }
  console.log('[email] OTP envoyé, id Resend:', data?.id);
}
