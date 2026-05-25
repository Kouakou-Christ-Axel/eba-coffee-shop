'use client';

import { useState, useTransition } from 'react';
import { Phone, MessageCircle, Check, CheckCheck, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildTelLink,
  buildWaveRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderStatus, PaymentMode } from '@/generated/prisma/client';
import { PaymentModal } from './payment-modal';

async function callApi(
  url: string,
  method: 'PATCH' | 'POST',
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === 'string') msg = data.error;
    } catch {
      // ignore
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export function OrderCardActions({ order }: { order: CashierOrder }) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const phone = order.customerPhone;
  const telLink = buildTelLink(phone);
  const whatsappLink = buildWhatsAppLink(
    phone,
    buildWaveRequestMessage({
      customerName: order.customerName,
      dailyNumber: order.dailyNumber,
      amount: order.total,
    })
  );

  const payLabel =
    order.status === 'PREPARING' || order.status === 'READY'
      ? 'Encaisser maintenant'
      : 'Marquer payée';

  function handlePaymentConfirm(mode: PaymentMode) {
    setPaymentError(null);
    startTransition(async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/payment`,
        'PATCH',
        { isPaid: true, paymentMode: mode }
      );
      if (!result.ok) {
        setPaymentError(result.error);
        return;
      }
      setIsPaymentOpen(false);
    });
  }

  function handleStatusChange(newStatus: OrderStatus) {
    setActionError(null);
    startTransition(async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/status`,
        'PATCH',
        { status: newStatus }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  function handleDismissDriverRequest() {
    setActionError(null);
    startTransition(async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/driver-request`,
        'PATCH',
        { requested: false }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  const orderRef = `#${String(order.dailyNumber).padStart(3, '0')}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Ligne contact : Appeler + Wave (2 colonnes) */}
        {phone && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!telLink}
            >
              {telLink ? (
                <a href={telLink}>
                  <Phone className="mr-1.5 h-4 w-4" />
                  Appeler
                </a>
              ) : (
                <span>Appeler</span>
              )}
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!whatsappLink}
            >
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Wave
                </a>
              ) : (
                <span>Wave</span>
              )}
            </Button>
          </div>
        )}

        {/* Dismiss signal cuisine (livreur demandé) */}
        {order.driverRequested && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
            disabled={isPending}
            onClick={handleDismissDriverRequest}
          >
            <BellOff className="mr-1.5 h-4 w-4" />
            Demande livreur gérée
          </Button>
        )}

        {/* Action principale : marquer payée (pleine largeur) */}
        {!order.isPaid && order.status !== 'CANCELLED' && (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={() => setIsPaymentOpen(true)}
          >
            <Check className="mr-1.5 h-4 w-4" />
            {payLabel}
          </Button>
        )}

        {/* Action préparation : marquer prête */}
        {order.status === 'PREPARING' && (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={() => handleStatusChange('READY')}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Marquer prête
          </Button>
        )}

        {/* Action remise : marquer récupérée */}
        {order.status === 'READY' && (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={() => handleStatusChange('COMPLETED')}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Marquer récupérée
          </Button>
        )}

        {actionError && (
          <p className="text-xs text-destructive">{actionError}</p>
        )}
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setPaymentError(null);
        }}
        orderRef={orderRef}
        amount={order.total}
        isSubmitting={isPending}
        onConfirm={handlePaymentConfirm}
        error={paymentError}
      />
    </>
  );
}
