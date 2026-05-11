import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/menu';

export const revalidate = 60;

export async function GET() {
  try {
    const menu = await getMenu();
    return NextResponse.json(menu);
  } catch (err) {
    console.error('[GET /api/menu]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
