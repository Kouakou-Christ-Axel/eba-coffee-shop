// app/api/commandes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/orders';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return NextResponse.json(
      { error: 'Commande introuvable' },
      { status: 404 }
    );
  }

  return NextResponse.json(order);
}
