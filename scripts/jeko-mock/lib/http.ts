import type { IncomingMessage, ServerResponse } from 'node:http';

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export const apiError = (
  res: ServerResponse,
  status: number,
  id: string,
  message: string,
  extras?: unknown
) => sendJson(res, status, { id, message, ...(extras ? { extras } : {}) });
