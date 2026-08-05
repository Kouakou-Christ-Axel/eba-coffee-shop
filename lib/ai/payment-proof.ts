// lib/ai/payment-proof.ts
//
// Pré-analyse IA (OpenRouter, vision) d'une capture de paiement Wave/Orange
// Money uploadée par un client (Order.paymentProofUrl). Déclenchée en
// arrière-plan juste après l'upload (cf.
// app/api/commandes/[id]/preuve-paiement/route.ts, via Next.js `after()`) —
// ne bloque jamais le client et ne jette jamais vers son appelant.
//
// Stratégie à deux étages : un modèle rapide/économique traite le cas
// courant ; un modèle plus précis ne prend le relais que si le premier passe
// échoue à produire un JSON exploitable ou renvoie une confiance basse
// (cf. PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD).
//
// Le prompt demande explicitement (1) l'extraction paiement ET (2) une
// recherche active d'indices de retouche (tampering) — toute anomalie
// bascule le verdict en MISMATCH même si le montant correspond. Il demande
// aussi le nom du bénéficiaire (comparé au nom du commerce, utile surtout
// pour Wave) et la date/heure affichée sur la capture, comparée
// server-side à `Order.createdAt` (cf. `isDateConsistent`) pour repérer une
// capture antérieure à la commande — signe de paiement recyclé.
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
// non-MATCH, confiance insuffisante, ou tentative d'encaissement échouée),
// le POURQUOI est enregistré dans `paymentProofAnalysis.autoValidation`
// (affiché en caisse, cf. order-card.tsx) ET une notification push est
// envoyée au staff caisse (`ROLE_GROUPS.CASHIER_PLUS`) — l'IA « lève la
// main » explicitement quand elle a besoin d'un arbitrage humain, plutôt
// que de laisser un badge silencieux passer inaperçu.

import { z } from 'zod';
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
import { sendPushToRoles } from '@/lib/push-notify';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type {
  PaymentMode,
  PaymentProofVerdict,
} from '@/generated/prisma/client';

const analysisSchema = z.object({
  readable: z.boolean(),
  operator: z.enum(['WAVE', 'ORANGE_MONEY', 'UNKNOWN']),
  amount: z.number().nullable(),
  reference: z.string().nullable(),
  recipientName: z.string().nullable(),
  recipientMatches: z.boolean(),
  transactionDate: z.string().nullable(),
  tamperingSuspected: z.boolean(),
  tamperingReasons: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

type Analysis = z.infer<typeof analysisSchema>;

const ANALYSIS_JSON_SCHEMA = {
  name: 'payment_proof_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      readable: {
        type: 'boolean',
        description:
          "Vrai si l'image est une capture d'écran de paiement mobile money exploitable (montant/bénéficiaire lisibles).",
      },
      operator: {
        type: 'string',
        enum: ['WAVE', 'ORANGE_MONEY', 'UNKNOWN'],
        description: 'Opérateur mobile money identifié sur la capture.',
      },
      amount: {
        type: ['number', 'null'],
        description:
          'Montant du paiement affiché sur la capture, en FCFA (nombre entier). Null si illisible.',
      },
      reference: {
        type: ['string', 'null'],
        description:
          'Référence ou identifiant de transaction affiché sur la capture. Null si absent ou illisible.',
      },
      recipientName: {
        type: ['string', 'null'],
        description:
          'Nom du bénéficiaire affiché sur la capture (ex. après « Transféré à »/« Envoyé à » sur Wave). Null si absent ou illisible.',
      },
      recipientMatches: {
        type: 'boolean',
        description:
          'Vrai si le NUMÉRO ou le NOM du bénéficiaire affiché correspond au numéro marchand ou au nom du commerce fournis dans la consigne.',
      },
      transactionDate: {
        type: ['string', 'null'],
        description:
          "Date et heure de la transaction telles qu'affichées sur la capture, au format ISO 8601 (ex. 2026-08-05T14:32:00) UNIQUEMENT si tu peux les déduire sans ambiguïté. Sinon null — ne devine pas.",
      },
      tamperingSuspected: {
        type: 'boolean',
        description:
          "Vrai si tu observes des indices de retouche/montage de l'image : polices ou espacements incohérents autour du montant/de la date/de la référence, alignement anormal, flou ou pixellisation localisée, éléments d'interface qui ne correspondent pas à l'application officielle Wave/Orange Money, zone recadrée qui masque des informations, ou toute autre anomalie visuelle suggérant une modification.",
      },
      tamperingReasons: {
        type: ['string', 'null'],
        description:
          'Description courte (en français) des indices de retouche observés. Null si tamperingSuspected est faux.',
      },
      confidence: {
        type: 'number',
        description:
          'Confiance globale du modèle dans son extraction, entre 0 (aucune) et 1 (certaine).',
      },
      reasoning: {
        type: 'string',
        description: 'Explication courte en français des éléments observés.',
      },
    },
    required: [
      'readable',
      'operator',
      'amount',
      'reference',
      'recipientName',
      'recipientMatches',
      'transactionDate',
      'tamperingSuspected',
      'tamperingReasons',
      'confidence',
      'reasoning',
    ],
  },
};

// Nom d'affichage du commerce, comparé au bénéficiaire affiché sur la
// capture (surtout Wave, qui affiche le nom du destinataire). Dupliqué en
// littéral comme le reste du repo (cf. lib/json-ld.ts, app/manifest.json) —
// aucune constante centralisée n'existe pour ce nom.
const SHOP_DISPLAY_NAME = 'EBA Coffee Shop';

const SYSTEM_PROMPT =
  "Tu es un enquêteur qui vérifie des captures d'écran de paiement mobile " +
  "money (Wave, Orange Money) pour un commerce en Côte d'Ivoire. Ton rôle " +
  'a DEUX volets, aussi importants l’un que l’autre : (1) extraire les ' +
  'informations du paiement, (2) chercher activement des indices que la ' +
  "capture a été retouchée, montée, ou réutilisée d'un autre paiement. Ne " +
  'donne jamais le bénéfice du doute par défaut — une capture propre et ' +
  'un montant qui correspond ne suffisent pas à écarter une manipulation ' +
  'si tu observes des anomalies visuelles. Réponds STRICTEMENT au format ' +
  'JSON demandé, sans aucun texte hors du JSON.';

function buildUserPrompt(
  order: { total: number; createdAt: Date },
  wavePaymentNumber: string,
  orangeMoneyPaymentNumber: string
): string {
  const orderDateLabel = order.createdAt.toISOString();
  return (
    "Voici une capture d'écran envoyée par un client comme preuve de " +
    `paiement mobile money pour une commande de café passée le ${orderDateLabel} (UTC). ` +
    `Montant attendu : ${order.total} FCFA. ` +
    `Numéro marchand Wave attendu : ${wavePaymentNumber}. ` +
    `Numéro marchand Orange Money attendu : ${orangeMoneyPaymentNumber}. ` +
    `Nom du commerce bénéficiaire attendu : ${SHOP_DISPLAY_NAME}. ` +
    "Analyse l'image et extrais les informations demandées :\n" +
    '- Montant, opérateur, référence de transaction.\n' +
    '- Nom et/ou numéro du bénéficiaire affiché, et sa correspondance avec ' +
    'le numéro marchand ou le nom du commerce donnés ci-dessus (sur Wave, ' +
    'le nom du bénéficiaire apparaît généralement après « Transféré à » ou ' +
    '« Envoyé à »).\n' +
    '- Date et heure de la transaction affichées sur la capture (ISO 8601 ' +
    'uniquement si non ambiguës, sinon null) — une capture datée AVANT la ' +
    "commande trahit un paiement recyclé d'une commande précédente.\n" +
    '- Indices de retouche/montage : polices ou espacements incohérents ' +
    'autour du montant/de la date/de la référence, alignement anormal, ' +
    "flou ou pixellisation localisée, éléments d'interface ne correspondant " +
    "pas à l'application officielle Wave/Orange Money, zone recadrée " +
    'masquant des informations, ou toute autre anomalie visuelle.\n\n' +
    "Si l'image n'est pas une capture de paiement mobile money exploitable " +
    '(photo hors-sujet, floue, coupée, capture générique sans montant), ' +
    'réponds readable=false.'
  );
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Compare la date de transaction extraite de la capture à la date de
 * création de la commande. `null` = pas de date exploitable côté capture
 * (rien à reprocher : la date n'est pas toujours visible/lisible). `false`
 * = capture visiblement ANTÉRIEURE à la commande (au-delà d'une tolérance
 * d'horloge) — signe fort de réutilisation d'un ancien paiement.
 */
function isDateConsistent(
  transactionDateRaw: string | null,
  orderCreatedAt: Date
): boolean | null {
  if (!transactionDateRaw || !ISO_DATE_RE.test(transactionDateRaw)) {
    return null;
  }
  const parsed = new Date(transactionDateRaw);
  if (Number.isNaN(parsed.getTime())) return null;
  const toleranceMs = 10 * 60 * 1000;
  return parsed.getTime() >= orderCreatedAt.getTime() - toleranceMs;
}

/** `UNKNOWN` (opérateur non identifié malgré un verdict MATCH) → `OTHER`. */
function operatorToPaymentMode(operator: Analysis['operator']): PaymentMode {
  return operator === 'WAVE' || operator === 'ORANGE_MONEY'
    ? operator
    : 'OTHER';
}

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
 */
function notifyPaymentReviewNeeded(
  order: { id: string; dailyNumber: number },
  verdict: PaymentProofVerdict,
  reason: string
): void {
  sendPushToRoles(ROLE_GROUPS.CASHIER_PLUS, {
    title: `Preuve de paiement à vérifier · #${String(order.dailyNumber).padStart(3, '0')}`,
    body: `${REVIEW_VERDICT_LABEL[verdict]} — ${reason}`,
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
      notifyPaymentReviewNeeded(order, 'PENDING', reason);
      return;
    }

    const amountMatches = analysis.amount === order.total;
    const dateConsistent = isDateConsistent(
      analysis.transactionDate,
      order.createdAt
    );

    // Toute anomalie fait basculer en MISMATCH — retouche suspectée, montant
    // erroné, bénéficiaire ne correspondant pas, OU capture antérieure à la
    // commande (paiement recyclé). `dateConsistent === null` (date non
    // exploitable) n'est PAS pénalisé : ce n'est pas un signal, juste une
    // absence de signal.
    const verdict = !analysis.readable
      ? 'UNREADABLE'
      : analysis.tamperingSuspected ||
          !analysis.recipientMatches ||
          !amountMatches ||
          dateConsistent === false
        ? 'MISMATCH'
        : 'MATCH';

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
        model,
        expectedTotal: order.total,
        amountMatches,
        dateConsistent,
        autoValidation,
      },
    });

    // L'IA « lève la main » : verdict analysé mais aucun encaissement posé —
    // la caisse doit trancher (badge visible + notification push).
    if (!autoValidation.applied) {
      notifyPaymentReviewNeeded(
        order,
        verdict,
        autoValidation.reason ?? analysis.reasoning
      );
    }
  } catch (err) {
    // Défense en profondeur : cette fonction tourne en arrière-plan
    // (Next.js `after()`), une erreur ne doit jamais remonter à l'appelant.
    console.error('[analyzePaymentProof]', orderId, err);
  }
}
