'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildWaveRequestMessage } from '@/lib/contact-links';
import type { CartItem } from '@/lib/cart-store';
import type { ContactSettings } from '@/lib/contact-settings';
import type { LoyaltySettings } from '@/lib/loyalty-settings';
import { cn } from '@/lib/utils';

type Props = {
  customerName: string | null;
  dailyNumber: number;
  reference: string;
  amount: number;
  items: CartItem[];
  loyaltyDiscount?: number | null;
  contactSettings: Pick<
    ContactSettings,
    | 'yangoLandmark'
    | 'mapsDirectionsUrl'
    | 'wavePaymentNumber'
    | 'orangeMoneyPaymentNumber'
  >;
  /** URL publique de suivi (/commande/:id), si disponible. */
  trackingUrl?: string;
  /** Client identifié (compteur de tampons) : déclenche le message incitatif
   * fidélité en bas du récap. `null`/absent = commande anonyme. */
  loyaltyTeaser?: { settings: LoyaltySettings; stampCount: number } | null;
  className?: string;
  size?: React.ComponentProps<typeof Button>['size'];
  variant?: React.ComponentProps<typeof Button>['variant'];
};

/**
 * Copie un récapitulatif texte de la commande (articles + total + lien Wave)
 * dans le presse-papier, à envoyer au client par n'importe quel canal.
 * Réutilise `buildWaveRequestMessage` (le même texte que le bouton WhatsApp).
 * Fonctionne même sans téléphone client.
 */
export function CopyRecapButton({
  customerName,
  dailyNumber,
  reference,
  amount,
  items,
  loyaltyDiscount,
  contactSettings,
  trackingUrl,
  loyaltyTeaser,
  className,
  size = 'lg',
  variant = 'outline',
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function handleCopy() {
    const message = buildWaveRequestMessage({
      customerName,
      dailyNumber,
      reference,
      amount,
      items,
      loyaltyDiscount,
      trackingUrl,
      loyaltyTeaser,
      ...contactSettings,
    });
    try {
      await navigator.clipboard.writeText(message);
      setError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('w-full', className)}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="mr-1.5 h-4 w-4 text-green-600" />
      ) : (
        <Copy className="mr-1.5 h-4 w-4" />
      )}
      {copied
        ? 'Copié !'
        : error
          ? 'Copie impossible'
          : 'Copier le récap + Wave'}
    </Button>
  );
}
