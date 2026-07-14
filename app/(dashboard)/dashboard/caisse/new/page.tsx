import { requireCashier } from '@/lib/auth-helpers';
import { getMenu } from '@/lib/menu';
import { NewOrderView } from './new-order-view';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const [, menu] = await Promise.all([requireCashier(), getMenu()]);

  return <NewOrderView menu={menu} />;
}
