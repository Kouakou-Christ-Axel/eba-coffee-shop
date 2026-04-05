// lib/cart-to-whatsapp.ts
import type { CartItem } from '@/lib/cart-store';
import { brandConfig } from '@/config/brand.config';
import { priceFormatter } from '@/config/menu';

function getItemTotal(item: CartItem): number {
  const supplementsTotal = item.supplements.reduce(
    (sum, s) => sum + s.price,
    0
  );
  return (item.basePrice + supplementsTotal) * item.quantity;
}

export function buildWhatsAppUrl(items: CartItem[]): string {
  const lines = items.map((item) => {
    const supps =
      item.supplements.length > 0
        ? ` (${item.supplements.map((s) => s.optionName).join(', ')})`
        : '';
    const total = priceFormatter.format(getItemTotal(item));
    return `\u2022 ${item.quantity}x ${item.productName}${supps} \u2014 ${total} F`;
  });

  const grandTotal = priceFormatter.format(
    items.reduce((sum, i) => sum + getItemTotal(i), 0)
  );

  const message = [
    'Bonjour, je souhaite commander :',
    '',
    ...lines,
    '',
    `Total : ${grandTotal} F`,
    '',
    'Merci !',
  ].join('\n');

  const encoded = encodeURIComponent(message);
  return `${brandConfig.location.whatsappLink}?text=${encoded}`;
}
