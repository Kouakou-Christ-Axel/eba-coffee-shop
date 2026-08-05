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
// Le résultat (`Order.paymentProofVerdict`/`paymentProofAnalysis`) est un
// SIGNAL affiché en caisse, jamais une validation automatique du paiement —
// `isPaid` reste un geste caisse manuel (setOrderPayment).

import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  PAYMENT_PROOF_AI_MODEL_PRIMARY,
  PAYMENT_PROOF_AI_MODEL_FALLBACK,
  PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD,
} from '@/config/constants';
import { getContactSettings } from '@/lib/contact-settings-db';
import { setOrderPaymentProofVerdict } from '@/lib/order-mutations';
import { callOpenRouterVision } from '@/lib/ai/openrouter';

const analysisSchema = z.object({
  readable: z.boolean(),
  operator: z.enum(['WAVE', 'ORANGE_MONEY', 'UNKNOWN']),
  amount: z.number().nullable(),
  reference: z.string().nullable(),
  recipientMatches: z.boolean(),
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
      recipientMatches: {
        type: 'boolean',
        description:
          'Vrai si le numéro/nom bénéficiaire affiché correspond à un des numéros marchands fournis dans la consigne.',
      },
      confidence: {
        type: 'number',
        description:
          "Confiance globale du modèle dans son extraction, entre 0 (aucune) et 1 (certaine).",
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
      'recipientMatches',
      'confidence',
      'reasoning',
    ],
  },
};

const SYSTEM_PROMPT =
  "Tu es un assistant qui vérifie des captures d'écran de paiement mobile " +
  "money (Wave, Orange Money) pour un commerce en Côte d'Ivoire. Réponds " +
  'STRICTEMENT au format JSON demandé, sans aucun texte hors du JSON.';

function buildUserPrompt(
  expectedTotal: number,
  wavePaymentNumber: string,
  orangeMoneyPaymentNumber: string
): string {
  return (
    "Voici une capture d'écran envoyée par un client comme preuve de " +
    'paiement mobile money pour une commande de café. ' +
    `Montant attendu : ${expectedTotal} FCFA. ` +
    `Numéro marchand Wave attendu : ${wavePaymentNumber}. ` +
    `Numéro marchand Orange Money attendu : ${orangeMoneyPaymentNumber}. ` +
    "Analyse l'image et extrais les informations demandées. Si l'image " +
    "n'est pas une capture de paiement mobile money exploitable (photo " +
    'hors-sujet, floue, coupée, capture générique sans montant), réponds ' +
    'readable=false.'
  );
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
        total: true,
        paymentProofUrl: true,
        isPaid: true,
        status: true,
      },
    });
    if (!order || !order.paymentProofUrl) return;
    if (order.isPaid || order.status === 'CANCELLED') return;

    const contact = await getContactSettings();
    const userPrompt = buildUserPrompt(
      order.total,
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
      await setOrderPaymentProofVerdict(orderId, {
        verdict: 'PENDING',
        analysis: { error: 'Analyse IA indisponible (échec des deux modèles)' },
      });
      return;
    }

    const verdict = !analysis.readable
      ? 'UNREADABLE'
      : analysis.recipientMatches && analysis.amount === order.total
        ? 'MATCH'
        : 'MISMATCH';

    await setOrderPaymentProofVerdict(orderId, {
      verdict,
      analysis: { ...analysis, model, expectedTotal: order.total },
    });
  } catch (err) {
    // Défense en profondeur : cette fonction tourne en arrière-plan
    // (Next.js `after()`), une erreur ne doit jamais remonter à l'appelant.
    console.error('[analyzePaymentProof]', orderId, err);
  }
}
