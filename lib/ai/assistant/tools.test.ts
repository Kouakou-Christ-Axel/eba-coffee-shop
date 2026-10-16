import { describe, expect, it } from 'vitest';
import {
  assistantTools,
  assistantToolDefinitions,
  canUseAssistant,
  isWriteTool,
  runAssistantTool,
} from './tools';

describe('outils de l’assistant par rôle', () => {
  it('réserve l’assistant aux rôles MCP', () => {
    expect(canUseAssistant('ADMIN')).toBe(true);
    expect(canUseAssistant('CASHIER')).toBe(false);
    expect(canUseAssistant('KITCHEN')).toBe(false);
  });

  it('ANALYSTE : lecture seule', () => {
    const names = assistantTools('ANALYSTE');
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((t) => t.readOnly)).toBe(true);
  });

  it('COMPTABLE : finance uniquement ; ADMIN : tout sauf images', () => {
    expect(
      assistantTools('COMPTABLE').every((t) => t.scope === 'finance')
    ).toBe(true);
    const admin = assistantTools('ADMIN').map((t) => t.name);
    expect(admin).toContain('create_expense');
    expect(admin).not.toContain('set_product_image');
  });

  it('classe create_expense en écriture et expose un schéma sans $schema', () => {
    expect(isWriteTool('create_expense')).toBe(true);
    expect(isWriteTool('list_expenses')).toBe(false);
    const def = assistantToolDefinitions('ADMIN').find(
      (d) => d.function.name === 'create_expense'
    );
    expect(def?.function.parameters).not.toHaveProperty('$schema');
  });

  it('brouillons sans confirmation, confirm_* avec', () => {
    expect(isWriteTool('prepare_purchase')).toBe(false);
    expect(isWriteTool('prepare_other_expense')).toBe(false);
    expect(isWriteTool('confirm_purchase')).toBe(true);
    expect(isWriteTool('confirm_other_expense')).toBe(true);
  });

  it('écarte get_menu (trop gros) et le toggle non idempotent', () => {
    const names = assistantTools('ADMIN').map((t) => t.name);
    expect(names).not.toContain('get_menu');
    expect(names).not.toContain('toggle_product_availability');
    expect(names).toContain('search_products');
    expect(names).toContain('set_product_availability');
    expect(isWriteTool('search_products')).toBe(false);
    expect(isWriteTool('set_product_availability')).toBe(true);
  });

  it('refuse un outil hors rôle et des arguments invalides', async () => {
    expect(
      (await runAssistantTool('create_expense', '{}', 'ANALYSTE')).ok
    ).toBe(false);
    const bad = await runAssistantTool('create_expense', '{"x":1}', 'ADMIN');
    expect(bad.ok).toBe(false);
    expect(bad.content).toContain('invalides');
  });
});
