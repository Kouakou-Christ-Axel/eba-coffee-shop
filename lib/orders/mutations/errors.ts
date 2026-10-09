// Mutations de commandes — errors.

export class OrderMutationError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = 'OrderMutationError';
  }
}

export class StockShortageError extends OrderMutationError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'StockShortageError';
  }
}
