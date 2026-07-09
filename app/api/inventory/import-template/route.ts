// app/api/inventory/import-template/route.ts
//
// Téléchargement du modèle Excel (.xlsx) d'import inventaire (3 feuilles + aide).

import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import {
  buildImportTemplateWorkbook,
  xlsxResponse,
} from '@/lib/inventory-excel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !ROLE_GROUPS.KITCHEN_PLUS.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  return xlsxResponse('modele-inventaire.xlsx', buildImportTemplateWorkbook());
}
