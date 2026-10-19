// lib/jeko/ledger.ts
//
// Lecture/écriture du solde Jèko attendu : paiements en ligne encaissés (commandes)
// moins retraits enregistrés. Le calcul est dans ./accounting (pur).

import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  jekoBalance,
  withAppRefunds,
  maxWithdrawable,
  summarizeOnlinePayments,
  withdrawalFee,
} from './accounting';

const withdrawalSchema = z.object({
  amount: z.number().int().positive().max(100_000_000),
  note: z.string().trim().max(200).optional(),
});

export async function recordJekoWithdrawal(input: unknown) {
  const { amount, note } = withdrawalSchema.parse(input);
  return prisma.jekoWithdrawal.create({
    data: { amount, fee: withdrawalFee(amount), note: note || null },
  });
}

export async function deleteJekoWithdrawal(id: string) {
  await prisma.jekoWithdrawal.delete({ where: { id } });
}

export async function getJekoLedger() {
  // `paymentTransactionId` non nul = Jèko a réellement encaissé (même si la
  // commande a été annulée ensuite : l'argent est bien arrivé).
  const [orders, appRefunds, withdrawals] = await Promise.all([
    // staff-visibility: exempt — comptabilité de l'argent reçu, pas une file staff
    prisma.order.findMany({
      where: { paymentTransactionId: { not: null } },
      select: {
        total: true,
        onlineFee: true,
        gatewayFee: true,
        paymentAmountDue: true,
        refundAmount: true,
        refundFee: true,
        _count: { select: { refunds: true } },
      },
    }),
    // Remboursements de l'application envoyés par transfert Jèko (montant + frais).
    prisma.refund.aggregate({
      where: {
        delivery: 'JEKO_TRANSFER',
        status: { in: ['PAID', 'PROCESSING', 'UNCERTAIN'] },
      },
      _sum: { amount: true, feeFcfa: true },
    }),
    prisma.jekoWithdrawal.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  // Une commande qui porte des lignes `Refund` est comptée par celles-ci : on
  // ignore ses anciennes colonnes `refund*` (sinon le remboursement serait déduit
  // deux fois). Les commandes antérieures, sans ligne, restent comptées comme avant.
  const summary = withAppRefunds(
    summarizeOnlinePayments(
      orders.map(({ _count, ...o }) =>
        _count.refunds > 0 ? { ...o, refundAmount: null, refundFee: null } : o
      )
    ),
    (appRefunds._sum.amount ?? 0) + (appRefunds._sum.feeFcfa ?? 0)
  );
  const balance = jekoBalance(summary.netReceived, withdrawals);
  return {
    ...summary,
    withdrawals,
    withdrawnTotal: withdrawals.reduce((s, w) => s + w.amount, 0),
    withdrawalFeesTotal: withdrawals.reduce((s, w) => s + w.fee, 0),
    balance,
    maxWithdrawable: maxWithdrawable(Math.max(balance, 0)),
  };
}
