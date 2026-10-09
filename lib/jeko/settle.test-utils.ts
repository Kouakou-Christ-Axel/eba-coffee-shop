import { vi } from 'vitest';
import prisma from '@/lib/prisma';
import { setOrderPayment } from '@/lib/order-mutations';
import { sendPushToRoles } from '@/lib/push-notify';
import { announcePaidOrder } from './notify-paid';
import type { JekoTransaction } from './webhook-payload';

export const findOrder = vi.mocked(prisma.order.findUnique);
export const updateOrder = vi.mocked(prisma.order.updateMany);
export const pay = vi.mocked(setOrderPayment);
export const push = vi.mocked(sendPushToRoles);
export const announce = vi.mocked(announcePaidOrder);

export const order = {
  id: 'o1',
  isPaid: false,
  status: 'NEW',
  total: 3450,
  onlineFee: 35,
  dailyNumber: 12,
  paymentAmountDue: 3485,
  paymentTransactionId: null as string | null,
};

export const tx: JekoTransaction = {
  transactionId: 'txn_1',
  status: 'success',
  amountFcfa: 3485, // total 3 450 + frais 35
  gatewayFeeFcfa: 52.28,
  paymentMethod: 'wave',
  reference: 'EBA-20261003-AB12-1',
  paymentRequestId: 'pr_1',
};

// Transaction et frais partent AVEC isPaid (une seule écriture, setOrderPayment).
export const online = {
  gatewayFee: 52,
  paymentRequestId: 'pr_1',
  paymentTransactionId: 'txn_1',
};

export function setupSettleMocks() {
  vi.resetAllMocks();
  push.mockResolvedValue(undefined as never);
  announce.mockResolvedValue(undefined);
  findOrder.mockResolvedValue(order as never);
  updateOrder.mockResolvedValue({ count: 1 } as never);
  pay.mockResolvedValue({ startedPreparation: true });
}
