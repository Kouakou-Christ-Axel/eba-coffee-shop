// app/api/inventory/import/route.ts
//
// Import Excel (.xlsx) de l'inventaire : références (catalogue), comptage ou
// achats (réappro). Le mode est passé en multipart. La (dé)sérialisation vit
// dans lib/inventory-excel.ts ; la résolution SKU et les écritures dans
// lib/inventory-import.ts + lib/inventory-mutations.ts.

import { NextResponse } from 'next/server';
import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import { inventoryImportModeSchema } from '@/lib/schemas/inventory';
import { parseImportWorkbook } from '@/lib/inventory-excel';
import { bulkUpsertInventoryItems } from '@/lib/inventory-mutations';
import {
  importInventoryCount,
  importInventoryPurchases,
} from '@/lib/inventory-import';
import { todayDateString } from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function str(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session || !ROLE_GROUPS.KITCHEN_PLUS.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  try {
    const form = await req.formData();

    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    const mode = inventoryImportModeSchema.parse(form.get('mode'));
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseImportWorkbook(buffer, mode);

    if (mode === 'references') {
      const result = await bulkUpsertInventoryItems(
        rows as unknown[],
        session.user.id
      );
      return NextResponse.json(result);
    }

    if (mode === 'count') {
      const meta = {
        date: str(form.get('date')) ?? todayDateString(),
        label: str(form.get('label')) ?? null,
        note: str(form.get('note')) ?? null,
      };
      const result = await importInventoryCount(
        rows as { sku?: string; countedQuantity?: unknown }[],
        meta,
        session.user.id
      );
      return NextResponse.json(result);
    }

    // purchases
    const meta = {
      date: str(form.get('date')) ?? todayDateString(),
      supplier: str(form.get('supplier')) ?? null,
      note: str(form.get('note')) ?? null,
      createExpense: form.get('createExpense') === 'true',
      expenseCategoryId: str(form.get('expenseCategoryId')) ?? null,
      paymentMethod: str(form.get('paymentMethod')) as
        | 'CASH'
        | 'WAVE'
        | 'BANK'
        | 'OTHER'
        | undefined,
    };
    const result = await importInventoryPurchases(
      rows as { sku?: string; quantity?: unknown; unitCost?: unknown }[],
      meta,
      session.user.id
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import impossible';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
