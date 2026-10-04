// lib/jeko/signature.ts
//
// Vérification de l'en-tête `Jeko-Signature` : HMAC-SHA256 du corps BRUT en
// hexadécimal minuscule (64 caractères), sans préfixe ni horodatage. Le HMAC
// doit porter sur le texte reçu tel quel, jamais sur un JSON re-sérialisé.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEX = /^[0-9a-f]{64}$/;

export function verifyJekoSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  // Secret absent : on refuse tout plutôt que de valider un HMAC à clé vide.
  if (!secret || !signature || !SIGNATURE_HEX.test(signature)) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
