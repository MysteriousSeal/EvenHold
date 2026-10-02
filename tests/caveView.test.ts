// @vitest-environment happy-dom
// A cave drawn (view/cave/): its scene built (its rock, floor, what's in it,
// its lights, the way up, the crack), seeing the hero, and what moves in it
// drawn from the model's run (its beasts, their webs and told moves, the
// crack clearing, her hoard); freed again. And the cave's mouth out in the hills.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { MOUTH_GRID, SINK, buildCaveMouth } from '../src/view/meshes/cave/caveMouthVoxels';

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

  it('has its mouth out in the hills: a knoll, a dark mouth in its front, open from the ground up (its floor at the ground\'s level)', () => {
    const grid = buildCaveMouth(0);
    const [w, h, d] = MOUTH_GRID;
    const at = (x: number, y: number, z: number) => grid.cells[x + w * (y + h * z)];
    const mid = Math.floor(w / 2);
    for (let y = SINK; y < SINK + 20; y++) expect(at(mid, y, d - 6)).toBe(0); // (the mouth, open: in past the roots over it)
    expect(at(mid, SINK - 1, d - 6)).not.toBe(0); // (its floor)
    expect(at(mid, SINK + 40, Math.floor(d / 2))).not.toBe(0); // (the knoll over it)
  });
});
