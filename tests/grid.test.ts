// The map's grid helpers (model/map/grid.ts): which way a thing turned so faces,
// which side a step is, and the tiles a flood reaches.
import { describe, expect, it } from 'vitest';
import { FACINGS, NEIGHBORS_4, flood, sideOf } from '../src/model/map/grid';

describe('the grid', () => {
  it('faces the way the view turns a model: local +Z turned a quarter at a time about +Y', () => {
    FACINGS.forEach(([x, z], q) => {
      const a = (q * Math.PI) / 2;
      expect([Math.round(Math.sin(a)) + 0, Math.round(Math.cos(a)) + 0]).toEqual([x, z]); // (+ 0: no -0)
    });
  });

  it('knows each step for its side', () => {
    NEIGHBORS_4.forEach(([dx, dz], side) => expect(sideOf(dx, dz)).toBe(side));
    expect(sideOf(1, 1)).toBe(-1);
  });

  it('floods four ways through what is open, from every start, never past it', () => {
    const open = new Set(['0,0', '1,0', '2,0', '2,1', '5,5', '0,1']);
    const reached = flood([[0, 0]], (x, z) => open.has(`${x},${z}`));
    expect([...reached].sort()).toEqual(['0,0', '0,1', '1,0', '2,0', '2,1']);
    expect(flood([[0, 0], [5, 5]], (x, z) => open.has(`${x},${z}`)).size).toBe(6);
    expect(flood([[9, 9]], (x, z) => open.has(`${x},${z}`)).size).toBe(0); // (a start not open: nothing)
    expect(flood([[1, 1]], () => false).size).toBe(0);
  });
});
