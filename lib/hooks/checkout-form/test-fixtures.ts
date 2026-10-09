import type { CheckoutFormValues } from '../use-checkout-form';
import type { CartItem } from '@/lib/cart-store';

export const validValues: CheckoutFormValues = {
  customerName: 'Kofi Yao',
  customerPhone: '07001234',
  pickupMode: 'pickup',
  timing: 'scheduled',
  pickupTime: '2026-05-11T10:00:00.000Z',
  note: '',
  paymentMethod: null,
};

export const mockItems = [
  {
    cartId: 'abc',
    productId: 'prod-1',
    productName: 'Cappuccino',
    basePrice: 3500,
    quantity: 1,
    supplements: [],
  },
] as unknown as CartItem[];
