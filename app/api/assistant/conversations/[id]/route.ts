import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth-helpers';
import { canUseAssistant } from '@/lib/ai/assistant/tools';
import {
  deleteConversation,
  getConversation,
} from '@/lib/ai/assistant/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function authorize() {
  const session = await getCurrentSession();
  return session && canUseAssistant(session.user.role) ? session : null;
}

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const session = await authorize();
  if (!session)
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const conversation = await getConversation(
    session.user.id,
    (await params).id
  );
  if (!conversation)
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function DELETE(
  _req: Request,
  { params }: Ctx
): Promise<Response> {
  const session = await authorize();
  if (!session)
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const ok = await deleteConversation(session.user.id, (await params).id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Introuvable' }, { status: 404 });
}
