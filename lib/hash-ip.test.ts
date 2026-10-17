import { describe, expect, it } from 'vitest';
import { hashIp } from './hash-ip';

describe('hashIp', () => {
  it('ne renvoie jamais l’IP brute et reste stable pour une même IP', () => {
    const a = hashIp('41.202.207.10');
    expect(a).not.toContain('41.202');
    expect(a).toHaveLength(24);
    expect(hashIp('41.202.207.10')).toBe(a);
    expect(hashIp('41.202.207.11')).not.toBe(a);
  });

  it('renvoie null sans IP', () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp('')).toBeNull();
  });
});
