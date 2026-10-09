import { vi } from 'vitest';

// Reproduit lib/orders/mutations/errors.ts (champ `httpStatus`, StockShortageError toujours en 409).
export class OrderMutationError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
  }
}

export class StockShortageError extends OrderMutationError {
  constructor(message: string) {
    super(message, 409);
  }
}

export const orderMutationsModuleMock = () => ({
  setOrderPayment: vi.fn(),
  OrderMutationError,
  StockShortageError,
});
