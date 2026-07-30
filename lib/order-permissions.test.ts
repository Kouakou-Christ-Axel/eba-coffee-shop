import { describe, it, expect } from 'vitest';
import { canTransition, nextStatuses } from './order-permissions';

describe('order-permissions — annulation / remboursement', () => {
  it('un caissier peut annuler depuis tous les statuts actifs', () => {
    expect(canTransition('NEW', 'CANCELLED', 'CASHIER')).toBe(true);
    expect(canTransition('PREPARING', 'CANCELLED', 'CASHIER')).toBe(true);
    expect(canTransition('READY', 'CANCELLED', 'CASHIER')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED', 'CASHIER')).toBe(true);
  });

  it('la cuisine ne peut pas annuler', () => {
    expect(canTransition('READY', 'CANCELLED', 'KITCHEN')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED', 'KITCHEN')).toBe(false);
  });

  it('les transitions normales restent valides', () => {
    expect(canTransition('NEW', 'PREPARING', 'KITCHEN')).toBe(true);
    expect(canTransition('PREPARING', 'READY', 'KITCHEN')).toBe(true);
    expect(canTransition('READY', 'COMPLETED', 'CASHIER')).toBe(true);
  });

  it('nextStatuses inclut CANCELLED pour un caissier sur READY', () => {
    expect(nextStatuses('READY', 'CASHIER')).toContain('CANCELLED');
    expect(nextStatuses('READY', 'CASHIER')).toContain('COMPLETED');
  });

  it('un gérant (MANAGER) a les mêmes droits qu’un caissier et la cuisine', () => {
    expect(canTransition('NEW', 'PREPARING', 'MANAGER')).toBe(true);
    expect(canTransition('READY', 'COMPLETED', 'MANAGER')).toBe(true);
    expect(canTransition('NEW', 'CANCELLED', 'MANAGER')).toBe(true);
  });

  it('un gérant adjoint (ASSISTANT_MANAGER) a les mêmes droits qu’un gérant', () => {
    expect(canTransition('NEW', 'PREPARING', 'ASSISTANT_MANAGER')).toBe(true);
    expect(canTransition('READY', 'COMPLETED', 'ASSISTANT_MANAGER')).toBe(true);
    expect(canTransition('NEW', 'CANCELLED', 'ASSISTANT_MANAGER')).toBe(true);
  });

  it('un comptable (COMPTABLE) ne peut faire aucune transition de commande', () => {
    expect(canTransition('NEW', 'PREPARING', 'COMPTABLE')).toBe(false);
    expect(canTransition('READY', 'COMPLETED', 'COMPTABLE')).toBe(false);
    expect(canTransition('NEW', 'CANCELLED', 'COMPTABLE')).toBe(false);
  });
});

describe('order-permissions — undo (transitions inverses, 10 s)', () => {
  it('un caissier peut défaire chaque transition de statut normale', () => {
    expect(canTransition('PREPARING', 'NEW', 'CASHIER')).toBe(true);
    expect(canTransition('READY', 'PREPARING', 'CASHIER')).toBe(true);
    expect(canTransition('COMPLETED', 'READY', 'CASHIER')).toBe(true);
  });

  it('la cuisine peut défaire les transitions qu’elle peut elle-même faire', () => {
    expect(canTransition('PREPARING', 'NEW', 'KITCHEN')).toBe(true);
    expect(canTransition('READY', 'PREPARING', 'KITCHEN')).toBe(true);
  });

  it('la cuisine ne peut pas défaire une remise (COMPLETED→READY)', () => {
    expect(canTransition('COMPLETED', 'READY', 'KITCHEN')).toBe(false);
  });

  it('un caissier peut annuler une annulation, vers n’importe quel statut antérieur', () => {
    expect(canTransition('CANCELLED', 'NEW', 'CASHIER')).toBe(true);
    expect(canTransition('CANCELLED', 'PREPARING', 'CASHIER')).toBe(true);
    expect(canTransition('CANCELLED', 'READY', 'CASHIER')).toBe(true);
    expect(canTransition('CANCELLED', 'COMPLETED', 'CASHIER')).toBe(true);
  });

  it('la cuisine ne peut pas annuler une annulation', () => {
    expect(canTransition('CANCELLED', 'NEW', 'KITCHEN')).toBe(false);
    expect(canTransition('CANCELLED', 'PREPARING', 'KITCHEN')).toBe(false);
  });

  it('un comptable ne peut défaire aucune transition', () => {
    expect(canTransition('PREPARING', 'NEW', 'COMPTABLE')).toBe(false);
    expect(canTransition('CANCELLED', 'NEW', 'COMPTABLE')).toBe(false);
  });

  it('n’ajoute aucune nouvelle paire inattendue (ex. saut direct NEW→READY)', () => {
    expect(canTransition('NEW', 'READY', 'ADMIN')).toBe(false);
    expect(canTransition('READY', 'NEW', 'ADMIN')).toBe(false);
  });
});
