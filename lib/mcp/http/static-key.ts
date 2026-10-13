import { timingSafeEqual } from 'node:crypto';

/** `true` seulement si `MCP_API_KEY` est configurée ET égale au Bearer fourni. */
export function matchesStaticKey(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false;

  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  // Temps constant : `timingSafeEqual` exige des buffers de même longueur.
  const a = Buffer.from(match[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
