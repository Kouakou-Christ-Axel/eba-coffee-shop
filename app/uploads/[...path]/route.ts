// app/uploads/[...path]/route.ts
//
// Sert les fichiers uploadés au runtime (`/uploads/<subdir>/<uuid>.webp`).
//
// Pourquoi un route handler plutôt que le serving statique de `public/` ?
// En production (`next start`), Next ne sert QUE les assets présents dans
// `public/` au moment du `build`. Les images écrites au runtime (dashboard via
// `/api/upload`, ou serveur MCP via `set_product_image`) n'y sont donc jamais
// servies → 404, et l'optimiseur `/_next/image` renvoie alors 400. Ce handler
// lit le fichier directement depuis le dossier d'uploads (le même que celui où
// `lib/uploads.ts` écrit) et le renvoie avec le bon `Content-Type`.

import { readFile } from 'node:fs/promises';
import { join, extname, sep } from 'node:path';
import { uploadsBaseDir } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Extensions servies + type MIME associé. Les uploads sont ré-encodés en WebP,
// mais on tolère les autres formats au cas où (legacy / futur).
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
};

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path: segments } = await params;

  // Garde-fou traversée de chemin : chaque segment doit être « propre ».
  if (
    !segments?.length ||
    segments.some((s) => !s || s === '.' || s === '..' || s.includes('\0'))
  ) {
    return notFound();
  }

  const ext = extname(segments[segments.length - 1]).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) return notFound();

  const base = uploadsBaseDir();
  const target = join(base, ...segments);

  // Double garde : le chemin résolu doit rester sous la racine d'uploads.
  const root = base.endsWith(sep) ? base : base + sep;
  if (!target.startsWith(root)) return notFound();

  let file: Buffer;
  try {
    file = await readFile(target);
  } catch {
    return notFound();
  }

  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Les noms de fichiers sont des UUID immuables → cache agressif.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
