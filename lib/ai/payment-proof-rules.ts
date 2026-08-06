// lib/ai/payment-proof-rules.ts
//
// Partie PURE de la pré-analyse des preuves de paiement : schéma de sortie
// attendu du modèle, prompts, et règles de décision. Aucun accès base /
// réseau ici — l'orchestration (appel modèle, encaissement, notification)
// vit dans lib/ai/payment-proof.ts, ce qui rend ces règles testables seules.
//
// Principe directeur : le modèle ne connaît PAS toutes les applications de
// paiement utilisées en Côte d'Ivoire (Wave, Orange Money, MTN MoMo, Moov
// Money, Djamo, applis bancaires, agrégateurs...), et chacune présente une
// transaction à sa façon. Une capture légitime peut donc afficher un montant
// NÉGATIF (débit du compte du client qui nous envoie l'argent), aucun numéro
// marchand, ou une interface que le modèle n'a jamais vue. Rien de tout cela
// n'est un indice de fraude : le prompt le dit explicitement, et les règles
// ci-dessous ne pénalisent que des signaux positifs (retouche matérielle,
// bénéficiaire manifestement autre, transaction échouée, montant insuffisant,
// capture antérieure à la commande). L'absence d'information n'est jamais
// traitée comme une anomalie — au pire elle bloque l'encaissement
// automatique et renvoie l'arbitrage à la caisse.

import { z } from 'zod';
import { formatLocalDateOnly } from '@/lib/timezone';
import type {
  PaymentMode,
  PaymentProofVerdict,
} from '@/generated/prisma/client';

/** Applications de paiement rencontrées à Abidjan. `OTHER` = application de
 * paiement identifiée mais hors liste (agrégateur, appli bancaire non
 * reconnue) ; `UNKNOWN` = impossible de dire laquelle. Les deux se mappent
 * sur `PaymentMode.OTHER` — l'opérateur reste une information d'affichage. */
export const PAYMENT_PROOF_OPERATORS = [
  'WAVE',
  'ORANGE_MONEY',
  'MTN_MONEY',
  'MOOV_MONEY',
  'DJAMO',
  'BANK',
  'OTHER',
  'UNKNOWN',
] as const;

/** Tri-état volontaire (plutôt qu'un booléen) : « pas d'information » ne doit
 * jamais se confondre avec « information contradictoire ». */
const triStateSchema = z.enum(['MATCH', 'MISMATCH', 'UNKNOWN']);

export const analysisSchema = z.object({
  readable: z.boolean(),
  operator: z.enum(PAYMENT_PROOF_OPERATORS),
  amount: z.number().nullable(),
  reference: z.string().nullable(),
  recipientName: z.string().nullable(),
  recipientMatch: triStateSchema,
  transactionStatus: z.enum(['SUCCESS', 'FAILED_OR_PENDING', 'UNKNOWN']),
  transactionDate: z.string().nullable(),
  tamperingSuspected: z.boolean(),
  tamperingReasons: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const ANALYSIS_JSON_SCHEMA = {
  name: 'payment_proof_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      readable: {
        type: 'boolean',
        description:
          "Vrai dès que l'image est une capture d'écran ou un reçu de paiement exploitable (un montant est lisible), QUELLE QUE SOIT l'application utilisée. Faux uniquement si l'image est hors-sujet, trop floue ou trop coupée pour en tirer un montant.",
      },
      operator: {
        type: 'string',
        enum: [...PAYMENT_PROOF_OPERATORS],
        description:
          "Application de paiement identifiée. OTHER = c'est bien une application de paiement mais hors liste (autre banque, agrégateur). UNKNOWN = impossible de trancher. Ne force jamais WAVE ou ORANGE_MONEY par défaut.",
      },
      amount: {
        type: ['number', 'null'],
        description:
          "Montant de la transaction en FCFA, TOUJOURS en valeur absolue positive (entier). Une capture prise du côté du client affiche normalement un débit, souvent précédé d'un signe moins ou en rouge : reporte 9000 pour « -9.000F ». Null si illisible.",
      },
      reference: {
        type: ['string', 'null'],
        description:
          'Référence, ID de transaction ou numéro de reçu affiché. Null si absent ou illisible.',
      },
      recipientName: {
        type: ['string', 'null'],
        description:
          "Bénéficiaire affiché, tel qu'écrit sur la capture : nom du marchand (« Paiement Eba Coffee Shop »), nom d'une personne (« Transféré à … »), ou numéro de téléphone. Null si la capture n'en montre aucun.",
      },
      recipientMatch: {
        type: 'string',
        enum: ['MATCH', 'MISMATCH', 'UNKNOWN'],
        description:
          "MATCH si le bénéficiaire affiché correspond au commerce (nom du commerce même abrégé, sans accents ou mal orthographié, OU numéro marchand fourni dans la consigne). MISMATCH uniquement si le bénéficiaire est manifestement quelqu'un d'autre. UNKNOWN si la capture ne montre aucun bénéficiaire exploitable — beaucoup d'applications n'en affichent pas : ce n'est pas une anomalie.",
      },
      transactionStatus: {
        type: 'string',
        enum: ['SUCCESS', 'FAILED_OR_PENDING', 'UNKNOWN'],
        description:
          "SUCCESS si un statut de réussite est affiché (« Effectué », « Réussi », « Succès », « Terminé », « Confirmé », coche verte). FAILED_OR_PENDING si un statut d'échec ou d'attente est affiché (« Échoué », « Annulé », « Rejeté », « En attente », « En cours »). UNKNOWN si aucun statut n'est affiché — c'est fréquent et ce n'est pas une anomalie.",
      },
      transactionDate: {
        type: ['string', 'null'],
        description:
          "Date et heure de la transaction telles qu'affichées sur la capture, recopiées SANS conversion de fuseau, au format ISO 8601 (ex. 2026-08-05T14:32:00) UNIQUEMENT si tu peux les déduire sans ambiguïté. Si seule la date est lisible, renvoie-la seule (ex. 2026-08-05). Sinon null — ne devine pas.",
      },
      tamperingSuspected: {
        type: 'boolean',
        description:
          "Vrai UNIQUEMENT si tu observes une anomalie MATÉRIELLE dans les pixels : police, graisse ou anticrénelage des chiffres du montant différents du reste du texte, chiffres décalés de la ligne de base, halo de compression ou pixellisation localisée autour du montant/de la date/du bénéficiaire, rectangle de fond légèrement teinté sous une zone de texte, caractère résiduel sous un chiffre, bordure ou ombre interrompue. Une interface que tu ne reconnais pas, un montant négatif, l'absence de numéro marchand ou un thème sombre ne sont JAMAIS des indices de retouche.",
      },
      tamperingReasons: {
        type: ['string', 'null'],
        description:
          "Description courte (en français) de l'anomalie matérielle observée, en désignant la zone concernée. Null si tamperingSuspected est faux.",
      },
      confidence: {
        type: 'number',
        description:
          'Confiance globale du modèle dans son extraction, entre 0 (aucune) et 1 (certaine).',
      },
      reasoning: {
        type: 'string',
        description:
          "Explication courte en français : quelle application, quel point de vue (débit du client / crédit du marchand), et ce qui t'a fait conclure.",
      },
    },
    required: [
      'readable',
      'operator',
      'amount',
      'reference',
      'recipientName',
      'recipientMatch',
      'transactionStatus',
      'transactionDate',
      'tamperingSuspected',
      'tamperingReasons',
      'confidence',
      'reasoning',
    ],
  },
};

/** Nom d'affichage du commerce, comparé au bénéficiaire affiché sur la
 * capture. Dupliqué en littéral comme le reste du repo (cf. lib/json-ld.ts,
 * app/manifest.json) — aucune constante centralisée n'existe pour ce nom. */
export const SHOP_DISPLAY_NAME = 'EBA Coffee Shop';

export const SYSTEM_PROMPT =
  'Tu es un vérificateur de preuves de paiement pour un commerce en Côte ' +
  "d'Ivoire. Les clients paient depuis N'IMPORTE QUELLE application : Wave, " +
  'Orange Money, MTN MoMo, Moov Money, Djamo, une application bancaire, un ' +
  'agrégateur. Chacune a ses propres écrans, ses propres couleurs et ses ' +
  'propres libellés, et elles changent au fil des mises à jour. Ton travail ' +
  'est de LIRE ET COMPRENDRE la capture qui t’est montrée, pas de la ' +
  'comparer à une maquette que tu croirais connaître.\n\n' +
  'POINT DE VUE. La capture vient presque toujours du téléphone du CLIENT, ' +
  "donc de SON côté : l'argent SORT de son compte pour venir chez nous. Le " +
  'montant y apparaît souvent précédé d’un signe moins, en rouge, ou avec ' +
  'les mentions « Débit », « Paiement », « Envoyé », « Sortant ». C’est le ' +
  'fonctionnement NORMAL d’un paiement réussi : « -9.000F » sur la capture ' +
  'du client signifie qu’il nous a bien envoyé 9 000 FCFA. Reporte toujours ' +
  'le montant en valeur absolue. Une capture côté marchand (« Reçu », ' +
  '« Crédit », montant positif) est tout aussi valide.\n\n' +
  'DEUX VOLETS, également importants : (1) extraire les informations du ' +
  'paiement ; (2) signaler une retouche, mais UNIQUEMENT sur la base ' +
  'd’indices matériels visibles dans les pixels.\n\n' +
  'RÈGLE ABSOLUE : une interface que tu ne reconnais pas n’est PAS un ' +
  'indice de fraude. Ne concluent JAMAIS à une retouche : une mise en page ' +
  'inhabituelle, une application inconnue, un montant négatif ou en rouge, ' +
  'un thème sombre, une langue différente, une icône décorative, l’absence ' +
  'du numéro marchand ou de la référence, une capture recadrée par le ' +
  'partage natif du téléphone, ou le simple fait que l’écran ne ressemble ' +
  'pas à Wave ou Orange Money. Ces différences sont des différences ' +
  'd’application, pas des manipulations.\n\n' +
  'À l’inverse, ne donne pas non plus le bénéfice du doute quand tu vois ' +
  'une vraie anomalie matérielle (montant recollé, police incohérente, ' +
  'pixellisation locale) : signale-la précisément.\n\n' +
  'Quand une information est absente de la capture, réponds null / UNKNOWN. ' +
  'N’invente rien et ne transforme jamais une absence d’information en ' +
  'soupçon. Réponds STRICTEMENT au format JSON demandé, sans aucun texte ' +
  'hors du JSON.';

export function buildUserPrompt(
  order: { total: number; createdAt: Date },
  wavePaymentNumber: string,
  orangeMoneyPaymentNumber: string
): string {
  const orderDateLabel = order.createdAt.toISOString();
  return (
    "Voici une capture d'écran envoyée par un client comme preuve de " +
    `paiement pour une commande de café passée le ${orderDateLabel} (UTC). ` +
    `Montant attendu : ${order.total} FCFA (valeur absolue — la capture peut ` +
    'afficher ce montant en négatif côté client). ' +
    `Numéro marchand Wave : ${wavePaymentNumber}. ` +
    `Numéro marchand Orange Money : ${orangeMoneyPaymentNumber}. ` +
    `Nom du commerce bénéficiaire : ${SHOP_DISPLAY_NAME}. ` +
    'Le client peut aussi avoir payé par MTN MoMo, Moov Money, Djamo, une ' +
    'application bancaire ou un agrégateur : ces paiements sont légitimes, ' +
    'même si aucun des numéros ci-dessus n’apparaît.\n\n' +
    "Analyse l'image et extrais les informations demandées :\n" +
    '- Application utilisée, montant (valeur absolue), référence.\n' +
    '- Bénéficiaire affiché et sa correspondance avec le commerce : le nom ' +
    'peut apparaître comme libellé marchand (« Paiement Eba Coffee Shop », ' +
    '« ACHAT EBA COFFEE »), après « Transféré à » / « Envoyé à », ou sous ' +
    'forme de numéro. Accepte les abréviations, la casse, les accents ' +
    'manquants et les fautes légères. Si la capture ne montre aucun ' +
    'bénéficiaire, réponds UNKNOWN plutôt que MISMATCH.\n' +
    '- Statut de la transaction, si un statut est affiché.\n' +
    '- Date et heure affichées, recopiées telles quelles (heure locale ' +
    "d'Abidjan, aucune conversion de fuseau ; ISO 8601 uniquement si non " +
    'ambiguës, sinon null) — une capture datée AVANT la commande trahit un ' +
    "paiement recyclé d'une commande précédente.\n" +
    '- Indices matériels de retouche, en te limitant à ce qui se voit dans ' +
    'les pixels : police/graisse/anticrénelage du montant différents du ' +
    'reste du texte, chiffres décalés de la ligne de base, pixellisation ou ' +
    'halo localisé, fond légèrement teinté sous une zone de texte, bordure ' +
    'ou ombre interrompue. Rien d’autre ne compte comme indice.\n\n' +
    "Si l'image n'est pas une preuve de paiement exploitable (photo " +
    'hors-sujet, trop floue ou trop coupée pour lire un montant), réponds ' +
    'readable=false.'
  );
}

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
/** Suffixe de fuseau explicite : `Z`, `+00:00`, `-0200`… */
const EXPLICIT_TZ_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Une capture peut légitimement précéder la commande : le client paie au
 * comptoir ou sur WhatsApp, et la caisse saisit la commande ensuite. Seul un
 * écart franc trahit un paiement recyclé — d'où une tolérance large plutôt
 * qu'une poignée de minutes. */
const CAPTURE_BEFORE_ORDER_TOLERANCE_MS = 2 * 60 * 60 * 1000;

type ParsedCaptureDate = { instant: Date; hasTime: boolean };

/**
 * Interprète la date lue sur la capture. Le modèle renvoie une heure
 * MURALE, telle qu'affichée sur le téléphone du client — donc en heure
 * d'Abidjan, sans indicateur de fuseau. `new Date('2026-08-06T17:31:00')`
 * la parserait dans le fuseau du RUNTIME (cf. lib/timezone.ts : un serveur
 * hors UTC décale tout de +2h), ce qui faisait passer une capture postérieure
 * de 9 minutes à la commande pour un paiement recyclé de 1h51 d'âge. On ancre
 * donc explicitement sur Abidjan (= composantes UTC), et on respecte un
 * décalage quand le modèle en fournit un.
 */
function parseCaptureDate(raw: string): ParsedCaptureDate | null {
  const value = raw.trim();

  if (EXPLICIT_TZ_RE.test(value)) {
    const withTz = new Date(value);
    return Number.isNaN(withTz.getTime())
      ? null
      : { instant: withTz, hasTime: true };
  }

  if (ISO_DATE_ONLY_RE.test(value)) {
    const dayOnly = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(dayOnly.getTime())
      ? null
      : { instant: dayOnly, hasTime: false };
  }

  const m = ISO_DATE_TIME_RE.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] ? Number(m[6]) : 0;
  const wallClock = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second)
  );
  if (Number.isNaN(wallClock.getTime())) return null;
  // `Date.UTC` normalise silencieusement les valeurs hors bornes (le 45/13
  // devient une date de l'année suivante). Un aller-retour rejette ces
  // hallucinations plutôt que d'en tirer une comparaison qui a l'air valide.
  const roundTrips =
    wallClock.getUTCFullYear() === year &&
    wallClock.getUTCMonth() === month - 1 &&
    wallClock.getUTCDate() === day &&
    wallClock.getUTCHours() === hour &&
    wallClock.getUTCMinutes() === minute &&
    wallClock.getUTCSeconds() === second;
  return roundTrips ? { instant: wallClock, hasTime: true } : null;
}

/**
 * Compare la date de transaction extraite de la capture à la date de
 * création de la commande. `null` = pas de date exploitable côté capture
 * (rien à reprocher : la date n'est pas toujours visible/lisible). `false`
 * = capture visiblement ANTÉRIEURE à la commande — signe fort de
 * réutilisation d'un ancien paiement.
 *
 * Quand la capture ne porte qu'une date (sans heure), la comparaison se fait
 * au JOUR civil : sinon minuit passerait mécaniquement pour « antérieur » à
 * toute commande de la journée.
 */
export function isDateConsistent(
  transactionDateRaw: string | null,
  orderCreatedAt: Date
): boolean | null {
  if (!transactionDateRaw) return null;
  const parsed = parseCaptureDate(transactionDateRaw);
  if (!parsed) return null;

  if (!parsed.hasTime) {
    return (
      formatLocalDateOnly(parsed.instant) >= formatLocalDateOnly(orderCreatedAt)
    );
  }

  return (
    parsed.instant.getTime() >=
    orderCreatedAt.getTime() - CAPTURE_BEFORE_ORDER_TOLERANCE_MS
  );
}

/**
 * Ramène le montant lu sur la capture à sa valeur absolue. Un paiement vu
 * depuis l'application du CLIENT s'affiche en débit (« -9.000F ») : le signe
 * décrit le sens du flux sur SON compte, pas le montant reçu. Malgré la
 * consigne, un modèle recopie parfois le signe — on le neutralise ici plutôt
 * que de laisser un montant négatif échouer la comparaison au total.
 */
export function normalizeAmount(amount: number | null): number | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  return Math.abs(amount);
}

/** Opérateurs connus de `PaymentMode` ; tout le reste (Djamo, banque,
 * agrégateur, non identifié) tombe sur `OTHER`. */
export function operatorToPaymentMode(
  operator: Analysis['operator']
): PaymentMode {
  return operator === 'WAVE' || operator === 'ORANGE_MONEY'
    ? operator
    : 'OTHER';
}

export type VerdictInput = {
  analysis: Analysis;
  /** Montant déjà normalisé (valeur absolue), cf. `normalizeAmount`. */
  amount: number | null;
  orderTotal: number;
  /** Cf. `isDateConsistent` — `null` = pas de date exploitable. */
  dateConsistent: boolean | null;
};

export type VerdictResult = {
  verdict: PaymentProofVerdict;
  /** Le surpaiement est accepté (arrondi, erreur en faveur du commerce) —
   * seul un montant STRICTEMENT inférieur au total (ou illisible) est un
   * signal. Tracé séparément pour l'affichage caisse (« payé en trop »). */
  amountMatches: boolean;
  overpaid: boolean;
};

/**
 * Verdict de la capture. Ne bascule en MISMATCH que sur un signal POSITIF
 * d'anomalie : retouche matérielle, bénéficiaire manifestement autre,
 * transaction explicitement échouée/en attente, montant insuffisant ou
 * illisible, capture antérieure à la commande. Les valeurs `UNKNOWN` /
 * `null` (bénéficiaire non affiché, statut non affiché, date non lisible)
 * ne sont PAS pénalisées : ce sont des absences de signal, fréquentes d'une
 * application à l'autre — elles se contentent de retenir l'encaissement
 * automatique (cf. `blocksAutoValidation`).
 */
export function computeVerdict({
  analysis,
  amount,
  orderTotal,
  dateConsistent,
}: VerdictInput): VerdictResult {
  const amountMatches = amount !== null && amount >= orderTotal;
  const overpaid = amount !== null && amount > orderTotal;

  const verdict: PaymentProofVerdict = !analysis.readable
    ? 'UNREADABLE'
    : analysis.tamperingSuspected ||
        analysis.recipientMatch === 'MISMATCH' ||
        analysis.transactionStatus === 'FAILED_OR_PENDING' ||
        !amountMatches ||
        dateConsistent === false
      ? 'MISMATCH'
      : 'MATCH';

  return { verdict, amountMatches, overpaid };
}

/**
 * Raison de retenir l'encaissement automatique malgré un verdict MATCH, ou
 * `null` si rien ne s'y oppose. Un bénéficiaire non identifiable ne suffit
 * plus à refuser la capture (beaucoup d'applications ne l'affichent pas),
 * mais il suffit à demander un coup d'œil humain avant de poser un paiement.
 */
export function blocksAutoValidation(analysis: Analysis): string | null {
  if (analysis.recipientMatch === 'UNKNOWN') {
    return "Montant conforme, mais le bénéficiaire n'est pas identifiable sur la capture — à vérifier avant encaissement";
  }
  return null;
}
