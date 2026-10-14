import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth-helpers';
import { canUseAssistant } from '@/lib/ai/assistant/tools';
import { listConversations } from '@/lib/ai/assistant/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session || !canUseAssistant(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  return NextResponse.json({
    conversations: await listConversations(session.user.id),
  });
}
