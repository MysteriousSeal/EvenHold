// Draugr dressed each its own way (view/meshes/enemy/draugrVoxels.ts): the
// same look every time for a draugr; every headgear, beard, garb and both
// weapons among them; every part of every look built.
import { describe, expect, it } from 'vitest';
import { draugrFrame, draugrLook, longswordGeometry, axeGeometry } from '../src/view/meshes/enemy/draugrVoxels';

describe('draugr looks', () => {
  it('are a draugr\'s own, the same every time; all of them worn by some', () => {
    const looks = Array.from({ length: 400 }, (_, id) => draugrLook(3_000_000 + id));
    expect(draugrLook(3_000_007)).toEqual(looks[7]);
    expect(new Set(looks.map((l) => l.head))).toEqual(new Set(['helm', 'cap', 'hood', 'bare']));
    expect(new Set(looks.map((l) => l.garb))).toEqual(new Set(['mail', 'fur', 'jerkin']));
    expect(new Set(looks.map((l) => l.beard)).size).toBe(3);
    const swords = looks.filter((l) => l.sword).length / looks.length;
    expect(swords).toBeGreaterThan(0.2);
    expect(swords).toBeLessThan(0.5);
  });

  it('are built, every part of every look, and differ to see', () => {
    const seen = new Set<string>();
    for (const head of ['helm', 'cap', 'hood', 'bare'] as const) {
      for (const garb of ['mail', 'fur', 'jerkin'] as const) {
        const frame = draugrFrame({ head, garb, beard: 4, sword: false });
        for (const part of ['head', 'torso', 'arm', 'leg'] as const) expect(frame.part(part).getAttribute('position').count).toBeGreaterThan(0);
        seen.add(`${frame.part('head').getAttribute('position').count}:${frame.part('torso').getAttribute('position').count}`);
      }
    }
    expect(seen.size).toBeGreaterThan(6); // (not all alike)
    expect(longswordGeometry().getAttribute('position').count).toBeGreaterThan(0);
    expect(axeGeometry().getAttribute('position').count).toBeGreaterThan(0);
  });
});
