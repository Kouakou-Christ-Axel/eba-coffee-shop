// lib/refunds/errors.ts

/** Refus métier d'une opération de remboursement (statut HTTP suggéré inclus). */
export class RefundError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = 'RefundError';
  }
}

export type RefundActor = {
  id: string;
  role: import('@/generated/prisma/client').UserRole;
};
