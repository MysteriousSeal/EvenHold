// A bandit camp's pieces drawn (view/meshes/camp/): every kind in every look
// meshes to something; the fire, the gatehouse and the loot have what glows
// (embers, torchlight, gold); each stays within its tile across (it may stand
// tall: the watchtower over it all).
import { describe, expect, it } from 'vitest';
import { buildCampGeometry } from '../src/view/meshes/camp/campMesh';
import type { CampPieceKind } from '../src/model/camps/camps';

const KINDS: CampPieceKind[] = ['fire', 'tent', 'rack', 'crates', 'loot', 'palisade', 'gate', 'tower', 'woodpile'];

describe('a bandit camp\'s pieces', () => {
  it('each kind, in each look, meshes; the fire, the gatehouse and the loot glow; each within its tile, the watchtower tallest', () => {
    const heights = new Map<CampPieceKind, number>();
    for (const kind of KINDS) {
      for (let variant = 0; variant < 4; variant++) {
        const geometry = buildCampGeometry(kind, false, variant);
        expect(geometry.getAttribute('position').count, `${kind} ${variant}`).toBeGreaterThan(0);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        expect(box.min.x).toBeGreaterThanOrEqual(-0.51);
        expect(box.max.x).toBeLessThanOrEqual(0.51);
        expect(box.min.z).toBeGreaterThanOrEqual(-0.51);
        expect(box.max.z).toBeLessThanOrEqual(0.51);
        heights.set(kind, Math.max(heights.get(kind) ?? 0, box.max.y));
      }
      const glows = buildCampGeometry(kind, true).getAttribute('position')?.count ?? 0;
      expect(glows > 0, kind).toBe(kind === 'fire' || kind === 'gate' || kind === 'loot');
    }
    expect(Math.max(...heights.values())).toBe(heights.get('tower'));
  });
});
