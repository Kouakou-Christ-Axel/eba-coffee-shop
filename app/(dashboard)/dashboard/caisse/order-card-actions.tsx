'use client';

import { useState, useTransition } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import {
  Phone,
  MessageCircle,
  Check,
  CheckCheck,
  BellOff,
  ChefHat,
  Pencil,
  CalendarClock,
  Ban,
  RotateCcw,
  AlertTriangle,
  UserCog,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildPickupReadyMessage,
  buildTelLink,
  buildWaveRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { ContactSettings } from '@/lib/contact-settings';
import { priceFormatter, type MenuCategory } from '@/config/menu';
import type { OrderStatus } from '@/generated/prisma/client';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { PaymentModal, type PaymentLine } from './payment-modal';
import { EditFulfillmentModal } from './edit-fulfillment-modal';
import { EditCustomerModal } from './edit-customer-modal';
import { EditLoyaltyModal } from './edit-loyalty-modal';
import { CopyRecapButton } from '../_components/copy-recap-button';
import { OrderItemsEditor } from '../_components/order-items-editor';

async function callApi<T = unknown>(
  url: string,
  method: 'PATCH' | 'POST',
  body: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
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
  const data = (await res.json()) as T;
  return { ok: true, data };
}

/**
 * Message français du toast d'annulation (undo, 10 s) pour une transition de
 * statut. `null` pour NEW : jamais une cible de transition depuis la caisse.
 */
function undoableStatusMessage(
  newStatus: OrderStatus,
  wasPaid: boolean,
  orderRef: string
): string | null {
  switch (newStatus) {
    case 'PREPARING':
      return `Commande ${orderRef} envoyée en cuisine`;
    case 'READY':
      return `Commande ${orderRef} marquée prête`;
    case 'COMPLETED':
      return `Commande ${orderRef} marquée récupérée`;
    case 'CANCELLED':
      return wasPaid
        ? `Commande ${orderRef} remboursée`
        : `Commande ${orderRef} annulée`;
    default:
      return null;
  }
}

export function OrderCardActions({
  order,
  menu,
  contactSettings,
}: {
  order: CashierOrder;
  menu: MenuCategory[];
  contactSettings: Pick<
    ContactSettings,
    | 'yangoLandmark'
    | 'mapsDirectionsUrl'
    | 'wavePaymentNumber'
    | 'orangeMoneyPaymentNumber'
  >;
}) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditFulfillmentOpen, setIsEditFulfillmentOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isEditLoyaltyOpen, setIsEditLoyaltyOpen] = useState(false);
  const { pushUndo } = useUndoToast();

  const canEditItems =
    order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

  const phone = order.customerPhone;
  const telLink = buildTelLink(phone);
  const trackingUrl =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.origin}/commande/${order.id}`;
  // Message incitatif fidélité (récap, avant paiement) : uniquement pour une
  // commande liée à un client identifié, et si le programme est actif.
  const loyaltyTeaser =
    order.customerId && order.loyaltyStampCount !== null
      ? { settings: order.loyaltySettings, stampCount: order.loyaltyStampCount }
      : null;
  const whatsappLink = buildWhatsAppLink(
    phone,
    buildWaveRequestMessage({
      customerName: order.customerName,
      dailyNumber: order.dailyNumber,
      reference: order.reference,
      amount: order.total,
      items: order.items,
      loyaltyDiscount: order.loyaltyDiscount,
      trackingUrl,
      loyaltyTeaser,
      ...contactSettings,
    })
  );
  // « C'est prêt » one-tap : confirmation (+ fidélité si un tampon a été
  // crédité) + code de retrait + repère Yango/itinéraire + lien de suivi —
  // remplace le message manuel répétitif.
  const readyLink = buildWhatsAppLink(
    phone,
    buildPickupReadyMessage({
      dailyNumber: order.dailyNumber,
      reference: order.reference,
      yangoLandmark: contactSettings.yangoLandmark,
      mapsDirectionsUrl: contactSettings.mapsDirectionsUrl,
      trackingUrl,
      loyalty:
        order.customerId &&
        order.loyaltyStampCount !== null &&
        order.loyaltyPickupOutcome
          ? {
              settings: order.loyaltySettings,
              stampEarned: order.loyaltyPickupOutcome.stampEarned,
              isFirstStampEver: order.loyaltyPickupOutcome.isFirstStampEver,
              stampCount: order.loyaltyStampCount,
            }
          : null,
    })
  );

  const payLabel =
    order.status === 'PREPARING' ||
    order.status === 'READY' ||
    order.status === 'COMPLETED'
      ? 'Encaisser maintenant'
      : 'Marquer payée';

  // Stock épuisé signalé par le flux SSE (`lib/cashier-queue.ts`) pour une
  // commande dont le stock n'est PAS encore réservé : le serveur refusera
  // l'envoi en cuisine de toute façon (409), mais on prévient le staff AVANT le
  // clic pour éviter le clic perdu. Critère `stockReservedAt` et non `isPaid` :
  // une commande en cuisine mais non encaissée (ardoise) a déjà son stock.
  const hasStockShortage =
    order.stockShortage && order.stockReservedAt === null;

  // Non bloquant : une confirmation explicite suffit à passer outre (le staff
  // peut avoir déjà proposé un remplacement au client). Si le stock a bougé
  // entre-temps, le serveur retranchera de toute façon (409, message affiché).
  function confirmDespiteShortage(): boolean {
    if (!hasStockShortage) return true;
    return confirm(
      `Stock épuisé pour : ${order.unavailableItemNames.join(', ')}.\nProposer un autre produit au client avant de payer.\nContinuer quand même ?`
    );
  }

  const orderRef = `#${String(order.dailyNumber).padStart(3, '0')}`;

  // Encaissement réussi (modale ou raccourci Wave) : propose un undo 10 s qui
  // dépaye directement (même route, `isPaid: false`). Si l'encaissement a
  // aussi fait partir la commande en cuisine (NEW → PREPARING automatique),
  // l'undo la renvoie également à NEW — sinon elle resterait coincée en
  // cuisine alors qu'elle n'est plus payée.
  function pushPaymentUndo(startedPreparation: boolean) {
    pushUndo({
      message: `Commande ${orderRef} encaissée`,
      onUndo: async () => {
        const undoResult = await callApi(
          `/api/caisse/orders/${order.id}/payment`,
          'PATCH',
          { isPaid: false }
        );
        if (!undoResult.ok) throw new Error(undoResult.error);
        if (startedPreparation) {
          const statusResult = await callApi(
            `/api/caisse/orders/${order.id}/status`,
            'PATCH',
            { status: 'NEW' }
          );
          if (!statusResult.ok) throw new Error(statusResult.error);
        }
      },
    });
  }

  function handlePaymentConfirm(payments: PaymentLine[]) {
    setPaymentError(null);
    startTransition(async () => {
      const result = await callApi<{ startedPreparation: boolean }>(
        `/api/caisse/orders/${order.id}/payment`,
        'PATCH',
        { isPaid: true, payments }
      );
      if (!result.ok) {
        setPaymentError(result.error);
        return;
      }
      setIsPaymentOpen(false);
      pushPaymentUndo(result.data.startedPreparation);
    });
  }

  // Raccourci quand le client a envoyé sa preuve Wave depuis la page de suivi :
  // encaissement direct en mode WAVE, sans passer par la modale.
  function handleValidateWaveProof() {
    if (!confirmDespiteShortage()) return;
    setActionError(null);
    startTransition(async () => {
      const result = await callApi<{ startedPreparation: boolean }>(
        `/api/caisse/orders/${order.id}/payment`,
        'PATCH',
        { isPaid: true, payments: [{ mode: 'WAVE', amount: order.total }] }
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      pushPaymentUndo(result.data.startedPreparation);
    });
  }

  // `skipUndo` : évite qu'un undo (qui rappelle cette même fonction pour
  // revenir au statut précédent) ne génère lui-même un nouveau toast d'undo.
  function handleStatusChange(
    newStatus: OrderStatus,
    opts?: { skipUndo?: boolean }
  ) {
    setActionError(null);
    const previousStatus = order.status;
    const wasPaid = order.isPaid;
    startTransition(async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/status`,
        'PATCH',
        { status: newStatus }
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      if (opts?.skipUndo) return;
      const message = undoableStatusMessage(newStatus, wasPaid, orderRef);
      if (!message) return;
      pushUndo({
        message,
        onUndo: async () => {
          const undoResult = await callApi(
            `/api/caisse/orders/${order.id}/status`,
            'PATCH',
            { status: previousStatus }
          );
          if (!undoResult.ok) throw new Error(undoResult.error);
        },
      });
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

  function handleSendToKitchenWithoutPayment() {
    // L'entrée en cuisine RÉSERVE désormais le stock : cet envoi peut donc
    // échouer en 409 « stock insuffisant » exactement comme un encaissement.
    // Même garde qu'avant de payer (l'erreur remonte sinon dans
    // `setActionError`, mais autant éviter le clic perdu).
    if (!confirmDespiteShortage()) return;
    if (
      !confirm(
        'Envoyer cette commande en cuisine sans encaissement ? Tu devras encaisser après la remise.'
      )
    ) {
      return;
    }
    handleStatusChange('PREPARING');
  }

  // Annuler une commande non payée ; rembourser (= annuler) une commande payée.
  function handleCancelOrRefund() {
    const message = order.isPaid
      ? `Rembourser et annuler la commande ${orderRef} ?\nLe montant de ${priceFormatter.format(order.total)} F sera rendu au client.`
      : `Annuler la commande ${orderRef} ?`;
    if (!confirm(message)) return;
    handleStatusChange('CANCELLED');
  }

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

        {/* Copier le récap + lien Wave (fonctionne même sans téléphone) */}
        <CopyRecapButton
          customerName={order.customerName}
          dailyNumber={order.dailyNumber}
          reference={order.reference}
          amount={order.total}
          items={order.items}
          loyaltyDiscount={order.loyaltyDiscount}
          contactSettings={contactSettings}
          trackingUrl={trackingUrl}
          loyaltyTeaser={loyaltyTeaser}
        />

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

        {/* Stock épuisé sur un article de cette commande (non payée) : signal
            rouge + garde sur les boutons de paiement ci-dessous. */}
        {hasStockShortage && (
          <div className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Stock épuisé — proposer un autre produit :{' '}
              {order.unavailableItemNames.join(', ')}
            </span>
          </div>
        )}

        {/* Preuve Wave reçue : validation en un clic (mode WAVE) */}
        {order.paymentProofUrl &&
          !order.isPaid &&
          order.status !== 'CANCELLED' && (
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isPending}
              onClick={handleValidateWaveProof}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Valider le paiement Wave
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
            onClick={() => {
              if (confirmDespiteShortage()) setIsPaymentOpen(true);
            }}
          >
            <Check className="mr-1.5 h-4 w-4" />
            {payLabel}
          </Button>
        )}

        {/* Cas exception : envoyer en cuisine sans encaisser (status NEW seul) */}
        {!order.isPaid && order.status === 'NEW' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={handleSendToKitchenWithoutPayment}
          >
            <ChefHat className="mr-1.5 h-4 w-4" />
            Envoyer en cuisine sans payer
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

        {/* Commande prête : prévenir le client en un tap (WhatsApp) */}
        {order.status === 'READY' && readyLink && (
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={readyLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Prévenir&nbsp;: c&apos;est prêt
            </a>
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

        {/* Ajouter / retirer des produits */}
        {canEditItems && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={() => setIsEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Modifier les articles
          </Button>
        )}

        {/* Modifier la prise en charge : type, créneau de retrait / arrivée
            du livreur, identité du livreur */}
        {canEditItems && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={() => setIsEditFulfillmentOpen(true)}
          >
            <CalendarClock className="mr-1.5 h-4 w-4" />
            Modifier la prise en charge
          </Button>
        )}

        {/* Modifier les infos client : nom, téléphone, lien vers une fiche
            CRM existante, ou détacher */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-muted-foreground"
          disabled={isPending}
          onClick={() => setIsEditCustomerOpen(true)}
        >
          <UserCog className="mr-1.5 h-4 w-4" />
          Modifier le client
        </Button>

        {/* Appliquer / retirer une récompense fidélité, y compris après
            création (pas seulement au moment de la commande) */}
        {canEditItems && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={() => setIsEditLoyaltyOpen(true)}
          >
            <Gift className="mr-1.5 h-4 w-4" />
            Récompense fidélité
          </Button>
        )}

        {/* Annuler / Rembourser : rembourser si déjà payée, sinon annuler */}
        {order.status !== 'CANCELLED' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending}
            onClick={handleCancelOrRefund}
          >
            {order.isPaid ? (
              <>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Rembourser
              </>
            ) : (
              <>
                <Ban className="mr-1.5 h-4 w-4" />
                Annuler
              </>
            )}
          </Button>
        )}

        {actionError && (
          <p className="text-xs text-destructive">{actionError}</p>
        )}
      </div>

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        placement="center"
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Commande {orderRef}</ModalHeader>
          <ModalBody className="pb-6">
            <OrderItemsEditor
              orderId={order.id}
              initialItems={order.items}
              menu={menu}
              onClose={() => setIsEditOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

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

      <EditFulfillmentModal
        isOpen={isEditFulfillmentOpen}
        onClose={() => setIsEditFulfillmentOpen(false)}
        order={order}
      />

      <EditCustomerModal
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        order={order}
      />

      <EditLoyaltyModal
        isOpen={isEditLoyaltyOpen}
        onClose={() => setIsEditLoyaltyOpen(false)}
        order={order}
      />
    </>
  );
}
