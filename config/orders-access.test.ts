// Garde d'accès aux commandes : qui voit la page, qui peut agir, qui voit les
// marges. Ces trois listes se lisaient jusqu'ici dans trois endroits différents
// (barre latérale, garde serveur absente, affichage conditionnel), et c'est
// précisément leur divergence qui avait exposé la liste clients et les marges à
// KITCHEN et COMPTABLE. Ce test fige les trois réponses.

import { describe, expect, it } from 'vitest';
import { DASHBOARD_ROLES, ORDERS_VIEW_ROLES } from './constants';
import type { UserRole } from '@/generated/prisma/client';

// Reproduit les prédicats appliqués dans les pages (`canCash`, `canSeeMargins`).
const CASHIER_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
];
const MANAGER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER'];

describe('ORDERS_VIEW_ROLES', () => {
  it('exclut KITCHEN et COMPTABLE', () => {
    // Le cœur du correctif : ces deux rôles n'ont pas l'entrée « Commandes »
    // dans la barre latérale, mais atteignaient la page en tapant l'URL.
    expect(ORDERS_VIEW_ROLES).not.toContain('KITCHEN');
    expect(ORDERS_VIEW_ROLES).not.toContain('COMPTABLE');
  });

  it('autorise la caisse et la lecture seule', () => {
    expect([...ORDERS_VIEW_ROLES].sort()).toEqual(
      ['ADMIN', 'ANALYSTE', 'ASSISTANT_MANAGER', 'CASHIER', 'MANAGER'].sort()
    );
  });

  it('est plus restrictif que l’accès au dashboard', () => {
    // Si les deux listes coïncidaient, la garde ne servirait à rien : c'est
    // exactement la situation d'avant (seul le layout filtrait).
    expect(ORDERS_VIEW_ROLES.length).toBeLessThan(DASHBOARD_ROLES.length);
    for (const role of ORDERS_VIEW_ROLES) {
      expect(DASHBOARD_ROLES).toContain(role);
    }
  });
});

describe('droits par rôle sur une commande', () => {
  const canView = (r: UserRole) => ORDERS_VIEW_ROLES.includes(r);
  const canCash = (r: UserRole) => CASHIER_ROLES.includes(r);
  const canSeeMargins = (r: UserRole) => MANAGER_ROLES.includes(r);

  it.each<[UserRole, boolean, boolean, boolean]>([
    // rôle                 voir   agir   marges
    ['ADMIN', true, true, true],
    ['MANAGER', true, true, true],
    ['ASSISTANT_MANAGER', true, true, true],
    ['CASHIER', true, true, false],
    ['ANALYSTE', true, false, false],
    ['KITCHEN', false, false, false],
    ['COMPTABLE', false, false, false],
    ['USER', false, false, false],
  ])('%s', (role, view, cash, margins) => {
    expect(canView(role)).toBe(view);
    expect(canCash(role)).toBe(cash);
    expect(canSeeMargins(role)).toBe(margins);
  });

  it('un rôle qui ne peut pas voir ne peut ni agir ni voir les marges', () => {
    for (const role of DASHBOARD_ROLES) {
      if (canView(role)) continue;
      expect(canCash(role)).toBe(false);
      expect(canSeeMargins(role)).toBe(false);
    }
  });

  it('le caissier encaisse sans connaître la marge', () => {
    expect(canCash('CASHIER')).toBe(true);
    expect(canSeeMargins('CASHIER')).toBe(false);
  });

  it('l’analyste lit sans pouvoir agir', () => {
    expect(canView('ANALYSTE')).toBe(true);
    expect(canCash('ANALYSTE')).toBe(false);
  });
});
