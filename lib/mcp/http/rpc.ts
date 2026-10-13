import { NextResponse } from 'next/server';
import { handleRpc } from '@/lib/mcp/handler';
import { revalidateMenu } from './revalidate';

/** Traitement JSON-RPC commun aux chemins clé statique et OAuth. */
export async function processRpc(
  req: Request,
  allowedTools?: Set<string>
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      },
      { status: 400 }
    );
  }

  const options = { onWriteSuccess: revalidateMenu, allowedTools };

  // Message unique ou lot (clients anciens) ; les notifications sont filtrées.
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        },
        { status: 400 }
      );
    }
    const responses = (
      await Promise.all(body.map((m) => handleRpc(m, options)))
    ).filter((r) => r !== null);
    if (responses.length === 0) {
      return new NextResponse(null, { status: 202 });
    }
    return NextResponse.json(responses);
  }

  const response = await handleRpc(body, options);
  if (response === null) {
    // Notification : pas de corps de réponse.
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(response);
}
