'use client';

import {
  Bike,
  StickyNote,
  AlertTriangle,
  Clock,
  Phone,
  Receipt,
  PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAbidjanTime } from '@/lib/timezone';
import { type CashierOrder } from '@/lib/cashier-queue';
import { formatElapsedShort } from '../../urgency';
import { PaymentProofVerdictBadge } from './payment-proof';

export function OrderCardAlerts({
  order,
  readyMinutes,
  readyLate,
  overdue,
  driverTelLink,
  now,
}: {
  order: CashierOrder;
  readyMinutes: number | null;
  readyLate: boolean;
  overdue: boolean;
  driverTelLink: string | null | undefined;
  now: Date;
}) {
  return (
    <>
      {/* Prête, en attente de récupération : rouge quand le client tarde, vert sinon. */}
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

      {/* Livreur demandé (cuisine ou caisse) */}
      {order.driverRequested && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
          <AlertTriangle
            className="h-4 w-4 shrink-0 animate-pulse"
            aria-hidden="true"
          />
          <span>
            Livreur demandé
            {order.driverRequestedAt &&
              ` ${formatElapsedShort(order.driverRequestedAt, now)}`}
          </span>
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

      {/* Preuve de paiement : reste visible après un encaissement automatique (le caissier peut vouloir la consulter). */}
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

      {/* Verdict IA de la preuve : détail au clic ; disparaît une fois la commande validée manuellement. */}
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
    </>
  );
}
