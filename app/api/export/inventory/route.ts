// app/api/export/inventory/route.ts
//
// Export Excel (.xlsx) des références d'inventaire valorisées.

import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import { listInventoryItems } from '@/lib/inventory';
import { buildInventoryWorkbook, xlsxResponse } from '@/lib/inventory-excel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !ROLE_GROUPS.KITCHEN_PLUS.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  const items = await listInventoryItems();
  return xlsxResponse('inventaire.xlsx', buildInventoryWorkbook(items));
}
