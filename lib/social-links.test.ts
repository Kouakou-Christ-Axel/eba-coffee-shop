// lib/social-links.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contact-settings';
import {
  buildSameAs,
  buildSocialProfiles,
  xHandleFromUrl,
} from '@/lib/social-links';

const contact = DEFAULT_CONTACT_SETTINGS;

describe('buildSocialProfiles', () => {
  it('ne garde que les réseaux renseignés', () => {
    // Défauts : Instagram + TikTok seuls, les quatre autres sont vides.
    expect(buildSocialProfiles(contact).map((p) => p.key)).toEqual([
      'instagram',
      'tiktok',
    ]);
  });

  it('ajoute les réseaux facultatifs dès qu’ils sont remplis', () => {
    const profiles = buildSocialProfiles({
      ...contact,
      facebookUrl: 'https://www.facebook.com/eba.coffeeshop',
      youtubeUrl: 'https://www.youtube.com/@eba.coffeeshop',
    });
    expect(profiles.map((p) => p.key)).toEqual([
      'instagram',
      'tiktok',
      'facebook',
      'youtube',
    ]);
  });

  it('ignore une URL réduite à des espaces', () => {
    const profiles = buildSocialProfiles({ ...contact, linkedinUrl: '   ' });
    expect(profiles.some((p) => p.key === 'linkedin')).toBe(false);
  });
});

describe('buildSameAs', () => {
  it('ne produit jamais d’entrée vide', () => {
    const sameAs = buildSameAs({ ...contact, xUrl: '' });
    expect(sameAs).toEqual([contact.instagramUrl, contact.tiktokUrl]);
    expect(sameAs.every((url) => url.length > 0)).toBe(true);
  });
});

describe('xHandleFromUrl', () => {
  it('extrait le pseudo d’un profil x.com ou twitter.com', () => {
    expect(xHandleFromUrl('https://x.com/eba_coffeeshop')).toBe(
      '@eba_coffeeshop'
    );
    expect(xHandleFromUrl('https://www.twitter.com/eba')).toBe('@eba');
    expect(xHandleFromUrl('https://x.com/eba/')).toBe('@eba');
  });

  it('renvoie null hors profil (vide, autre domaine, lien profond)', () => {
    expect(xHandleFromUrl('')).toBeNull();
    expect(xHandleFromUrl('pas une url')).toBeNull();
    expect(xHandleFromUrl('https://www.instagram.com/eba')).toBeNull();
    expect(xHandleFromUrl('https://x.com/eba/status/123')).toBeNull();
    expect(xHandleFromUrl('https://x.com/')).toBeNull();
  });
});
