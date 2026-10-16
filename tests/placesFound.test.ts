// The journal's Places (controller/quests/placesTab.ts): what the hero's found, under the lands of the village found
// nearest each; the dungeons and camps cleared or not; a tally a region, and the world's.
import { describe, expect, it } from 'vitest';
import { placesFound, placesTab, type FoundWorld } from '../src/controller/quests/placesTab';
import { villageName } from '../src/model/villages/villageNames';
import type { Place } from '../src/model/atlas/atlas';

const place = (kind: Place['kind'], x: number, cleared = false): Place => ({ kind, x, z: 0, name: `${kind} ${x}`, level: 1, key: `${kind}${x}`, cleared });
const world: FoundWorld = {
  seed: 7,
  villages: [{ x: 0, z: 0, groundTier: 0 }, { x: 1000, z: 0, groundTier: 0 }, { x: 5000, z: 0, groundTier: 0, town: true }],
  atlas: {
    fog: { seen: (x: number) => x < 2000 }, // (the town not found)
    places: () => [place('crypt', 100, true), place('cave', 900), place('camp', 1200, true)],
    landmarks: () => [{ kind: 'menhir', x: 50, z: 0 }],
  },
};

describe('the places found', () => {
  it('under the nearest village found, each its own lands: the village, its places and landmarks, a tally', () => {
    const { regions, total } = placesFound(world);
    const [a, b] = [villageName(world.villages[0], 7), villageName(world.villages[1], 7)];
    expect(regions.map((r) => [r.name, r.rows.map((row) => row.kind)])).toEqual([
      [`${a}'s lands`, ['village', 'crypt', 'menhir']],
      [`${b}'s lands`, ['village', 'cave', 'camp']],
    ]);
    expect(regions[0].tally).toBe('3 found · 1/1 cleared');
    expect(regions[1].tally).toBe('3 found · 1/2 cleared');
    expect(regions[1].rows.find((r) => r.kind === 'cave')!.state).toBe('Not cleared');
    expect(total).toBe('6 places found · 2/3 cleared');
  });

  it('nothing found: no lands', () => {
    expect(placesFound({ ...world, atlas: { fog: { seen: () => false }, places: () => [], landmarks: () => [] } })).toEqual({ regions: [], total: '0 places found · 0/0 cleared' });
  });

  it('a row clicked: the map opened on it', () => {
    const shown: number[][] = [];
    const { cells } = placesTab(world, (x, z) => shown.push([x, z])).slots!() as { cells: Array<{ use?(): void }> };
    cells[1].use!(); // (the crypt, under the first village's lands)
    expect(shown).toEqual([[100, 0]]);
  });
});
