// lib/hash-ip.ts
//
// Pseudonymisation de l'adresse IP stockée avec un vote de sondage. Le but est
// l'anti-abus (repérer des votes en rafale depuis une même origine), pas
// l'identification : on garde un condensé salé et tronqué, jamais l'IP brute.
// Le sel vient du secret de l'application ; sans lui, l'espace IPv4 serait
// retrouvable par force brute.

import { createHash } from 'node:crypto';

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.BETTER_AUTH_SECRET ?? '';
  return createHash('sha256')
    .update(`${salt}:${ip}`)
    .digest('hex')
    .slice(0, 24);
}
