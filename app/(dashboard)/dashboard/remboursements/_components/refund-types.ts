// Formes sérialisables passées du serveur aux composants client (dates en ISO).

import type {
  PaymentMode,
  RefundReason,
  RefundStatus,
} from '@/generated/prisma/client';

export type RefundRowData = {
  id: string;
  orderId: string;
  orderRef: string;
  dailyNumber: number;
  amount: number;
  reason: RefundReason;
  source: 'STAFF' | 'AUTO_LATE';
  status: RefundStatus;
  delivery: 'JEKO_TRANSFER' | 'MANUAL';
  channel: PaymentMode;
  customerName: string | null;
  createdAt: string;
  requestedBy: string | null;
  requestedById: string | null;
};

export type RefundDetailData = RefundRowData & {
  note: string | null;
  phone: string | null; // masqué pour les rôles en lecture seule
  failureCode: string | null;
  failureMessage: string | null;
  restockItems: boolean;
  stockRestoredAt: string | null;
  feeFcfa: number;
  attempt: number;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  payoutDate: string | null;
  orderTotal: number;
  lines: {
    id: string;
    name: string;
    kind: 'PRODUCT' | 'SUPPLEMENT';
    quantity: number;
    amount: number;
  }[];
  events: {
    id: string;
    from: RefundStatus | null;
    to: RefundStatus;
    actor: string | null;
    note: string | null;
    at: string;
  }[];
};

/** Droits de l'utilisateur courant, calculés côté serveur. */
export type RefundViewer = {
  canRequest: boolean;
  canApprove: boolean;
  userId: string;
};
