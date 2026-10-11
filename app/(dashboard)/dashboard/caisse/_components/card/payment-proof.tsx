'use client';

import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { priceFormatter } from './format';
import { cn } from '@/lib/utils';
import { type CashierOrder } from '@/lib/cashier-queue';

const VERDICT_META: Record<
  NonNullable<CashierOrder['paymentProofVerdict']>,
  { label: string; Icon: typeof ShieldCheck; className: string }
> = {
  MATCH: {
    label: 'IA : montant conforme',
    Icon: ShieldCheck,
    className:
      'bg-green-100 text-green-900 ring-green-300 dark:bg-green-950/40 dark:text-green-100 dark:ring-green-800',
  },
  MISMATCH: {
    label: 'IA : à vérifier',
    Icon: ShieldAlert,
    className:
      'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800',
  },
  UNREADABLE: {
    label: 'IA : capture illisible',
    Icon: ShieldQuestion,
    className:
      'bg-muted text-muted-foreground ring-border dark:bg-muted dark:text-muted-foreground',
  },
  PENDING: {
    label: 'IA : analyse indisponible',
    Icon: ShieldQuestion,
    className:
      'bg-muted text-muted-foreground ring-border dark:bg-muted dark:text-muted-foreground',
  },
};

// Libellés pour relire l'historique des commandes portant une capture (l'ancienne pré-analyse IA n'existe plus).
const PAYMENT_APP_LABELS: Record<string, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  DJAMO: 'Djamo',
  BANK: 'Application bancaire',
  OTHER: 'Autre application',
};

// `paymentProofAnalysis` : JSON libre de l'ancienne pré-analyse IA, lu en `unknown`. `autoValidation.reason` explique
// pourquoi un encaissement automatique n'a pas été posé.
function autoValidationReason(analysis: unknown): string | undefined {
  if (!analysis || typeof analysis !== 'object') return undefined;
  const av = (analysis as Record<string, unknown>).autoValidation;
  if (!av || typeof av !== 'object') return undefined;
  const reason = (av as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : undefined;
}

// Tooltip du badge de verdict : signaux graves en premier (retouche, capture antérieure, raison de non-validation).
function paymentProofAnalysisSummary(analysis: unknown): string | undefined {
  if (!analysis || typeof analysis !== 'object') return undefined;
  const a = analysis as Record<string, unknown>;
  if (typeof a.error === 'string') return a.error;

  const parts: string[] = [];
  const autoReason = autoValidationReason(analysis);
  if (autoReason) parts.push(`ℹ ${autoReason}`);
  if (a.tamperingSuspected === true) {
    parts.push(
      `⚠ Retouche suspectée${typeof a.tamperingReasons === 'string' && a.tamperingReasons ? ` : ${a.tamperingReasons}` : ''}`
    );
  }
  if (a.dateConsistent === false) {
    parts.push('⚠ Capture antérieure à la commande (paiement recyclé ?)');
  }
  if (typeof a.amount === 'number') parts.push(`${a.amount} FCFA`);
  if (typeof a.recipientName === 'string' && a.recipientName) {
    parts.push(`Bénéficiaire : ${a.recipientName}`);
  }
  if (typeof a.reasoning === 'string') parts.push(a.reasoning);
  return parts.length > 0 ? parts.join(' — ') : undefined;
}

/** Badge de verdict IA de la preuve : cliquable (Popover) pour rester utilisable au tactile. */
export function PaymentProofVerdictBadge({
  verdict,
  analysis,
  isPaid,
}: {
  verdict: NonNullable<CashierOrder['paymentProofVerdict']>;
  analysis: unknown;
  isPaid: boolean;
}) {
  const { Icon, label, className } = VERDICT_META[verdict];
  const summary = paymentProofAnalysisSummary(analysis);
  // Conforme mais non encaissée automatiquement : la raison s'affiche sans attendre le clic.
  const autoReason =
    !isPaid && verdict === 'MATCH' ? autoValidationReason(analysis) : undefined;

  return (
    <Popover placement="bottom-start" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          title={summary}
          className={cn(
            'mt-2 flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium ring-1 transition-opacity hover:opacity-90',
            className
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </span>
            {autoReason && (
              <span className="pl-6 text-[11px] font-normal opacity-90">
                {autoReason}
              </span>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <PaymentProofAnalysisDetail analysis={analysis} />
      </PopoverContent>
    </Popover>
  );
}

/** Détail structuré de l'analyse IA, affiché dans le popover au clic. */
function PaymentProofAnalysisDetail({ analysis }: { analysis: unknown }) {
  if (!analysis || typeof analysis !== 'object') {
    return <p className="p-2 text-xs text-muted-foreground">Aucun détail.</p>;
  }
  const a = analysis as Record<string, unknown>;
  if (typeof a.error === 'string') {
    return <p className="p-2 text-xs text-muted-foreground">{a.error}</p>;
  }

  const autoReason = autoValidationReason(analysis);

  return (
    <div className="w-full space-y-2 p-2 text-xs">
      <p className="font-semibold">Analyse IA de la preuve</p>
      {typeof a.reasoning === 'string' && a.reasoning && (
        <p className="text-foreground/80">{a.reasoning}</p>
      )}
      {a.tamperingSuspected === true && (
        <p className="text-amber-700 dark:text-amber-400">
          ⚠ Retouche suspectée
          {typeof a.tamperingReasons === 'string' && a.tamperingReasons
            ? ` — ${a.tamperingReasons}`
            : ''}
        </p>
      )}
      {a.dateConsistent === false && (
        <p className="text-amber-700 dark:text-amber-400">
          ⚠ Capture antérieure à la commande (paiement recyclé ?)
          {typeof a.transactionDate === 'string' && a.transactionDate
            ? ` — capture datée du ${a.transactionDate}`
            : ''}
        </p>
      )}
      {typeof a.amount === 'number' && (
        <p>
          Montant détecté : {priceFormatter.format(a.amount)} F
          {typeof a.expectedTotal === 'number' &&
            ` (attendu ${priceFormatter.format(a.expectedTotal)} F)`}
          {a.overpaid === true && ' — payé en trop'}
        </p>
      )}
      {typeof a.operator === 'string' && a.operator !== 'UNKNOWN' && (
        <p>
          Application : {PAYMENT_APP_LABELS[a.operator] ?? 'Autre application'}
        </p>
      )}
      {typeof a.recipientName === 'string' && a.recipientName ? (
        <p>Bénéficiaire : {a.recipientName}</p>
      ) : (
        a.recipientMatch === 'UNKNOWN' && (
          <p className="text-foreground/60">
            Bénéficiaire non affiché par l&apos;application
          </p>
        )
      )}
      {typeof a.reference === 'string' && a.reference && (
        <p>Référence : {a.reference}</p>
      )}
      {typeof a.confidence === 'number' && (
        <p className="text-foreground/60">
          Confiance : {Math.round(a.confidence * 100)}%
        </p>
      )}
      {autoReason && (
        <p className="border-t pt-2 text-foreground/80">ℹ {autoReason}</p>
      )}
    </div>
  );
}
