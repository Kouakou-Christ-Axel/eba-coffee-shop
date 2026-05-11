import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporté (JPEG, PNG, WebP uniquement)' },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 5 MB)' },
      { status: 400 }
    );
  }

  const ext =
    file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
