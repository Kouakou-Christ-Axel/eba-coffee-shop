'use client';

// components/(public)/commande/order-tracking.tsx
//
// Page de suivi vivante d'une commande (/commande/:id). Remplace l'ancienne
// confirmation statique : le client garde cette page ouverte (statut en
// direct par polling) et la transfère à son livreur — code de retrait,
// localisation, paiement Wave + preuve, et bloc livreur modifiable.

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Chip, Input } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bike,
  Camera,
  Check,
  CheckCircle2,
  ChefHat,
  Loader2,
  MapPin,
  Pencil,
  Receipt,
  Share2,
  ShoppingBag,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { getItemGross } from '@/lib/orders/totals';
import { formatPickupTime } from '@/lib/format-order';
import { priceFormatter } from '@/config/menu';
import {
  buildDriverShareMessage,
  buildWaveLink,
  buildWhatsAppLink,
  buildWhatsAppShareLink,
} from '@/lib/contact-links';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
  ORDER_TRACKING_POLL_INTERVAL_MS,
} from '@/config/constants';
import { cn } from '@/lib/utils';

type Props = {
  initialOrder: PublicOrderView;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
};

// ─── Timeline de statut ───────────────────────────────────────────────────────

const STATUS_STEPS = [
  { status: 'NEW', label: 'Reçue', Icon: Receipt },
  { status: 'PREPARING', label: 'En préparation', Icon: ChefHat },
  { status: 'READY', label: 'Prête', Icon: ShoppingBag },
  { status: 'COMPLETED', label: 'Récupérée', Icon: CheckCircle2 },
] as const;

const STATUS_INDEX: Record<string, number> = {
  NEW: 0,
  PREPARING: 1,
  READY: 2,
  COMPLETED: 3,
};

export function OrderTracking({
  initialOrder,
  pickupAddress,
  pickupMapsUrl,
}: Props) {
  const [order, setOrder] = useState<PublicOrderView>(initialOrder);
  const reduceMotion = useReducedMotion();

  const isCancelled = order.status === 'CANCELLED';
  const isFinal = order.status === 'COMPLETED' || isCancelled;
  const pickupCode = getPickupCode(order.reference);

  // ── Polling léger : statut/paiement/livreur en direct tant que la commande
  //    est active ; pause quand l'onglet est masqué, refresh au retour.
  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch(`/api/commandes/${initialOrder.id}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      setOrder((await res.json()) as PublicOrderView);
    } catch {
      // Réseau instable : on retentera au tick suivant.
    }
  }, [initialOrder.id]);

  useEffect(() => {
    if (isFinal) return;
    const timer = setInterval(refresh, ORDER_TRACKING_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refresh, isFinal]);

  const currentStep = STATUS_INDEX[order.status] ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── En-tête : état courant ── */}
      {isCancelled ? (
        <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
          <XCircle className="h-8 w-8 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger">Commande annulée</p>
            <p className="text-sm text-foreground/60">
              Contacte le comptoir si tu penses qu&apos;il s&apos;agit
              d&apos;une erreur.
            </p>
          </div>
        </div>
      ) : (
        <StatusTimeline currentStep={currentStep} reduceMotion={reduceMotion} />
      )}

      {/* ── Code de retrait ── */}
      <div className="rounded-xl border border-foreground/10 bg-default-50 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
          Code de retrait
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
          {pickupCode}
        </p>
        <p className="mt-1 font-mono text-xs text-foreground/40">
          {order.reference}
        </p>
        <p className="mt-2 text-xs text-foreground/60">
          À annoncer au comptoir (par toi ou ton livreur) pour retirer la
          commande.
        </p>
        {order.pickupTime && (
          <p className="mt-2 text-sm">
            <span className="text-foreground/50">Retrait&nbsp;:</span>{' '}
            {formatPickupTime(new Date(order.pickupTime))}
          </p>
        )}
      </div>

      {/* ── Paiement ── */}
      {!isCancelled && (
        <PaymentSection order={order} onOrderChange={setOrder} />
      )}

      {/* ── Livreur ── */}
      {!isCancelled && (
        <DriverSection
          order={order}
          isFinal={isFinal}
          pickupAddress={pickupAddress}
          pickupMapsUrl={pickupMapsUrl}
          pickupCode={pickupCode}
          onOrderChange={setOrder}
        />
      )}

      {/* ── Articles ── */}
      <div className="w-full">
        <h2 className="mb-3 text-sm font-semibold">Articles</h2>
        <div className="flex flex-col gap-2">
          {order.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {item.productName}{' '}
                  <span className="text-foreground/50">x{item.quantity}</span>
                </p>
                {item.supplements.length > 0 && (
                  <p className="text-xs text-foreground/50">
                    {item.supplements.map(formatSupplementLabel).join(', ')}
                  </p>
                )}
              </div>
              <p className="shrink-0 font-medium">
                {priceFormatter.format(getItemGross(item))}&nbsp;FCFA
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between border-t border-foreground/10 pt-4 font-semibold">
          <span>Total</span>
          <span className="text-primary">
            {priceFormatter.format(order.total)}&nbsp;FCFA
          </span>
        </div>

        {order.note && (
          <p className="mt-3 text-xs text-foreground/60">
            <span className="font-semibold">Note&nbsp;:</span> {order.note}
          </p>
        )}
      </div>

      {/* ── Lieu de retrait ── */}
      {(pickupAddress || pickupMapsUrl) && (
        <div className="w-full rounded-xl border border-foreground/10 bg-default-50 p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
                Lieu de retrait
              </p>
              {pickupAddress && (
                <p className="mt-1 text-sm font-medium">{pickupAddress}</p>
              )}
              <p className="mt-1 text-xs text-foreground/60">
                Ton livreur peut estimer le coût de la course avec la
                localisation ci-dessous.
              </p>
            </div>
          </div>
          {pickupMapsUrl &&
            (pickupMapsUrl.includes('/maps/embed') ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
                <iframe
                  src={pickupMapsUrl}
                  width="100%"
                  height="220"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Carte du lieu de retrait"
                />
              </div>
            ) : (
              <a
                href={pickupMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Voir sur Google Maps →
              </a>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function StatusTimeline({
  currentStep,
  reduceMotion,
}: {
  currentStep: number;
  reduceMotion: boolean | null;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <ol className="flex items-start">
        {STATUS_STEPS.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const StepIcon = step.Icon;
          return (
            <li key={step.status} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    i === 0
                      ? 'bg-transparent'
                      : i <= currentStep
                        ? 'bg-primary'
                        : 'bg-foreground/15'
                  )}
                />
                <motion.div
                  initial={false}
                  animate={
                    active && !reduceMotion ? { scale: [1, 1.12, 1] } : {}
                  }
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                    done || active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-foreground/20 bg-background text-foreground/40'
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </motion.div>
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    i === STATUS_STEPS.length - 1
                      ? 'bg-transparent'
                      : i < currentStep
                        ? 'bg-primary'
                        : 'bg-foreground/15'
                  )}
                />
              </div>
              <p
                className={cn(
                  'mt-2 px-1 text-center text-[11px] font-medium leading-tight',
                  active
                    ? 'text-primary'
                    : done
                      ? 'text-foreground/70'
                      : 'text-foreground/40'
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Paiement (Wave + preuve) ─────────────────────────────────────────────────

function PaymentSection({
  order,
  onOrderChange,
}: {
  order: PublicOrderView;
  onOrderChange: (o: PublicOrderView) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const waveLink = buildWaveLink(order.total);

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/commandes/${order.id}/preuve-paiement`, {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Échec de l’envoi');
      }
      onOrderChange({ ...order, paymentProofUrl: data.url });
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
        {order.isPaid ? (
          <Chip color="success" variant="flat" size="sm">
            Paiement validé
          </Chip>
        ) : order.paymentProofUrl ? (
          <Chip color="warning" variant="flat" size="sm">
            Preuve envoyée · en cours de validation
          </Chip>
        ) : (
          <Chip color="default" variant="flat" size="sm">
            En attente
          </Chip>
        )}
      </div>

      {!order.isPaid && (
        <div className="mt-4 flex flex-col gap-3">
          {waveLink && (
            <Button
              as="a"
              href={waveLink}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              size="lg"
              className="w-full"
            >
              Payer {priceFormatter.format(order.total)}&nbsp;F avec Wave
            </Button>
          )}

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

          {order.paymentProofUrl ? (
            <div className="flex items-center gap-3">
              <Image
                src={order.paymentProofUrl}
                alt="Preuve de paiement"
                width={48}
                height={48}
                className="size-12 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Preuve de paiement reçue</p>
                <p className="text-xs text-foreground/60">
                  La caisse valide et ta commande part en préparation.
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
          ) : (
            <Button
              variant="bordered"
              size="lg"
              className="w-full"
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
              Envoyer ma capture de paiement
            </Button>
          )}

          <p className="text-xs text-foreground/50">
            Après ton paiement Wave, envoie la capture ici — plus besoin de
            l&apos;envoyer sur WhatsApp. Tu peux aussi payer sur place
            (espèces ou mobile money).
          </p>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Livreur ──────────────────────────────────────────────────────────────────

function DriverSection({
  order,
  isFinal,
  pickupAddress,
  pickupMapsUrl,
  pickupCode,
  onOrderChange,
}: {
  order: PublicOrderView;
  isFinal: boolean;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  pickupCode: string;
  onOrderChange: (o: PublicOrderView) => void;
}) {
  const hasDriver = Boolean(order.driverName && order.driverPhone);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(order.driverName ?? '');
  const [phone, setPhone] = useState(order.driverPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // URL de suivi construite côté navigateur (indisponible au rendu serveur).
  const [trackingUrl, setTrackingUrl] = useState('');

  useEffect(() => {
    setTrackingUrl(window.location.href);
  }, []);

  const isReady = order.status === 'READY';
  const showForm = !isFinal && (editing || !hasDriver);

  async function save() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      setError('Nom du livreur requis (min 2 caractères)');
      return;
    }
    if (trimmedPhone.length < 8) {
      setError('Numéro du livreur requis (min 8 chiffres)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/commandes/${order.id}/livreur`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: trimmedName,
          driverPhone: trimmedPhone,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
        };
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Échec de l’envoi'
        );
      }
      onOrderChange({
        ...order,
        driverName: trimmedName,
        driverPhone: trimmedPhone,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’envoi');
    } finally {
      setSaving(false);
    }
  }

  const shareMessage = buildDriverShareMessage({
    pickupCode,
    customerName: order.customerName,
    pickupAddress,
    pickupMapsUrl,
    trackingUrl,
  });
  // Livreur connu → message direct dans sa conversation ; sinon WhatsApp ouvre
  // le sélecteur de contact.
  const shareLink = hasDriver
    ? (buildWhatsAppLink(order.driverPhone, shareMessage) ??
      buildWhatsAppShareLink(shareMessage))
    : buildWhatsAppShareLink(shareMessage);

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
        <Bike className="h-4 w-4" />
        Ton livreur
      </p>

      {/* Message contextuel : ne pas déplacer le livreur trop tôt. */}
      {!isFinal && (
        <div
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-sm font-medium',
            isReady
              ? 'bg-success/15 text-success-700 dark:text-success'
              : 'bg-warning/15 text-warning-700 dark:text-warning'
          )}
        >
          {isReady
            ? 'C’est prêt ! Tu peux envoyer ton livreur dès maintenant.'
            : 'Pas encore prête — ne fais pas déplacer ton livreur tout de suite. Cette page se met à jour toute seule.'}
        </div>
      )}

      {showForm ? (
        <div className="mt-4 flex flex-col gap-3">
          <Input
            label="Nom du livreur"
            value={name}
            onValueChange={setName}
            maxLength={ORDER_CUSTOMER_NAME_MAX}
            size="sm"
          />
          <Input
            label="Téléphone du livreur"
            type="tel"
            value={phone}
            onValueChange={setPhone}
            placeholder="07 00 00 00 00"
            maxLength={ORDER_CUSTOMER_PHONE_MAX}
            size="sm"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button
              color="primary"
              size="sm"
              className="flex-1"
              isLoading={saving}
              onPress={save}
            >
              {hasDriver ? 'Mettre à jour' : 'Enregistrer le livreur'}
            </Button>
            {editing && (
              <Button
                variant="light"
                size="sm"
                onPress={() => {
                  setEditing(false);
                  setName(order.driverName ?? '');
                  setPhone(order.driverPhone ?? '');
                  setError(null);
                }}
              >
                Annuler
              </Button>
            )}
          </div>
          <p className="text-xs text-foreground/50">
            Le comptoir saura qui vient récupérer ta commande — tu peux le
            changer à tout moment.
          </p>
        </div>
      ) : (
        hasDriver && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {order.driverName}
              </p>
              <p className="text-xs text-foreground/60">{order.driverPhone}</p>
            </div>
            {!isFinal && (
              <Button
                variant="light"
                size="sm"
                startContent={<Pencil className="h-3.5 w-3.5" />}
                onPress={() => setEditing(true)}
              >
                Modifier
              </Button>
            )}
          </div>
        )
      )}

      {/* Transfert au livreur : code + adresse + Maps + lien de suivi. */}
      {!isFinal && trackingUrl && (
        <Button
          as="a"
          href={shareLink}
          target="_blank"
          rel="noopener noreferrer"
          variant="bordered"
          size="lg"
          className="mt-4 w-full"
          startContent={<Share2 className="h-4 w-4" />}
        >
          Partager au livreur sur WhatsApp
        </Button>
      )}
    </div>
  );
}
