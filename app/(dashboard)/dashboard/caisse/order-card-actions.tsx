'use client';

import { useState } from 'react';
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
  Bot,
  Loader2,
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
import { useConfirmDialog } from '../_components/use-confirm-dialog';
import { useShortageConfirm } from '../_components/use-shortage-confirm';
import type { ShortageLine } from '@/lib/orders/shortage';
import { formatPickup, isDeferredPickup } from '@/lib/orders/scheduling';
import { useNowTick } from './use-now-tick';

async function callApi<T = unknown>(
  url: string,
  method: 'PATCH' | 'POST',
  body: unknown
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; shortage?: ShortageLine[] }
> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    // Une 409 de pénurie porte AUSSI la liste chiffrée des manques : elle
    // permet de proposer « vous les avez produits ? » plutôt que d'afficher
    // une impasse (cf. `buildShortagePayload`, lib/order-mutations.ts).
    let shortage: ShortageLine[] | undefined;
    try {
      const data = (await res.json()) as {
        error?: string;
        shortage?: ShortageLine[];
      };
      if (typeof data.error === 'string') msg = data.error;
      if (Array.isArray(data.shortage)) shortage = data.shortage;
    } catch {
      // ignore
    }
    return { ok: false, error: msg, shortage };
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
  // Quelle mutation est en cours (null = aucune).
  //
  // Un `useTransition` unique servait auparavant de drapeau global : la
  // moindre action grisait les 8+ boutons de la carte, y compris ceux qui ne
  // font qu'ouvrir une modale. On garde un verrou — deux écritures simultanées
  // sur la même commande se solderaient par un 409 (concurrence optimistique
  // côté serveur) — mais on sait désormais QUELLE action tourne, donc seul le
  // bouton actionné affiche un état d'attente.
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isPending = pendingAction !== null;

  function runMutation(key: string, fn: () => Promise<void>) {
    if (pendingAction !== null) return;
    setPendingAction(key);
    void fn().finally(() => setPendingAction(null));
  }
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditFulfillmentOpen, setIsEditFulfillmentOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isEditLoyaltyOpen, setIsEditLoyaltyOpen] = useState(false);
  const { pushUndo } = useUndoToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { confirmShortage, shortageDialog } = useShortageConfirm();
  // Horloge qui tique : le verdict « différée » change au passage de minuit, et
  // ces boutons doivent suivre sans rechargement (le SSE ne pousse qu'aux
  // mutations de commandes, il ne réveille rien à 00:00).
  const tickNow = useNowTick();

  const canEditItems =
    order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
  // Plus permissive que `canEditItems` : la récompense fidélité peut être
  // appliquée/retirée même sur une commande TERMINÉE (rattrapage d'un palier
  // pas posé à temps) — seule une commande ANNULÉE reste bloquée, en miroir
  // du garde-fou de `setOrderLoyaltyReward` (lib/order-mutations.ts).
  const canEditLoyalty = order.status !== 'CANCELLED';

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

  // Retrait un jour ultérieur : le stock d'aujourd'hui ne la concerne pas.
  // Recalculé ICI plutôt que porté par le flux SSE (qui ne repousse qu'aux
  // mutations de commandes) : sans cela, le verdict resterait celui d'avant
  // minuit sur un écran resté ouvert la nuit.
  const isDeferred = isDeferredPickup(order.pickupTime, tickNow);

  // Stock épuisé signalé par le flux SSE (`lib/cashier-queue.ts`) pour une
  // commande dont le stock n'est PAS encore réservé : le serveur refusera
  // l'envoi en cuisine de toute façon (409), mais on prévient le staff AVANT le
  // clic pour éviter le clic perdu. Critère `stockReservedAt` et non `isPaid` :
  // une commande en cuisine mais non encaissée (ardoise) a déjà son stock.
  // Double sécurité sur `isDeferred` : cf. le passage de minuit ci-dessus.
  const hasStockShortage =
    order.stockShortage && order.stockReservedAt === null && !isDeferred;

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

  /**
   * Exécute une mutation qui peut buter sur le stock. En cas de refus pour
   * pénurie, propose au caissier d'enregistrer la production sur place — « il
   * manque 3 × Sponge cake (Vanille), vous les avez produits ? » — et réessaie
   * avec `coverShortage`. Personne n'a plus à ouvrir /dashboard/menu pour
   * débloquer une commande.
   */
  async function withShortageRetry<T>(
    call: (
      coverShortage: boolean
    ) => Promise<Awaited<ReturnType<typeof callApi<T>>>>
  ) {
    const first = await call(false);
    if (first.ok || !first.shortage?.length) return first;
    if (!(await confirmShortage(first.shortage))) return first;
    return call(true);
  }

  function handlePaymentConfirm(payments: PaymentLine[]) {
    setPaymentError(null);
    runMutation('payment', async () => {
      const result = await withShortageRetry<{ startedPreparation: boolean }>(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${order.id}/payment`, 'PATCH', {
            isPaid: true,
            payments,
            ...(coverShortage ? { coverShortage: true } : {}),
          })
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
    setActionError(null);
    runMutation('wave-proof', async () => {
      const result = await withShortageRetry<{ startedPreparation: boolean }>(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${order.id}/payment`, 'PATCH', {
            isPaid: true,
            payments: [{ mode: 'WAVE', amount: order.total }],
            ...(coverShortage ? { coverShortage: true } : {}),
          })
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
  // `onAccount` : envoi « ardoise » (en cuisine sans encaissement) — transmis
  // tel quel à `sendOrderToKitchen`, qui pose `isOnAccount` SANS toucher à
  // `isPaid`.
  function handleStatusChange(
    newStatus: OrderStatus,
    opts?: { skipUndo?: boolean; onAccount?: boolean }
  ) {
    setActionError(null);
    const previousStatus = order.status;
    const wasPaid = order.isPaid;
    runMutation(`status:${newStatus}`, async () => {
      // L'entrée en cuisine réserve le stock : elle peut donc buter sur une
      // pénurie, que le cuisinier/caissier peut couvrir sur place.
      const result = await withShortageRetry((coverShortage) =>
        callApi(`/api/caisse/orders/${order.id}/status`, 'PATCH', {
          status: newStatus,
          ...(opts?.onAccount ? { onAccount: true } : {}),
          ...(coverShortage ? { coverShortage: true } : {}),
        })
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
    runMutation('driver', async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/driver-request`,
        'PATCH',
        { requested: false }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  /**
   * Lance une commande programmée déjà encaissée. Confirmation quand le retrait
   * est un autre jour : préparer en avance est légitime (une pâtisserie se fait
   * la veille), mais c'est le stock d'AUJOURD'HUI qui sera décompté — autant
   * que ce soit un choix, pas une surprise.
   */
  async function handleStartPreparation() {
    if (isDeferred) {
      const confirmed = await confirm({
        title: 'Lancer maintenant ?',
        message: `Retrait ${formatPickup(order.pickupTime as Date, tickNow)}. La préparation démarre aujourd'hui et le stock du jour sera décompté.`,
        confirmLabel: 'Lancer la préparation',
      });
      if (!confirmed) return;
    }
    handleStatusChange('PREPARING');
  }

  async function handleSendToKitchenWithoutPayment() {
    // L'entrée en cuisine RÉSERVE le stock : cet envoi peut donc buter sur une
    // pénurie. Plus besoin de garde ici — `handleStatusChange` propose de la
    // couvrir sur place si elle se produit.
    const confirmed = await confirm({
      title: 'Mettre sur l’ardoise ?',
      message:
        'La commande part en cuisine sans encaissement et reste NON PAYÉE : le montant dû restera visible dans « Ardoise » jusqu’au règlement.',
      confirmLabel: 'Mettre sur l’ardoise',
    });
    if (!confirmed) return;
    handleStatusChange('PREPARING', { onAccount: true });
  }

  // Annule un encaissement posé AUTOMATIQUEMENT par l'IA (verdict MATCH,
  // cf. lib/ai/payment-proof.ts) — ne touche qu'au paiement (isPaid → false),
  // jamais au statut : la commande peut déjà être en cuisine, voire prête,
  // et ce n'est pas à cette action d'en décider. Toujours disponible tant
  // que `paymentAutoValidatedByAi` est vrai — pas de fenêtre de 10 s comme
  // le toast d'annulation d'un encaissement caisse classique, car personne
  // n'était devant l'écran au moment de l'encaissement automatique.
  async function handleUndoAutoValidation() {
    const confirmed = await confirm({
      title: 'Annuler l’encaissement IA ?',
      message: `La commande ${orderRef} repassera « non payée ».`,
      confirmLabel: 'Annuler l’encaissement',
      destructive: true,
    });
    if (!confirmed) return;
    setActionError(null);
    runMutation('undo-ai', async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/payment`,
        'PATCH',
        { isPaid: false }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  // Annuler une commande non payée ; rembourser (= annuler) une commande payée.
  async function handleCancelOrRefund() {
    const confirmed = await confirm(
      order.isPaid
        ? {
            title: 'Rembourser et annuler ?',
            message: `Le montant de ${priceFormatter.format(order.total)} F sera rendu au client pour la commande ${orderRef}.`,
            confirmLabel: 'Rembourser et annuler',
            destructive: true,
          }
        : {
            title: 'Annuler la commande ?',
            message: `La commande ${orderRef} sera annulée.`,
            confirmLabel: 'Annuler la commande',
            cancelLabel: 'Revenir',
            destructive: true,
          }
    );
    if (!confirmed) return;
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
            {pendingAction === 'driver' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="mr-1.5 h-4 w-4" />
            )}
            Demande livreur gérée
          </Button>
        )}

        {/* Stock épuisé sur un article de cette commande : signal informatif.
            Il n'y a plus de garde bloquante — si l'action bute vraiment sur le
            stock, la feuille « vous les avez produits ? » prend le relais. */}
        {hasStockShortage && (
          <div className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Stock épuisé : {order.unavailableItemNames.join(', ')} — produire
              ou proposer un remplacement.
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
              {pendingAction === 'wave-proof' ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Valider le paiement Wave
            </Button>
          )}

        {/* Encaissement posé automatiquement par l'IA : retour en arrière en
            un clic, sans limite de temps (contrairement au toast d'undo 10 s
            d'un encaissement caisse — personne n'était devant l'écran). */}
        {order.isPaid &&
          order.paymentAutoValidatedByAi &&
          order.status !== 'CANCELLED' && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              disabled={isPending}
              onClick={handleUndoAutoValidation}
            >
              {pendingAction === 'undo-ai' ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Bot className="mr-1.5 h-4 w-4" />
              )}
              Annuler l&apos;encaissement automatique
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

        {/* Ardoise : envoyer en cuisine sans encaisser (status NEW seul).
            La commande reste impayée — c'est le suivi de l'ardoise, pas la
            caisse, qui porte la dette. Sur une commande PROGRAMMÉE, c'est le
            même geste, mais le mot juste est « lancer » : elle attend son jour,
            elle n'est pas en retard d'encaissement. */}
        {!order.isPaid && order.status === 'NEW' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={handleSendToKitchenWithoutPayment}
          >
            {pendingAction === 'status:PREPARING' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ChefHat className="mr-1.5 h-4 w-4" />
            )}
            {order.pickupTime
              ? 'Lancer la préparation (ardoise)'
              : 'Envoyer en cuisine (ardoise)'}
          </Button>
        )}

        {/* Commande PROGRAMMÉE DÉJÀ PAYÉE : elle reste NEW jusqu'au jour du
            retrait — l'encaissement d'une différée est purement financier. Sans
            ce bouton, elle n'aurait aucun moyen d'entrer en cuisine depuis la
            caisse. C'est aussi le seul chemin qui décompte son stock, et il est
            volontairement manuel : un manque doit se voir. */}
        {order.isPaid && order.status === 'NEW' && order.pickupTime && (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={handleStartPreparation}
          >
            {pendingAction === 'status:PREPARING' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ChefHat className="mr-1.5 h-4 w-4" />
            )}
            Lancer la préparation
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
            {pendingAction === 'status:READY' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-4 w-4" />
            )}
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
            {pendingAction === 'status:COMPLETED' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-4 w-4" />
            )}
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
          onClick={() => setIsEditCustomerOpen(true)}
        >
          <UserCog className="mr-1.5 h-4 w-4" />
          Modifier le client
        </Button>

        {/* Appliquer / retirer une récompense fidélité, y compris après
            création (pas seulement au moment de la commande), et même sur une
            commande déjà terminée */}
        {canEditLoyalty && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-muted-foreground"
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
              stockReserved={order.stockReservedAt !== null}
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

      {confirmDialog}
      {shortageDialog}
    </>
  );
}
