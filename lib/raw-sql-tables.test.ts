// lib/raw-sql-tables.test.ts
//
// Garde-fou : tout SQL brut ($queryRaw / $executeRaw / Prisma.sql) doit cibler
// le nom RÉEL de la table (`@@map`), pas le nom du modèle Prisma. Les requêtes
// typées traduisent le nom toutes seules ; le SQL brut non. Régression d'origine :
// `FROM "Customer"` alors que la table est `"customer"` → 42P01 « relation does
// not exist » et plus aucune commande créable après la mise à jour.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

/** Tables réelles : `@@map("x")` si présent, sinon le nom du modèle. */
function realTables(): Set<string> {
  const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8');
  const tables = new Set<string>();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const mapped = m[2].match(/@@map\("([^"]+)"\)/);
    tables.add(mapped ? mapped[1] : m[1]);
  }
  return tables;
}

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

const RAW_TEMPLATE =
  /(?:\$queryRaw|\$executeRaw|Prisma\.sql)\s*`((?:[^`\\]|\\.)*)`/g;
const TABLE_REF = /\b(?:FROM|JOIN|UPDATE|INTO)\s+"([^"]+)"/gi;

describe('SQL brut', () => {
  const tables = realTables();

  it('lit bien les tables depuis schema.prisma', () => {
    expect(tables.has('customer')).toBe(true);
    expect(tables.has('Customer')).toBe(false);
  });

  it('ne référence que des tables existantes (nom @@map)', () => {
    const errors: string[] = [];
    for (const file of [
      ...sourceFiles(join(ROOT, 'lib')),
      ...sourceFiles(join(ROOT, 'app')),
    ]) {
      const src = readFileSync(file, 'utf8');
      for (const raw of src.matchAll(RAW_TEMPLATE)) {
        for (const ref of raw[1].matchAll(TABLE_REF)) {
          if (!tables.has(ref[1])) {
            errors.push(
              `${file.replace(ROOT + '/', '')} : "${ref[1]}" n'existe pas en base (utiliser le nom @@map de la table)`
            );
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
