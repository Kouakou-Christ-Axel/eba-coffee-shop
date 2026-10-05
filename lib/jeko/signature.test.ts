// lib/jeko/signature.test.ts
//
// L'en-tête `Jeko-Signature` contient le HMAC-SHA256 du corps BRUT, en
// hexadécimal minuscule, sans préfixe ni horodatage. La comparaison se fait en
// temps constant, et une signature de mauvaise longueur ne doit jamais lever
// d'exception (`timingSafeEqual` lève si les longueurs diffèrent).

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyJekoSignature } from './signature';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"tx_1","status":"success","amount":{"amount":350000}}';

const sign = (body: string, secret = SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex');

describe('verifyJekoSignature', () => {
  it('accepte une signature valide sur le corps brut', () => {
    expect(verifyJekoSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('refuse un corps modifié après signature', () => {
    const tampered = BODY.replace('350000', '100');
    expect(verifyJekoSignature(tampered, sign(BODY), SECRET)).toBe(false);
  });

  it('refuse une signature faite avec un autre secret', () => {
    expect(verifyJekoSignature(BODY, sign(BODY, 'autre'), SECRET)).toBe(false);
  });

  it('refuse un en-tête absent ou vide', () => {
    expect(verifyJekoSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyJekoSignature(BODY, '', SECRET)).toBe(false);
  });

  it('refuse sans lever une signature de mauvaise longueur', () => {
    expect(verifyJekoSignature(BODY, 'abc123', SECRET)).toBe(false);
    expect(verifyJekoSignature(BODY, sign(BODY) + '00', SECRET)).toBe(false);
  });

  it("refuse une signature qui n'est pas de l'hexadécimal", () => {
    expect(verifyJekoSignature(BODY, 'z'.repeat(64), SECRET)).toBe(false);
  });

  it("refuse tout quand le secret n'est pas configuré", () => {
    expect(verifyJekoSignature(BODY, sign(BODY, ''), '')).toBe(false);
  });
});
