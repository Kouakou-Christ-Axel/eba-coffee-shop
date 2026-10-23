// lib/credits/errors.ts

/** Refus métier sur un avoir (statut HTTP suggéré inclus). */
export class CreditError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = 'CreditError';
  }
}
