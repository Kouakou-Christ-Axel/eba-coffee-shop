// lib/schemas/upload.test.ts
import { describe, it, expect } from 'vitest';
import { imageUrlSchema } from './upload';
import { saveProductImageFromBase64 } from '@/lib/uploads';

describe('imageUrlSchema', () => {
  it('accepte un chemin d’upload local relatif', () => {
    expect(imageUrlSchema.safeParse('/uploads/products/x.jpg').success).toBe(
      true
    );
  });

  it('accepte une URL absolue http(s)', () => {
    expect(
      imageUrlSchema.safeParse('https://cdn.example.com/a.png').success
    ).toBe(true);
  });

  it('rejette une valeur qui n’est ni un chemin ni une URL', () => {
    expect(imageUrlSchema.safeParse('pas-une-url').success).toBe(false);
  });

  it('rejette une chaîne vide', () => {
    expect(imageUrlSchema.safeParse('').success).toBe(false);
  });
});

describe('saveProductImageFromBase64', () => {
  it('rejette un type MIME non autorisé sans écrire de fichier', async () => {
    await expect(
      saveProductImageFromBase64('Zm9v', 'image/gif')
    ).rejects.toThrow('Format non supporté');
  });

  it('rejette une data URI sans base64 exploitable (MIME interdit)', async () => {
    await expect(
      saveProductImageFromBase64('data:image/svg+xml;base64,PHN2Zz4=')
    ).rejects.toThrow('Format non supporté');
  });

  it('exige un mimeType en l’absence de data URI', async () => {
    await expect(saveProductImageFromBase64('Zm9v')).rejects.toThrow(
      'mimeType requis'
    );
  });
});
