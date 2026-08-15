// app/llms.txt/route.test.ts
import { describe, it, expect, vi } from 'vitest';

// La route lit `ENV.NEXT_PUBLIC_SITE_URL` (varlock) au niveau module — non
// initialisé hors runtime Next.js, comme dans carte-menu-section.test.tsx.
vi.mock('varlock/env', () => ({
  ENV: { NEXT_PUBLIC_SITE_URL: 'https://eba-coffee.com' },
}));

vi.mock('@/lib/contact-settings-db', () => ({
  getContactSettings: vi.fn(async () => DEFAULT_CONTACT_SETTINGS),
}));

vi.mock('@/lib/pickup-settings-db', () => ({
  getPickupSettings: vi.fn(async () => DEFAULT_SETTINGS),
}));

import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contact-settings';
import { DEFAULT_SETTINGS } from '@/lib/pickup-settings';
import { summarizeWeeklyHours } from '@/lib/pickup-settings';
import { GET } from './route';

async function body(): Promise<string> {
  const res = await GET();
  return res.text();
}

describe('GET /llms.txt', () => {
  it('sert du texte brut en UTF-8', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it("respecte la structure llms.txt : un H1 unique suivi d'un résumé en citation", async () => {
    const lines = (await body()).split('\n');
    expect(lines[0]).toBe('# EBA Coffee Shop');
    // Un seul H1 : les autres titres sont des H2 de section.
    expect(lines.filter((l) => /^# /.test(l))).toHaveLength(1);
    expect(lines.some((l) => l.startsWith('> '))).toBe(true);
  });

  it('reprend les coordonnées et horaires des réglages, jamais des constantes figées', async () => {
    const text = await body();
    expect(text).toContain(DEFAULT_CONTACT_SETTINGS.address);
    expect(text).toContain(DEFAULT_CONTACT_SETTINGS.phone);
    expect(text).toContain(DEFAULT_CONTACT_SETTINGS.email);
    expect(text).toContain(DEFAULT_CONTACT_SETTINGS.instagramUrl);
    expect(text).toContain(summarizeWeeklyHours(DEFAULT_SETTINGS.weeklyHours));
  });

  it('liste les pages publiques en URL absolues', async () => {
    const text = await body();
    for (const path of [
      '/',
      '/carte',
      '/le-lieu',
      '/a-propos',
      '/contact',
      '/sondages',
    ]) {
      expect(text).toContain(`(https://eba-coffee.com${path})`);
    }
    expect(text).toContain('https://eba-coffee.com/sitemap.xml');
  });

  it("n'expose aucune surface privée exclue de l'indexation", async () => {
    const text = await body();
    // `/dashboard` n'est cité que dans la note explicative des exclusions,
    // jamais comme lien de la liste — sinon on inviterait les crawlers LLM
    // exactement là où robots.txt les refuse.
    expect(text).not.toContain('(https://eba-coffee.com/dashboard');
    expect(text).not.toContain('(https://eba-coffee.com/login');
    expect(text).not.toContain('(https://eba-coffee.com/mes-commandes');
  });
});
