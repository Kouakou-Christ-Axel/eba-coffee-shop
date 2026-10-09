// Schémas Zod des commandes (messages en français). Implémentation dans `lib/schemas/order/`.

export { cartItemSupplementSchema, cartItemSchema } from './order/cart';
export type { CartItemSupplementInput, CartItemInput } from './order/cart';
export {
  orderStatusSchema,
  orderTypeSchema,
  paymentModeSchema,
} from './order/enums';
export type {
  OrderStatusInput,
  OrderTypeInput,
  PaymentModeInput,
} from './order/enums';
export {
  onlineCustomerNameSchema,
  onlineCustomerPhoneSchema,
  contactFieldsSchema,
} from './order/customer';
export type { ContactFieldsInput } from './order/customer';
export {
  createOrderSchema,
  isBackdateCompatibleWithPickup,
  BACKDATE_PICKUP_CONFLICT_MESSAGE,
} from './order/create';
export type { CreateOrderInput } from './order/create';
export {
  updateOrderSchema,
  updateOrderDetailsSchema,
  setOrderCustomerSchema,
  setOrderLoyaltyRewardSchema,
} from './order/update';
export type {
  UpdateOrderInput,
  UpdateOrderDetailsInput,
  SetOrderCustomerInput,
  SetOrderLoyaltyRewardInput,
} from './order/update';
export {
  orderDriverFieldsSchema,
  updateOrderFulfillmentSchema,
} from './order/fulfillment';
export type { UpdateOrderFulfillmentInput } from './order/fulfillment';
export { orderPaymentLineSchema, orderPaymentsSchema } from './order/payments';
export type { OrderPaymentLineInput } from './order/payments';
export {
  checkoutErrorCodeSchema,
  soldOutLineSchema,
} from './order/checkout-errors';
export type { CheckoutErrorCode, SoldOutLine } from './order/checkout-errors';
