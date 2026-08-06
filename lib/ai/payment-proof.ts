// lib/ai/payment-proof.ts
//
// Pré-analyse IA (OpenRouter, vision) d'une capture de paiement uploadée par
// un client (Order.paymentProofUrl). Déclenchée en arrière-plan juste après
// l'upload (cf. app/api/commandes/[id]/preuve-paiement/route.ts, via Next.js
// `after()`) — ne bloque jamais le client et ne jette jamais vers son
// appelant.
//
// Stratégie à deux étages : un modèle rapide/économique traite le cas
// courant ; un modèle plus précis ne prend le relais que si le premier passe
// échoue à produire un JSON exploitable ou renvoie une confiance basse
// (cf. PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD).
//
// Le prompt et les règles de décision vivent dans ./payment-proof-rules.ts
// (pur, testable). Ils partent d'un constat : les clients paient depuis
// n'importe quelle application (Wave, Orange Money, MTN MoMo, Moov Money,
// Djamo, applis bancaires...), chacune avec ses propres écrans, et une
// capture prise côté client affiche un DÉBIT (« -9.000F ») pour un paiement
// parfaitement légitime. Le modèle ne peut donc pas juger sur la ressemblance
// à une interface connue : seuls des signaux positifs d'anomalie (retouche
// matérielle, bénéficiaire manifestement autre, transaction échouée, montant
// insuffisant, capture antérieure à la commande) font basculer le verdict.
//
// Un verdict MATCH avec une confiance suffisante (>=
// PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD) déclenche un encaissement
// AUTOMATIQUE (setOrderPayment, mode déduit de l'opérateur détecté),
// marqué `Order.paymentAutoValidatedByAi` — la caisse dispose d'un bouton
// dédié pour ANNULER cet encaissement en un clic si le verdict était erroné
// (cf. order-card-actions.tsx). MISMATCH/UNREADABLE/PENDING ne déclenchent
// jamais de paiement : ce sont de purs signaux affichés en caisse.
//
// Chaque fois que l'encaissement automatique n'a PAS été appliqué (verdict
// non-MATCH, confiance insuffisante, bénéficiaire non identifiable, ou
// tentative d'encaissement échouée), le POURQUOI est enregistré dans
// `paymentProofAnalysis.autoValidation` (affiché en caisse, cf.
// order-card.tsx) ET une notification push est envoyée au staff caisse
// (`ROLE_GROUPS.CASHIER_PLUS`) — l'IA « lève la main » explicitement quand
// elle a besoin d'un arbitrage humain, plutôt que de laisser un badge
// silencieux passer inaperçu.

import prisma from '@/lib/prisma';
import {
  PAYMENT_PROOF_AI_MODEL_PRIMARY,
  PAYMENT_PROOF_AI_MODEL_FALLBACK,
  PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD,
} from '@/config/constants';
import { getContactSettings } from '@/lib/contact-settings-db';
import {
  setOrderPaymentProofVerdict,
  setOrderPayment,
  OrderMutationError,
} from '@/lib/order-mutations';
import { callOpenRouterVision } from '@/lib/ai/openrouter';
import {
  ANALYSIS_JSON_SCHEMA,
  SYSTEM_PROMPT,
  analysisSchema,
  blocksAutoValidation,
  buildUserPrompt,
  computeVerdict,
  isDateConsistent,
  normalizeAmount,
  operatorToPaymentMode,
  type Analysis,
} from '@/lib/ai/payment-proof-rules';
import { sendPushToRoles } from '@/lib/push-notify';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { PaymentProofVerdict } from '@/generated/prisma/client';

/** Résultat de la tentative d'encaissement automatique — `reason` explique
 * TOUJOURS le pourquoi d'un `applied: false`, affiché en caisse et repris
 * dans la notification push. `null` uniquement quand `applied` est vrai. */
type AutoValidationResult = { applied: boolean; reason: string | null };

const NO_AUTO_VALIDATION: AutoValidationResult = {
  applied: false,
  reason: null,
};

/**
 * Tente l'encaissement automatique pour un verdict MATCH. Revérifie ICI la
 * confiance (et non seulement plus haut, pour décider du repli de modèle) :
 * un MATCH obtenu par le modèle de repli avec une confiance elle-même sous
 * le seuil ne doit pas déclencher de paiement silencieux.
 */
async function attemptAutoValidation(
  orderId: string,
  order: { total: number },
  analysis: Analysis,
  verdict: PaymentProofVerdict
): Promise<AutoValidationResult> {
  if (verdict !== 'MATCH') return NO_AUTO_VALIDATION;

  if (analysis.confidence < PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD) {
    const confidencePct = Math.round(analysis.confidence * 100);
    const thresholdPct = Math.round(
      PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD * 100
    );
    return {
      applied: false,
      reason: `Conforme, mais confiance insuffisante pour un encaissement automatique (${confidencePct}% < seuil ${thresholdPct}%)`,
    };
  }

  // Signaux qui ne condamnent pas la capture mais demandent un œil humain
  // avant de poser un paiement (bénéficiaire non affiché par l'application).
  const blocking = blocksAutoValidation(analysis);
  if (blocking) return { applied: false, reason: blocking };

  try {
    await setOrderPayment(
      orderId,
      true,
      [
        {
          mode: operatorToPaymentMode(analysis.operator),
          amount: order.total,
        },
      ],
      null,
      { autoValidatedByAi: true }
    );
    return { applied: true, reason: null };
  } catch (err) {
    // Best-effort : le badge MATCH reste affiché, la commande reste non
    // payée, la caisse garde la main via le bouton de validation manuel
    // existant (ex. stock épuisé entre-temps, commande déjà encaissée par un
    // caissier en parallèle, commande annulée).
    const message =
      err instanceof OrderMutationError ? err.message : 'erreur inattendue';
    console.error(
      '[analyzePaymentProof] encaissement automatique échoué',
      orderId,
      err
    );
    return {
      applied: false,
      reason: `Conforme, mais l'encaissement automatique a échoué (${message})`,
    };
  }
}

const REVIEW_VERDICT_LABEL: Record<PaymentProofVerdict, string> = {
  MATCH: 'Conforme',
  MISMATCH: 'Incohérence détectée',
  UNREADABLE: 'Capture illisible',
  PENDING: 'Analyse indisponible',
};

/**
 * Alerte le staff caisse qu'une preuve de paiement a été analysée SANS
 * déclencher d'encaissement automatique — l'IA « lève la main » pour un
 * arbitrage humain. Fire-and-forget, comme le reste de lib/push-notify.ts.
 *
 * Corps COURT et structuré, à l'image des autres pushes du repo
 * (`notifyKitchen`, « Nouvelle commande en ligne ») — le raisonnement libre
 * de l'IA n'y figure JAMAIS : il reste consultable d'un clic dans la carte
 * caisse (popover sur le badge de verdict, cf. order-card.tsx), pas poussé
 * en notification.
 */
function notifyPaymentReviewNeeded(
  order: { id: string; dailyNumber: number },
  verdict: PaymentProofVerdict
): void {
  sendPushToRoles(ROLE_GROUPS.CASHIER_PLUS, {
    title: 'Preuve de paiement à vérifier',
    body: `#${String(order.dailyNumber).padStart(3, '0')} · ${REVIEW_VERDICT_LABEL[verdict]}`,
    url: '/dashboard/caisse',
    tag: `payment-proof-review-${order.id}`,
  }).catch((err) => {
    console.error(
      '[analyzePaymentProof] notification push échouée',
      order.id,
      err
    );
  });
}

async function runAnalysis(
  model: string,
  imageUrl: string,
  userPrompt: string
): Promise<Analysis | null> {
  try {
    const raw = await callOpenRouterVision({
      model,
      imageUrl,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: ANALYSIS_JSON_SCHEMA,
    });
    const parsed = analysisSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function analyzePaymentProof(orderId: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        total: true,
        createdAt: true,
        paymentProofUrl: true,
        isPaid: true,
        status: true,
        dailyNumber: true,
      },
    });
    if (!order || !order.paymentProofUrl) return;
    if (order.isPaid || order.status === 'CANCELLED') return;

    const contact = await getContactSettings();
    const userPrompt = buildUserPrompt(
      order,
      contact.wavePaymentNumber,
      contact.orangeMoneyPaymentNumber
    );

    let analysis = await runAnalysis(
      PAYMENT_PROOF_AI_MODEL_PRIMARY,
      order.paymentProofUrl,
      userPrompt
    );
    let model = PAYMENT_PROOF_AI_MODEL_PRIMARY;

    if (
      !analysis ||
      analysis.confidence < PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD
    ) {
      const fallback = await runAnalysis(
        PAYMENT_PROOF_AI_MODEL_FALLBACK,
        order.paymentProofUrl,
        userPrompt
      );
      if (fallback) {
        analysis = fallback;
        model = PAYMENT_PROOF_AI_MODEL_FALLBACK;
      }
    }

    if (!analysis) {
      const reason = 'Analyse IA indisponible (échec des deux modèles)';
      await setOrderPaymentProofVerdict(orderId, {
        verdict: 'PENDING',
        analysis: {
          error: reason,
          autoValidation: { applied: false, reason },
        },
      });
      notifyPaymentReviewNeeded(order, 'PENDING');
      return;
    }

    // Montant ramené en valeur absolue : une capture côté client affiche le
    // débit de SON compte (« -9.000F » = 9 000 FCFA envoyés au commerce).
    const amount = normalizeAmount(analysis.amount);
    const dateConsistent = isDateConsistent(
      analysis.transactionDate,
      order.createdAt
    );
    const { verdict, amountMatches, overpaid } = computeVerdict({
      analysis,
      amount,
      orderTotal: order.total,
      dateConsistent,
    });

    // Tentative d'encaissement automatique AVANT l'écriture du verdict — le
    // résultat (`autoValidation`, avec sa raison si non appliqué) fait
    // partie de l'analyse persistée en un seul écrit.
    const autoValidation = await attemptAutoValidation(
      orderId,
      order,
      analysis,
      verdict
    );

    await setOrderPaymentProofVerdict(orderId, {
      verdict,
      analysis: {
        ...analysis,
        amount,
        model,
        expectedTotal: order.total,
        amountMatches,
        overpaid,
        dateConsistent,
        autoValidation,
      },
    });

    // L'IA « lève la main » : verdict analysé mais aucun encaissement posé —
    // la caisse doit trancher (badge visible + notification push).
    if (!autoValidation.applied) {
      notifyPaymentReviewNeeded(order, verdict);
    }
  } catch (err) {
    // Défense en profondeur : cette fonction tourne en arrière-plan
    // (Next.js `after()`), une erreur ne doit jamais remonter à l'appelant.
    console.error('[analyzePaymentProof]', orderId, err);
  }
}
