// lib/orders/visibility-guard.test.ts
//
// Garde-fou : toute LECTURE de commandes (`order.findMany / findFirst / count /
// aggregate / groupBy`) doit passer par `withStaffVisible` (lib/orders/visibility.ts),
// sinon une commande en attente de paiement Jèko — ou abandonnée — apparaît à la
// caisse, en cuisine ou gonfle les stats. Une lecture qui DOIT voir ces commandes
// se déclare par un commentaire juste au-dessus :
//
//   // staff-visibility: exempt — <raison>
//
// Les lectures par identifiant (`findUnique`) et les écritures ne sont pas
// concernées : le client voit toujours sa propre commande.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

const ORDER_READ =
  /\b(?:prisma|tx)\.order\.(?:findMany|findFirst|count|aggregate|groupBy)\(/g;
const EXEMPT = /staff-visibility:\s*exempt\s*[—-]\s*\S/;

/** Texte des arguments de l'appel, parenthèses équilibrées. */
function callArguments(src: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(openParen, i);
  }
  return src.slice(openParen);
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

describe('visibilité staff des commandes', () => {
  it('détecte bien des lectures de commandes (le garde ne tourne pas à vide)', () => {
    let reads = 0;
    for (const file of [
      ...sourceFiles(join(ROOT, 'lib')),
      ...sourceFiles(join(ROOT, 'app')),
    ]) {
      reads += [...readFileSync(file, 'utf8').matchAll(ORDER_READ)].length;
    }
    expect(reads).toBeGreaterThan(10);
  });

  it('toute lecture de commandes passe par withStaffVisible ou déclare une exemption', () => {
    const errors: string[] = [];
    for (const file of [
      ...sourceFiles(join(ROOT, 'lib')),
      ...sourceFiles(join(ROOT, 'app')),
    ]) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(ORDER_READ)) {
        const start = m.index ?? 0;
        const args = callArguments(src, start + m[0].length - 1);
        const before = src.slice(Math.max(0, start - 300), start);
        const lastLines = before.split('\n').slice(-4).join('\n');
        if (args.includes('withStaffVisible') || EXEMPT.test(lastLines)) {
          continue;
        }
        errors.push(
          `${file.replace(ROOT + '/', '')}:${lineOf(src, start)} — ${m[0]}…`
        );
      }
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
