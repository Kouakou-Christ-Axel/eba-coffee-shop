// lib/mcp/tools.test.ts
//
// Filet de sécurité pour la taxonomie `toolset` (cf. `TOOLSET_NAMES`) : garantit
// que tout outil du registre est classé, et que `TOOLSET_TOOL_NAMES` partitionne
// bien l'ensemble des outils (aucun trou, aucun chevauchement). Redondant avec
// le champ `toolset` obligatoire côté TypeScript, mais couvre aussi une
// éventuelle désynchronisation manuelle entre `tools` et `TOOLSET_TOOL_NAMES`.
import { describe, it, expect } from 'vitest';
import { tools, TOOLSET_NAMES, TOOLSET_TOOL_NAMES } from './tools';

describe('toolset — partition complète des outils', () => {
  it('chaque outil a un toolset valide', () => {
    for (const t of tools) {
      expect(TOOLSET_NAMES).toContain(t.toolset);
    }
  });

  it('TOOLSET_TOOL_NAMES partitionne tous les outils sans trou ni chevauchement', () => {
    const seen = new Set<string>();
    for (const toolset of TOOLSET_NAMES) {
      for (const name of TOOLSET_TOOL_NAMES[toolset]) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
    expect(seen.size).toBe(tools.length);
  });
});
