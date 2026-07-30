'use client';

// components/(public)/commande/payment-section.tsx
//
// Bloc « Paiement » de la page publique de suivi (/commande/:id), extrait de
// order-tracking.tsx. Trois états explicites pour guider le client (le flux
// Wave reste un simple deep link + preuve par capture — pas d'API) :
//
//   - `awaiting`      : checklist numérotée « 1. Payer avec Wave » puis
//                       « 2. Envoyer ta capture » (ou payer au comptoir) ;
//   - `proof_pending` : preuve reçue, la caisse valide — le bouton Wave
//                       disparaît (fini le doute « dois-je repayer ? ») ;
//   - `validated`     : paiement confirmé, la commande part en préparation.

import { useRef, useState, useSyncExternalStore } from 'react';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Button, Chip } from '@heroui/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Wallet,
} from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import { priceFormatter } from '@/config/menu';
import {
  buildPaymentProofMessage,
  buildWaveLink,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { compressImage } from '@/lib/image-compress';
import {
  uploadToCloudinary,
  confirmCloudinaryUrl,
} from '@/lib/cloudinary-client';
import { PAYMENT_PROOF_MAX_SIZE_BYTES } from '@/config/constants';
import { cn } from '@/lib/utils';

type PaymentUiState = 'awaiting' | 'proof_pending' | 'validated';

function getPaymentUiState(order: PublicOrderView): PaymentUiState {
  if (order.isPaid) return 'validated';
  if (order.paymentProofUrl) return 'proof_pending';
  return 'awaiting';
}

// ─── « Wave ouvert » (étape 1 cochée) ─────────────────────────────────────────
//
// Mémorisé en sessionStorage par commande : l'aller-retour vers l'app Wave (ou
// un refresh) ne décoche pas l'étape. Exposé en store externe
// (useSyncExternalStore) — pas de setState-dans-effet ni de mismatch
// d'hydratation (snapshot serveur `false`).

const waveOpenedListeners = new Set<() => void>();

function waveOpenedKey(orderId: string): string {
  return `eba-wave-opened-${orderId}`;
}

function subscribeWaveOpened(listener: () => void): () => void {
  waveOpenedListeners.add(listener);
  return () => waveOpenedListeners.delete(listener);
}

function readWaveOpened(orderId: string): boolean {
  try {
    return window.sessionStorage.getItem(waveOpenedKey(orderId)) === '1';
  } catch {
    return false;
  }
}

function markWaveOpened(orderId: string): void {
  try {
    window.sessionStorage.setItem(waveOpenedKey(orderId), '1');
  } catch {
    // sessionStorage indisponible : l'étape restera simplement non cochée.
  }
  waveOpenedListeners.forEach((l) => l());
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function PaymentSection({
  order,
  whatsapp,
  onOrderChange,
}: {
  order: PublicOrderView;
  whatsapp: string;
  onOrderChange: (o: PublicOrderView) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const uiState = getPaymentUiState(order);
  const waveLink = buildWaveLink(order.total);
  const waveOpened = useSyncExternalStore(
    subscribeWaveOpened,
    () => readWaveOpened(order.id),
    () => false
  );
  const paymentProofWhatsAppLink = buildWhatsAppLink(
    whatsapp,
    buildPaymentProofMessage({
      customerName: order.customerName,
      dailyNumber: order.dailyNumber,
      amount: order.total,
    })
  );

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Compression navigateur (capture Wave 1-4 Mo → ~100-300 Ko) ; repli sur
      // le fichier original si le navigateur ne sait pas le décoder.
      const compressed = await compressImage(file);
      const toSend = compressed ?? file;
      if (toSend.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
        throw new Error(
          'Image trop lourde (max 1 Mo) — réessaie avec une capture d’écran'
        );
      }

      const url = await uploadToCloudinary(
        toSend,
        `/api/commandes/${order.id}/preuve-paiement/sign`
      );
      await confirmCloudinaryUrl(
        `/api/commandes/${order.id}/preuve-paiement`,
        url
      );
      onOrderChange({ ...order, paymentProofUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’envoi');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          <Wallet className="h-4 w-4" />
          Paiement
        </p>
        {uiState === 'validated' ? (
          <Chip color="success" variant="flat" size="sm">
            Paiement validé
          </Chip>
        ) : uiState === 'proof_pending' ? (
          <Chip color="warning" variant="flat" size="sm">
            En cours de validation
          </Chip>
        ) : (
          <Chip color="default" variant="flat" size="sm">
            En attente
          </Chip>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {uiState === 'validated' ? (
          <motion.div
            key="validated"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 flex items-center gap-3 rounded-lg bg-success/15 px-3 py-3"
          >
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success-700 dark:text-success" />
            <p className="text-sm font-medium text-success-700 dark:text-success">
              Paiement validé 🎉 — ta commande part en préparation.
            </p>
          </motion.div>
        ) : uiState === 'proof_pending' ? (
          <motion.div
            key="proof-pending"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3 rounded-lg bg-warning/15 px-3 py-3">
              {order.paymentProofUrl && (
                <Image
                  src={order.paymentProofUrl}
                  alt="Preuve de paiement"
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-warning-700 dark:text-warning">
                  Preuve reçue ✓ — la caisse vérifie ton paiement.
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground/60">
                  <motion.span
                    aria-hidden
                    animate={reduceMotion ? {} : { opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
                  />
                  Quelques minutes — cette page se met à jour toute seule.
                </p>
              </div>
              <Button
                variant="light"
                size="sm"
                isDisabled={uploading}
                onPress={() => fileRef.current?.click()}
              >
                Remplacer
              </Button>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </motion.div>
        ) : (
          <motion.div
            key="awaiting"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 flex flex-col gap-3"
          >
            <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium text-warning-700 dark:text-warning">
              Ta commande part en préparation dès que le paiement est confirmé —
              deux petites étapes&nbsp;:
            </p>

            {/* Étape 1 — payer avec Wave */}
            {waveLink && (
              <div
                className={cn(
                  'rounded-lg border-2 p-3 transition-colors',
                  waveOpened ? 'border-success/40' : 'border-primary/30'
                )}
              >
                <p className="flex items-center gap-2 text-xs font-semibold text-foreground/60">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                      waveOpened
                        ? 'bg-success text-success-foreground'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {waveOpened ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      '1'
                    )}
                  </span>
                  Étape 1 — Payer avec Wave
                </p>
                <Button
                  as="a"
                  href={waveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="primary"
                  size="lg"
                  variant={waveOpened ? 'bordered' : 'solid'}
                  className="mt-2 w-full"
                  onPress={() => markWaveOpened(order.id)}
                >
                  {waveOpened
                    ? 'Rouvrir Wave si besoin'
                    : `Payer ${priceFormatter.format(order.total)} F avec Wave`}
                </Button>
              </div>
            )}

            {/* Étape 2 — envoyer la capture */}
            <div
              className={cn(
                'rounded-lg border-2 p-3 transition-colors',
                waveOpened || !waveLink
                  ? 'border-primary/30'
                  : 'border-foreground/10'
              )}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-foreground/60">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                    waveOpened || !waveLink
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-foreground/15 text-foreground/60'
                  )}
                >
                  {waveLink ? '2' : '1'}
                </span>
                {waveLink ? 'Étape 2 — ' : ''}Envoyer ta capture de paiement
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                C’est la capture qui permet à la caisse de valider ton paiement.
              </p>
              <Button
                variant="bordered"
                size="lg"
                className="mt-2 w-full"
                isDisabled={uploading}
                onPress={() => fileRef.current?.click()}
                startContent={
                  uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )
                }
              >
                Envoyer ma capture ici
              </Button>
              {paymentProofWhatsAppLink && (
                <Button
                  as="a"
                  href={paymentProofWhatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="light"
                  size="sm"
                  className="mt-2 w-full"
                  startContent={<MessageCircle className="h-4 w-4" />}
                >
                  Ou l’envoyer sur WhatsApp
                </Button>
              )}
            </div>

            <p className="text-xs text-foreground/50">
              Ou paye au comptoir à la récupération (espèces ou mobile money) —
              rien d’autre à faire ici.
            </p>

            {error && <p className="text-xs text-danger">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
