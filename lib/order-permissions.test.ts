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

  it('un comptable (COMPTABLE) ne peut faire aucune transition de commande', () => {
    expect(canTransition('NEW', 'PREPARING', 'COMPTABLE')).toBe(false);
    expect(canTransition('READY', 'COMPLETED', 'COMPTABLE')).toBe(false);
    expect(canTransition('NEW', 'CANCELLED', 'COMPTABLE')).toBe(false);
  });
});
