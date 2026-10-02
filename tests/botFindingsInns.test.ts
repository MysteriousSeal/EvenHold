// What the bots' playtest found in the inns, kept fixed: the staff and the patrons walking into the furniture.
// A minute and a half of each inn's life in two 512 worlds: in its own file, being long, so it runs beside the rest
// (botFindings.test.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };

describe('inns', () => {
  it.each([11, 12])('seed %i (512): have their staff and patrons never walk into the furniture, the hero looking on', (seed) => {
    const model = new GameModel(seed, MID);
    const bumps: string[] = []; // (every walker, every step: told once, at the end)
    for (const entrance of model.entrances.filter((e) => e.type === 'inn')) {
      model.teleport(entrance.x, entrance.z);
      expect(model.useDoor()).toBe(true);
      const { furniture } = layoutOf(model.seed, entrance);
      for (let t = 0; t < 90; t += FRAME * 4) {
        model.update(0, 0, FRAME * 4);
        for (const n of model.npcs) if (n.where === entrance && !n.seat && bumpsFurniture(furniture, n.x, n.z, 0.05)) bumps.push(`${n.role} ${n.name} at ${n.x.toFixed(2)},${n.z.toFixed(2)}`);
      }
      model.useDoor();
    }
    expect(bumps.slice(0, 10)).toEqual([]);
  });
});
