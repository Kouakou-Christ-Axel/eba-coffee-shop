'use client';

import type { ReactNode } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import {
  Bike,
  Coffee,
  ShoppingBag,
  StickyNote,
  AlertTriangle,
  CalendarClock,
  Clock,
  Gift,
  Handshake,
  Phone,
  Receipt,
  PackageCheck,
  Globe,
  Bot,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import {
  ABIDJAN_TZ,
  formatAbidjanTime,
  formatLocalDateOnly,
} from '@/lib/timezone';
import type { CashierOrder } from '@/lib/cashier-queue';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { buildTelLink } from '@/lib/contact-links';
import type { OrderType } from '@/generated/prisma/client';
import {
  formatElapsedShort,
  formatPickup,
  isPickupOverdue,
  isScheduledAhead,
  URGENCY_STYLES,
  type UrgencyLevel,
} from './urgency';

const priceFormatter = new Intl.NumberFormat('fr-FR');

// « sam. 05/07 » — pour dater le n° du jour d'une commande d'un AUTRE jour
// (le #003 repart à 1 chaque matin : sans la date, deux jours se confondent).
const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ABIDJAN_TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const ORDER_TYPE_META: Record<OrderType, { label: string; Icon: typeof Bike }> =
  {
    DELIVERY: { label: 'Livraison', Icon: Bike },
    DINE_IN: { label: 'Sur place', Icon: Coffee },
    TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
  };

type PaymentBadge =
  | { kind: 'paid'; split: boolean; autoValidatedByAi: boolean }
  | { kind: 'unpaid' }
  | { kind: 'on-account' }
  | { kind: 'pay-after' }
  | { kind: 'pickup-unpaid' };

function getPaymentBadge(order: CashierOrder): PaymentBadge {
  // Payée sans mode unique résolu = paiement fractionné (2+ moyens distincts),
  // cf. lib/order-mutations.ts::resolvePaymentMode — le détail vit dans
  // `OrderPayment`, non exposé sur `CashierOrder`.
  if (order.isPaid) {
    return {
      kind: 'paid',
      split: order.paymentMode === null,
      autoValidatedByAi: order.paymentAutoValidatedByAi,
    };
  }
  // Ardoise : partie en cuisine sans encaissement, en toute connaissance de
  // cause. Prioritaire sur les badges d'alerte ci-dessous (« Récupérée · à
  // encaisser » en rouge) — ce n'est pas une anomalie, c'est le processus.
  // L'argent reste dû : il est suivi dans /dashboard/ardoise.
  if (order.isOnAccount) return { kind: 'on-account' };
  // Récupérée mais toujours pas encaissée : à signaler clairement.
  if (order.status === 'COMPLETED') return { kind: 'pickup-unpaid' };
  if (order.status === 'PREPARING' || order.status === 'READY') {
    return { kind: 'pay-after' };
  }
  return { kind: 'unpaid' };
}

// Origine de création : le cas courant CASHIER n'affiche rien (pas de bruit
// visuel sur la majorité des cartes) ; ONLINE/MCP se distinguent d'un coup
// d'œil, notamment pour repérer une saisie rétroactive (MCP).
const SOURCE_META: Partial<
  Record<CashierOrder['source'], { label: string; Icon: typeof Globe }>
> = {
  ONLINE: { label: 'En ligne', Icon: Globe },
  MCP: { label: 'MCP', Icon: Bot },
};

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

// `paymentProofAnalysis` est un JSON libre (lib/ai/payment-proof.ts) — lu ici
// en `unknown` défensif. `autoValidation.reason` explique POURQUOI un
// encaissement automatique n'a pas été posé (confiance insuffisante, échec
// technique) — non null uniquement quand `applied` est faux.
function autoValidationReason(analysis: unknown): string | undefined {
  if (!analysis || typeof analysis !== 'object') return undefined;
  const av = (analysis as Record<string, unknown>).autoValidation;
  if (!av || typeof av !== 'object') return undefined;
  const reason = (av as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : undefined;
}

// Tooltip informatif du badge de verdict. Les signaux les plus graves
// (retouche suspectée, capture antérieure à la commande, raison de la
// non-validation automatique) sont mis en avant en premier — le caissier
// voit l'essentiel sans ouvrir le détail.
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

type Props = {
  order: CashierOrder;
  urgency?: UrgencyLevel;
  now?: Date;
  actions?: ReactNode;
};

export function OrderCard({ order, urgency = 'normal', now, actions }: Props) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const payment = getPaymentBadge(order);
  const tickNow = now ?? new Date();
  const elapsed = formatElapsedShort(order.createdAt, tickNow);
  const overdue = isPickupOverdue(order, tickNow);
  const urgencyStyle = URGENCY_STYLES[urgency];
  const scheduledAhead = isScheduledAhead(order, tickNow);
  const pickupCode = getPickupCode(order.reference);
  // Minuteur « prête, en attente de récupération » : le client tarde souvent à
  // venir (« fait la star »). On repli sur createdAt pour les commandes prêtes
  // avant l'ajout de readyAt.
  const readySince =
    order.status === 'READY' ? (order.readyAt ?? order.createdAt) : null;
  const readyMinutes = readySince
    ? Math.max(0, differenceInMinutes(tickNow, readySince))
    : null;
  const readyLate =
    readyMinutes != null && readyMinutes >= READY_WAIT_ALERT_MINUTES;
  // Commande rattachée à un autre jour civil (ex. passée hier pour un retrait
  // aujourd'hui) : on date son n° pour éviter la collision avec le #003 du jour.
  const otherDay =
    formatLocalDateOnly(order.createdAt) !== formatLocalDateOnly(tickNow);
  const driverTelLink = buildTelLink(order.driverPhone);
  // Tant que le retrait est lointain (urgence « normal »), une bordure indigo dédiée
  // signale la commande programmée ; l'urgence de proximité reprend la main ensuite.
  const borderClass =
    scheduledAhead && urgency === 'normal'
      ? 'border-indigo-300 dark:border-indigo-800'
      : urgencyStyle.borderClass;

  return (
    <article
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-2xl border-2 bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        borderClass
      )}
    >
      {/* Ligne 1 : type icon + numéro + nom + badge paiement */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TypeIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-label={typeMeta.label}
          />
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-base font-semibold leading-tight">
              <span className="shrink-0 font-mono">
                #{String(order.dailyNumber).padStart(3, '0')}
                {otherDay && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {dayFormatter.format(order.createdAt)}
                  </span>
                )}
              </span>
              <span
                className="shrink-0 rounded bg-primary/10 px-1.5 font-mono text-sm text-primary"
                title={`Code de retrait · ${order.reference}`}
              >
                {pickupCode}
              </span>
              <span className="min-w-0 truncate">
                {order.customerName ?? 'Client anonyme'}
              </span>
              {/* Client de confiance : le caissier voit tout de suite POURQUOI
                  cette commande est partie en cuisine sans être payée. */}
              {order.customerTrusted && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                  title="Client de confiance — ardoise autorisée"
                >
                  <Handshake className="h-3 w-3" aria-hidden="true" />
                  Confiance
                </span>
              )}
              {SOURCE_META[order.source] && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title={
                    order.source === 'ONLINE'
                      ? 'Commande passée par le client sur le site'
                      : 'Commande saisie via l’outil MCP (rétroactive)'
                  }
                >
                  {(() => {
                    const { Icon, label } = SOURCE_META[order.source]!;
                    return (
                      <>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {label}
                      </>
                    );
                  })()}
                </span>
              )}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
              {order.customerPhone && (
                <>
                  <span className="text-muted-foreground">
                    {order.customerPhone}
                  </span>
                  <span className="text-muted-foreground">·</span>
                </>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 tabular-nums',
                  urgencyStyle.textClass
                )}
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                {elapsed}
              </span>
              {order.pickupTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  Planifiée · {formatPickup(order.pickupTime, tickNow)}
                </span>
              )}
            </p>
          </div>
        </div>
        <PaymentBadgePill payment={payment} />
      </header>

      {/* Prête, en attente de récupération : minuteur « prête depuis X ».
          Rouge quand le client tarde (fait la star), vert sinon. */}
      {readyMinutes != null && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1',
            readyLate
              ? 'bg-red-100 text-red-900 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800'
              : 'bg-green-100 text-green-900 ring-green-300 dark:bg-green-950/40 dark:text-green-100 dark:ring-green-800'
          )}
        >
          <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Prête depuis {readyMinutes} min — en attente de récupération
            {readyLate && ' · relancer le client'}
          </span>
        </div>
      )}

      {/* Override pickupTime dépassé */}
      {overdue && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Créneau de retrait dépassé
            {order.pickupTime && <> ({formatAbidjanTime(order.pickupTime)})</>}
          </span>
        </div>
      )}

      {/* Signal cuisine "demander livreur" */}
      {order.driverRequested && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
          <AlertTriangle
            className="h-4 w-4 shrink-0 animate-pulse"
            aria-hidden="true"
          />
          <span>La cuisine demande d&apos;appeler le livreur</span>
        </div>
      )}

      {/* Livreur annoncé par le client (page de suivi) */}
      {(order.driverName || order.driverPhone) && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-800">
          <Bike className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            Livreur&nbsp;: {order.driverName ?? 'sans nom'}
          </span>
          {order.driverPhone &&
            (driverTelLink ? (
              <a
                href={driverTelLink}
                className="ml-auto inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
              >
                <Phone className="h-3 w-3" aria-hidden="true" />
                {order.driverPhone}
              </a>
            ) : (
              <span className="ml-auto shrink-0">{order.driverPhone}</span>
            ))}
        </div>
      )}

      {/* Preuve de paiement envoyée par le client. Reste visible même après un
          encaissement AUTOMATIQUE (IA) — le caissier peut vouloir consulter
          l'image avant de décider de garder ou d'annuler cet encaissement. */}
      {order.paymentProofUrl &&
        (!order.isPaid || order.paymentAutoValidatedByAi) && (
          <a
            href={order.paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 ring-1 ring-emerald-300 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800"
          >
            <Receipt className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Preuve de paiement Wave reçue — appuyer pour vérifier</span>
          </a>
        )}

      {/* Verdict de la pré-analyse IA de la preuve — cliquer pour le détail
          complet (raisonnement IA). Reste affiché après un encaissement
          automatique (contexte pour la décision d'annuler ou non),
          disparaît une fois la commande validée manuellement. */}
      {order.paymentProofUrl &&
        (!order.isPaid || order.paymentAutoValidatedByAi) &&
        order.paymentProofVerdict && (
          <PaymentProofVerdictBadge
            verdict={order.paymentProofVerdict}
            analysis={order.paymentProofAnalysis}
            isPaid={order.isPaid}
          />
        )}

      {/* Note client */}
      {order.note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-amber-500 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{order.note}</span>
        </div>
      )}

      {/* Détail des articles (avec options choisies) + total */}
      <div className="mt-3 text-sm">
        <ul className="space-y-1.5">
          {order.items.map((item) => {
            const gross = getItemGross(item);
            const net = getItemNet(item);
            const discounted = gross !== net;
            return (
              <li key={item.cartId} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-foreground">
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 px-1.5 text-sm font-bold tabular-nums text-primary">
                      {item.quantity}×
                    </span>
                    <span className="font-medium">{item.productName}</span>
                    {item.addedLater && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Ajout
                      </span>
                    )}
                  </span>
                  {item.supplements.length > 0 && (
                    <div className="pl-8">
                      {item.supplements.map((s) => (
                        <span
                          key={`${s.groupName}:${s.optionName}`}
                          className="block text-xs text-muted-foreground"
                        >
                          + {formatSupplementLabel(s)}
                        </span>
                      ))}
                    </div>
                  )}
                  {discounted && (
                    <span className="block pl-8 text-xs font-medium text-green-700 dark:text-green-400">
                      Remise -{priceFormatter.format(gross - net)} F
                      {item.discountReason ? ` (${item.discountReason})` : ''}
                    </span>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">
                  {discounted && (
                    <span className="mr-1 text-xs text-muted-foreground line-through">
                      {priceFormatter.format(gross)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {priceFormatter.format(net)} F
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {/* Récompense fidélité utilisée sur cette commande : mention dédiée,
            distincte des remises par article, pour que la caisse (et le
            récap envoyé au client) explique toujours l'origine de la
            réduction. */}
        {order.loyaltyDiscount != null && order.loyaltyDiscount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-800">
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Récompense fidélité appliquée
            </span>
            <span className="shrink-0 tabular-nums">
              -{priceFormatter.format(order.loyaltyDiscount)} F
            </span>
          </div>
        )}
        <p className="mt-2 border-t pt-2 text-right font-semibold tabular-nums">
          {priceFormatter.format(order.total)} F
        </p>
      </div>

      {/* Lien de suivi de la commande, accessible directement (partage client /
          livreur). Masqué une fois la commande terminée ou annulée. */}
      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <TrackingLinkButton orderId={order.id} className="mt-3" />
      )}

      {/* Slot actions */}
      {actions && <div className="mt-3">{actions}</div>}
    </article>
  );
}

/**
 * Badge de verdict IA de la preuve de paiement — CLIQUABLE (Popover HeroUI,
 * même motif que `restock-control.tsx`/`line-discount-control.tsx`) plutôt
 * qu'un simple tooltip au survol, pour rester utilisable sur écran tactile
 * (tablette caisse). Le `title` de secours reste posé pour le clavier/lecteur
 * d'écran.
 */
function PaymentProofVerdictBadge({
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
  // Conforme selon l'IA mais PAS encaissée automatiquement : le caissier
  // doit comprendre pourquoi avant de valider lui-même (confiance
  // insuffisante, encaissement auto échoué...) — affiché en clair, sans
  // attendre le clic.
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
      {typeof a.recipientName === 'string' && a.recipientName && (
        <p>Bénéficiaire : {a.recipientName}</p>
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

function PaymentBadgePill({ payment }: { payment: PaymentBadge }) {
  const config = {
    paid: {
      label: 'Payée',
      className:
        'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
    },
    unpaid: {
      label: 'Non payé',
      className:
        'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    },
    'on-account': {
      label: 'Ardoise',
      className:
        'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
    },
    'pay-after': {
      label: 'À encaisser après',
      className:
        'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
    },
    'pickup-unpaid': {
      label: 'Récupérée · à encaisser',
      className:
        'bg-red-100 text-red-900 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-100 dark:ring-red-800',
    },
  }[payment.kind];

  const label =
    payment.kind === 'paid' && payment.split
      ? 'Payée · fractionné'
      : config.label;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className
      )}
    >
      {label}
      {/* Encaissement posé automatiquement par l'IA (verdict MATCH) — pas un
          geste caisse. Le bouton d'annulation dédié est dans les actions. */}
      {payment.kind === 'paid' && payment.autoValidatedByAi && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-white/60 px-1 py-0.5 text-[10px] font-semibold dark:bg-black/20"
          title="Encaissement validé automatiquement par l’IA"
        >
          <Bot className="h-2.5 w-2.5" aria-hidden="true" />
          IA
        </span>
      )}
    </span>
  );
}
