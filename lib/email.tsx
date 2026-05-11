// lib/email.tsx
import React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import NewOrderEmail from '@/emails/new-order';
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
