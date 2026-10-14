import { describe, expect, it } from 'vitest';
import {
  assistantRequestSchema,
  stripAttachments,
  userText,
  type StoredMessage,
} from './types';

const withImage: StoredMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'ticket' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    {
      type: 'file',
      file: {
        filename: 'facture.pdf',
        file_data: 'data:application/pdf;base64,AAAA',
      },
    },
  ],
};

describe('pièces jointes', () => {
  it('accepte texte + image + PDF', () => {
    expect(
      assistantRequestSchema.safeParse({ messages: [withImage] }).success
    ).toBe(true);
  });

  it('refuse un type de fichier ou une URL externe', () => {
    const bad = {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'https://evil.example/x.png' } },
      ],
    };
    expect(assistantRequestSchema.safeParse({ messages: [bad] }).success).toBe(
      false
    );
  });

  it('remplace les fichiers par leur mention avant persistance', () => {
    const [m] = stripAttachments([withImage]);
    expect(m).toEqual({
      role: 'user',
      content: 'ticket [Fichier joint : image] [Fichier joint : facture.pdf]',
    });
    expect(JSON.stringify(m)).not.toContain('base64');
    expect(userText('salut')).toBe('salut');
  });
});
