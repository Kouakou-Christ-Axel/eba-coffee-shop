// lib/refunds/transitions.ts
//
// Cycle de vie d'un remboursement. Chaque transition passe par `transitionRefund`
// (garde sur le statut + journal) : idempotent et sans course.
//
//   REQUESTED ─approve→ APPROVED ─(Jèko)→ PROCESSING → PAID | FAILED | UNCERTAIN
//        ↑                  │(MANUAL)→ PAID (remise en main propre)
//        └── updateDestination ← APPROVED / FAILED
//   reject : REQUESTED | APPROVED | FAILED     cancel : idem, par le demandeur

import prisma from '@/lib/prisma';
import type { Refund } from '@/generated/prisma/client';
import {
  REFUND_APPROVER_ROLES,
  REFUND_REQUEST_ROLES,
} from '@/config/constants';
import {
  refundNoteSchema,
  resolveUncertainSchema,
  updateRefundDestinationSchema,
} from '@/lib/schemas/refund';
import { resolveChannel, resolveDestination } from './destination';
import { RefundError, type RefundActor } from './errors';
import { transitionRefund } from './events';
import { settleRefundPaid } from './on-paid';
import { sendRefundViaJeko, type SendOutcome } from './send-jeko';

function requireApprover(actor: RefundActor): void {
  if (!REFUND_APPROVER_ROLES.includes(actor.role)) {
    throw new RefundError('Réservé à un administrateur', 403);
  }
}

function requireRequester(actor: RefundActor): void {
  if (!REFUND_REQUEST_ROLES.includes(actor.role)) {
    throw new RefundError('Non autorisé', 403);
  }
}

async function get(id: string): Promise<Refund> {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) throw new RefundError('Remboursement introuvable', 404);
  return refund;
}

function stateConflict(): never {
  throw new RefundError(
    'Ce remboursement a changé entre-temps, rechargez la page',
    409
  );
}

/** Valide la demande et, pour un transfert Jèko, l'envoie aussitôt. */
export async function approveRefund(
  rawId: string,
  actor: RefundActor
): Promise<{ refund: Refund; sent: SendOutcome | null }> {
  requireApprover(actor);
  const refund = await get(rawId);
  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id: refund.id,
      from: ['REQUESTED'],
      to: 'APPROVED',
      actorId: actor.id,
      data: { approvedById: actor.id, approvedAt: new Date() },
    })
  );
  if (!moved) return stateConflict();
  // Un avoir n'a rien à envoyer : la validation l'inscrit aussitôt au solde.
  if (refund.delivery === 'STORE_CREDIT') {
    await settleRefundPaid({
      id: refund.id,
      from: ['APPROVED'],
      actorId: actor.id,
      note: 'Avoir crédité',
    });
    return { refund: await get(refund.id), sent: null };
  }
  const sent =
    refund.delivery === 'JEKO_TRANSFER'
      ? await sendRefundViaJeko(refund.id)
      : null;
  return { refund: await get(refund.id), sent };
}

/** Relance après un échec, sans rien changer (solde rechargé, config corrigée…). */
export async function retryRefund(
  rawId: string,
  actor: RefundActor
): Promise<{ refund: Refund; sent: SendOutcome | null }> {
  requireApprover(actor);
  const refund = await get(rawId);
  if (refund.delivery !== 'JEKO_TRANSFER') {
    throw new RefundError('Seul un transfert Jèko peut être renvoyé');
  }
  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id: refund.id,
      from: ['FAILED'],
      to: 'APPROVED',
      actorId: actor.id,
      note: 'Nouvel essai',
      data: {
        approvedById: actor.id,
        approvedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    })
  );
  if (!moved) return stateConflict();
  const sent = await sendRefundViaJeko(refund.id);
  return { refund: await get(refund.id), sent };
}

export async function rejectRefund(
  rawInput: unknown,
  actor: RefundActor
): Promise<Refund> {
  requireApprover(actor);
  const { id, note } = refundNoteSchema.parse(rawInput);
  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id,
      from: ['REQUESTED', 'APPROVED', 'FAILED'],
      to: 'REJECTED',
      actorId: actor.id,
      note,
    })
  );
  if (!moved) return stateConflict();
  return get(id);
}

/** Annulation par le demandeur (ou un admin) avant que l'argent ne parte. */
export async function cancelRefund(
  rawInput: unknown,
  actor: RefundActor
): Promise<Refund> {
  requireRequester(actor);
  const { id, note } = refundNoteSchema.parse(rawInput);
  const refund = await get(id);
  if (
    refund.requestedById !== actor.id &&
    !REFUND_APPROVER_ROLES.includes(actor.role)
  ) {
    throw new RefundError('Seul le demandeur ou un admin peut annuler', 403);
  }
  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id,
      from: ['REQUESTED', 'APPROVED', 'FAILED'],
      to: 'CANCELLED',
      actorId: actor.id,
      note,
    })
  );
  if (!moved) return stateConflict();
  return get(id);
}

/**
 * Corrige canal, mode d'envoi ou numéro (échec dû à un mauvais numéro, au mauvais
 * moyen…). Toute correction repasse en « Demandé » : un admin revalide avant que
 * l'argent ne parte.
 */
export async function updateRefundDestination(
  rawInput: unknown,
  actor: RefundActor
): Promise<Refund> {
  requireRequester(actor);
  const input = updateRefundDestinationSchema.parse(rawInput);
  const refund = await get(input.id);

  const delivery = input.delivery ?? refund.delivery;
  const channel = resolveChannel(
    delivery,
    input.channel ?? (refund.channel === 'AVOIR' ? 'CASH' : refund.channel)
  );
  const destinationPhone = resolveDestination({
    delivery,
    channel,
    phone: input.destinationPhone ?? refund.destinationPhone,
  });

  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id: refund.id,
      from: ['REQUESTED', 'APPROVED', 'FAILED'],
      to: 'REQUESTED',
      actorId: actor.id,
      note: input.note || 'Destination corrigée, à revalider',
      data: {
        channel,
        delivery,
        destinationPhone,
        approvedById: null,
        approvedAt: null,
        failureCode: null,
        failureMessage: null,
      },
    })
  );
  if (!moved) return stateConflict();
  return get(refund.id);
}

/**
 * L'argent est parti hors de l'application. Remise en main propre d'un
 * remboursement `MANUAL` approuvé : toute la caisse. Régler à la main un échec
 * Jèko (fait depuis le Dashboard Jèko) : admin seulement.
 */
export async function markRefundPaidManually(
  rawInput: unknown,
  actor: RefundActor
): Promise<Refund> {
  const { id, note } = refundNoteSchema.parse(rawInput);
  const refund = await get(id);
  const handedOver =
    refund.delivery === 'MANUAL' && refund.status === 'APPROVED';
  if (handedOver) requireRequester(actor);
  else requireApprover(actor);

  const ok = await settleRefundPaid({
    id,
    from: handedOver ? ['APPROVED'] : ['FAILED', 'UNCERTAIN'],
    actorId: actor.id,
    note: note || (handedOver ? 'Remis au client' : 'Réglé hors application'),
  });
  if (!ok) return stateConflict();
  return get(id);
}

/** Un transfert « à vérifier » : l'admin a regardé chez Jèko et tranche. */
export async function resolveUncertainRefund(
  rawInput: unknown,
  actor: RefundActor
): Promise<Refund> {
  requireApprover(actor);
  const { id, outcome, note } = resolveUncertainSchema.parse(rawInput);
  if (outcome === 'SENT') {
    const ok = await settleRefundPaid({
      id,
      from: ['UNCERTAIN'],
      actorId: actor.id,
      note: note || 'Vérifié chez Jèko : envoyé',
    });
    if (!ok) return stateConflict();
    return get(id);
  }
  const moved = await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id,
      from: ['UNCERTAIN'],
      to: 'FAILED',
      actorId: actor.id,
      note: note || 'Vérifié chez Jèko : non envoyé',
      data: { failureCode: 'not_sent', failureMessage: null },
    })
  );
  if (!moved) return stateConflict();
  return get(id);
}
