import { NextResponse } from 'next/server';
import { getAvailablePickupSlots } from '@/lib/pickup-settings-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const slots = await getAvailablePickupSlots(new Date());
    return NextResponse.json({
      slots: slots.map((s) => s.toISOString()),
    });
  } catch {
    return NextResponse.json(
      { error: 'Impossible de charger les créneaux' },
      { status: 500 }
    );
  }
}
