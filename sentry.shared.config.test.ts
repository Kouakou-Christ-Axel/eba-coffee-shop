import { describe, expect, it } from 'vitest';
import { shouldDropEvent } from './sentry.shared.config';

type Event = Parameters<typeof shouldDropEvent>[0];

const error = (value: string, url?: string): Event => ({
  exception: { values: [{ type: 'Error', value }] },
  ...(url ? { request: { url } } : {}),
});

const SERVER_ACTION =
  'Failed to find Server Action. This request might be from an older or newer deployment.';

describe('shouldDropEvent', () => {
  it('écarte « Non autorisé » (guards de page, déjà gérés par le layout)', () => {
    expect(
      shouldDropEvent(error('Non autorisé', 'https://eba-coffee.com/dashboard'))
    ).toBe(true);
  });

  it('garde un message qui ne fait que contenir « Non autorisé »', () => {
    expect(shouldDropEvent(error('Non autorisé à écrire en base'))).toBe(false);
  });

  it('écarte les Server Action introuvables ciblées par un scanner WordPress', () => {
    expect(
      shouldDropEvent(
        error(
          SERVER_ACTION,
          'https://185.237.252.216/wp-admin/admin-ajax.php?action=x'
        )
      )
    ).toBe(true);
    expect(
      shouldDropEvent(error(SERVER_ACTION, 'https://eba-coffee.com/xmlrpc.php'))
    ).toBe(true);
  });

  it('écarte les Server Action introuvables sur une IP nue', () => {
    expect(
      shouldDropEvent(error(SERVER_ACTION, 'https://185.237.252.216/'))
    ).toBe(true);
  });

  it('garde un vrai décalage de déploiement sur le domaine du site', () => {
    expect(
      shouldDropEvent(error(SERVER_ACTION, 'https://eba-coffee.com/carte'))
    ).toBe(false);
    expect(shouldDropEvent(error(SERVER_ACTION))).toBe(false);
  });

  it('garde les autres erreurs, même sur une URL de scanner', () => {
    expect(
      shouldDropEvent(error('boom', 'https://185.237.252.216/wp-admin/'))
    ).toBe(false);
  });

  it('écarte toujours les corps multipart malformés', () => {
    expect(shouldDropEvent(error('Failed to parse body as FormData.'))).toBe(
      true
    );
    expect(shouldDropEvent(error('no boundary found in multipart body'))).toBe(
      true
    );
  });

  it('ne plante pas sans exception', () => {
    expect(shouldDropEvent({ message: 'hello' })).toBe(false);
  });
});
