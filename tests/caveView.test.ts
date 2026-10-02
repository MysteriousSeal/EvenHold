// @vitest-environment happy-dom
// A cave drawn (view/cave/): its scene built (its rock, floor, what's in it,
// its lights, the way up, the crack), seeing the hero, and what moves in it
// drawn from the model's run (its beasts, their webs and told moves, the
// crack clearing, her hoard); freed again. And the cave's mouth out in the hills.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { MOUTH_GRID, MOUTH_PALETTE, SINK, buildCaveMouth } from '../src/view/meshes/cave/caveMouthVoxels';

const MID = { width: 512, depth: 512 };
// No canvas in happy-dom: a 2D context that draws nothing (the foes' names, their bars), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe('a cave', () => {
  it('are drawn, with all that\'s in the cave (its rock, floor, props, lights, the way up, the crack), their webs and told moves, her hoard; freed again', () => {
    const model = new GameModel(1, MID);
    const cave = model.caves[0];
    model.teleport(cave.entrance.x, cave.entrance.z);
    model.useDoor();
    const built = buildDungeonScene(model.seed, cave.entrance)!;
    expect(built.scene.children.length).toBeGreaterThan(20);
    built.seeHero(model.hero.x, model.hero.z);
    built.update(1);
    for (let i = 0; i < 30; i++) {
      model.update(0, 0, 0.1);
      built.life.update(model, 0.1);
    }
    for (const f of model.foes) [(f.state = 'dead'), model.slayGuard(f)];
    model.update(0, 0, 0.1);
    built.life.update(model, 2); // (the crack clearing, her hoard)
    expect(built.life.rumble).toBeGreaterThanOrEqual(0);
    built.life.dispose();
    built.dispose();
  });

  it('has its mouth out in the hills: a craggy outcrop, a dark mouth in its front, cut into the rock over its own floor, nothing laid before it, nothing dark facing the open air', () => {
    const grid = buildCaveMouth(0);
    const [w, h, d] = MOUTH_GRID;
    const at = (x: number, y: number, z: number) => grid.cells[x + w * (y + h * z)];
    const mid = Math.floor(w / 2);
    // The mouth: cut back into the rock, open over its own floor, black within.
    const z = d - 20;
    for (let y = SINK + 1; y < SINK + 16; y++) expect(at(mid, y, z)).toBe(0);
    expect(at(mid, SINK, z)).not.toBe(0);
    expect(at(mid, SINK + 30, Math.floor(d / 2))).not.toBe(0); // (the crag over it)
    // Nothing laid before it: on the ground in front of its floor, across the opening, nothing at all.
    for (let x = mid - 5; x <= mid + 5; x++) {
      let lip = d - 1;
      while (lip > 0 && at(x, SINK, lip) === 0) lip--; // (its floor's front, here: ragged as the rock over it)
      expect(d - 1 - lip).toBeGreaterThan(0);
      for (let zz = lip + 1; zz < d; zz++) for (let y = SINK; y < SINK + 4; y++) expect(at(x, y, zz)).toBe(0);
    }
    // Nothing dark where it faces the open air (outside the mouth, over the ground): no black seen outside.
    const darks = new Set([MOUTH_PALETTE.indexOf(0x060504) + 1, MOUTH_PALETTE.indexOf(0x15110e) + 1]);
    for (let x = 1; x < w - 1; x++) for (let y = SINK; y < h - 1; y++) for (let z = 1; z < d - 6; z++) {
      if (!darks.has(at(x, y, z))) continue;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
        const inMouth = Math.abs(x + dx - mid) < 12 && y + dy >= SINK + 1 && y + dy < SINK + 22 && z + dz > d - 28 && at(x + dx, y + dy, z + dz) === 0;
        if (!inMouth) expect(at(x + dx, y + dy, z + dz)).not.toBe(0);
      }
    }
  });
});
