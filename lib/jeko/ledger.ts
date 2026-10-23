// lib/jeko/ledger.ts
//
// Lecture/écriture du solde Jèko attendu : paiements en ligne encaissés (commandes)
// moins retraits enregistrés. Le calcul est dans ./accounting (pur).

import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  DEFAULT_JEKO_ACCOUNT,
  JEKO_ACCOUNTS,
  type JekoAccount,
} from './accounts';
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
  account: z.enum(JEKO_ACCOUNTS).default(DEFAULT_JEKO_ACCOUNT),
});

export async function recordJekoWithdrawal(input: unknown) {
  const { amount, note, account } = withdrawalSchema.parse(input);
  return prisma.jekoWithdrawal.create({
    data: {
      amount,
      fee: withdrawalFee(amount),
      note: note || null,
      jekoAccount: account,
    },
  });
}

export async function deleteJekoWithdrawal(id: string) {
  await prisma.jekoWithdrawal.delete({ where: { id } });
}

/** Solde d'UN compte Jèko : chaque compte a son propre argent et son propre plafond. */
export async function getJekoLedger(
  account: JekoAccount = DEFAULT_JEKO_ACCOUNT,
  now: Date = new Date()
) {
  // `paymentTransactionId` non nul = Jèko a réellement encaissé (même si la
  // commande a été annulée ensuite : l'argent est bien arrivé).
  const [orders, appRefunds, withdrawals] = await Promise.all([
    // staff-visibility: exempt — comptabilité de l'argent reçu, pas une file staff
    prisma.order.findMany({
      where: { paymentTransactionId: { not: null }, jekoAccount: account },
      select: {
        total: true,
        onlineFee: true,
        gatewayFee: true,
        paymentAmountDue: true,
        paidAt: true,
        refundAmount: true,
        refundFee: true,
        _count: { select: { refunds: true } },
      },
    }),
    // Remboursements de l'application envoyés par transfert Jèko (montant + frais).
    prisma.refund.aggregate({
      where: {
        delivery: 'JEKO_TRANSFER',
        order: { jekoAccount: account },
        status: { in: ['PAID', 'PROCESSING', 'UNCERTAIN'] },
      },
      _sum: { amount: true, feeFcfa: true },
    }),
    prisma.jekoWithdrawal.findMany({
      where: { jekoAccount: account },
      orderBy: { createdAt: 'desc' },
    }),
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
  // Mois civil en cours (Abidjan = UTC, pas d'heure d'été). `paidAt` est remis à
  // nul si la commande est dépayée : ce cumul peut alors être légèrement sous-estimé.
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthCollected = orders
    .filter((o) => o.paidAt && o.paidAt.getTime() >= monthStart)
    .reduce(
      (s, o) => s + (o.paymentAmountDue ?? o.total + (o.onlineFee ?? 0)),
      0
    );
  return {
    ...summary,
    monthCollected,
    withdrawals,
    withdrawnTotal: withdrawals.reduce((s, w) => s + w.amount, 0),
    withdrawalFeesTotal: withdrawals.reduce((s, w) => s + w.fee, 0),
    balance,
    maxWithdrawable: maxWithdrawable(Math.max(balance, 0)),
  };
}
