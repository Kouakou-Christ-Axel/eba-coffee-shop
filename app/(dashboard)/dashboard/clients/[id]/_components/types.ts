import type { getCustomer } from '@/lib/customers';
import type { getLoyaltyCard } from '@/lib/loyalty';

export type CustomerData = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;
export type LoyaltyCard = Awaited<ReturnType<typeof getLoyaltyCard>>;
