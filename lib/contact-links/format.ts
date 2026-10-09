import type { CartItem } from '@/lib/cart-store';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';

export const priceFormatter = new Intl.NumberFormat('fr-FR');

export function formatItemLine(item: CartItem): string {
  const gross = getItemGross(item);
  const net = getItemNet(item);
  const supplementsLabel =
    item.supplements.length > 0
      ? ` (${item.supplements.map(formatSupplementLabel).join(', ')})`
      : '';
  const priceLabel =
    gross !== net
      ? `${priceFormatter.format(net)} F (remise -${priceFormatter.format(gross - net)} F)`
      : `${priceFormatter.format(net)} F`;
  return `- ${item.quantity}× ${item.productName}${supplementsLabel} : ${priceLabel}`;
}
