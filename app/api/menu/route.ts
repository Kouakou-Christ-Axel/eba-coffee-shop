import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menu';

// Relu toutes les 30 s par la carte publique (lib/hooks/use-public-menu.ts) :
// 15 s côté serveur pour que ce polling ne reçoive jamais un menu vieux d'une
// minute. Les écritures de stock appellent en plus `revalidatePublicMenu`.
export const revalidate = 15;

export async function GET() {
  try {
    const menu = await getMenu();
    return NextResponse.json(menu);
  } catch (err) {
    console.error('[GET /api/menu]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
