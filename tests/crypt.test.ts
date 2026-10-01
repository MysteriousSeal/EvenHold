// @vitest-environment happy-dom
// Crypts under the ruins (model/crypts/): a way down in every ruin, a crypt of
// the zone's level below, laid out from the seed (big, linear, side rooms off
// it, the great hall at the end), its tombs never shutting the way; going down,
// walking it, climbing out, saving down there; and its scene built.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { spawnOf } from '../src/model/map/grid';
import { zoneLevel } from '../src/model/enemies/enemyLevels';
import { cryptInside, type Crypt } from '../src/model/crypts/crypts';
import { isFloor, planCrypt, inFullView, type CryptPlan } from '../src/model/crypts/cryptLayout';
import { furnishCrypt, type CryptProp } from '../src/model/crypts/cryptProps';
import { parseSave, restore, snapshot } from '../src/model/save';
import { buildCryptScene } from '../src/view/crypt/cryptView';
import { FRAME, TEST_SEEDS } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const models = [1, 2, 3].map((seed) => new GameModel(seed, MID));
const crypts = models.flatMap((model) => model.crypts.map((crypt) => ({ model, crypt })));

// Every floor tile reached from the foot of the stairs, round what's solid.
function reached(plan: CryptPlan, props: readonly CryptProp[]): { reached: number; open: number } {
  const solid = new Set<string>();
  for (const p of props) if (p.solid) for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) solid.add(`${x},${z}`);
  const seen = new Set<string>();
  const todo: Array<[number, number]> = [[plan.door, plan.depth - 1]];
  while (todo.length) {
    const [x, z] = todo.pop()!;
    if (!isFloor(plan, x, z) || solid.has(`${x},${z}`) || seen.has(`${x},${z}`)) continue;
    seen.add(`${x},${z}`);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  let open = 0;
  for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (isFloor(plan, x, z) && !solid.has(`${x},${z}`)) open++;
  return { reached: seen.size, open };
}

describe('crypts', () => {
  it('have a way down in every ruin: on its own blocked tile inside it, the spot before it open, of the zone\'s level, named', () => {
    for (const model of models) {
      expect(model.crypts.length).toBe(model.ruins.length);
      for (const c of model.crypts) {
        const { ruin, stairs, entrance } = c;
        expect(stairs.x).toBeGreaterThan(ruin.x);
        expect(stairs.x).toBeLessThan(ruin.x + ruin.w - 1);
        expect(model.isOpenTile(stairs.x, stairs.z)).toBe(false); // blocked: down with E, not walked into
        expect(model.isOpenTile(Math.round(entrance.x), Math.round(entrance.z))).toBe(true);
        expect(model.entrances).toContain(entrance);
        expect(c.level).toBe(zoneLevel(spawnOf(model.size), { x: ruin.x + ruin.w / 2, z: ruin.z + ruin.d / 2 }));
        expect(c.name).toMatch(/^the crypt of \w+/);
      }
    }
  });

  it('are laid out the same every time, big and linear: a long corridor, side rooms off it, the great hall at the end', () => {
    for (const { model, crypt } of crypts) {
      const plan = planCrypt(model.seed, crypt.ruin);
      expect(planCrypt(model.seed, crypt.ruin)).toEqual(plan);
      const tiles = plan.floor.reduce((a, b) => a + b, 0);
      expect(tiles).toBeGreaterThan(400); // big
      const kinds = plan.places.map((p) => p.kind);
      expect(kinds.filter((k) => k === 'corridor').length).toBeGreaterThan(8);
      expect(kinds.filter((k) => k === 'side').length).toBeGreaterThanOrEqual(3);
      expect(kinds).toContain('great');
      expect(isFloor(plan, plan.door, plan.depth - 1)).toBe(true); // the foot of the stairs
      expect(reached(plan, []).reached).toBe(tiles); // all one crypt
    }
  });

  it('hold tombs and lights that never shut the way on, the great sarcophagus on its dais at the end', () => {
    for (const { model, crypt } of crypts) {
      const plan = planCrypt(model.seed, crypt.ruin);
      const props = furnishCrypt(model.seed, crypt.ruin, plan);
      expect(furnishCrypt(model.seed, crypt.ruin, plan)).toEqual(props);
      const { reached: got, open } = reached(plan, props);
      expect(got).toBe(open);
      const kinds = new Set(props.map((p) => p.kind));
      for (const kind of ['sconce', 'sarcophagus', 'candles', 'dais', 'greatSarcophagus', 'niche', 'cobweb'] as const) expect(kinds.has(kind), kind).toBe(true);
      for (const p of props) {
        if (p.kind === 'sconce' || p.kind === 'niche') {
          expect(isFloor(plan, p.x, p.z), `${p.kind} in the rock`).toBe(false);
          const [ox, oz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.facing];
          expect(isFloor(plan, p.x + ox, p.z + oz), `${p.kind} facing the floor`).toBe(true);
          expect(inFullView(plan, p.x, p.z), `${p.kind} on rock that fades (seen through)`).toBe(true);
        } else if (p.kind === 'cobweb') {
          expect(inFullView(plan, p.x - 1, p.z) && inFullView(plan, p.x, p.z - 1), 'a cobweb hung on rock that fades').toBe(true);
        } else for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) expect(isFloor(plan, x, z), `${p.kind} on the floor`).toBe(true);
      }
    }
  });

  it('are gone down into from the spot before the stairs: its name and level told, walked through, never into the rock, climbed out of', () => {
    const { model, crypt } = crypts[0];
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    expect(model.doorInReach).toBe(crypt.entrance);
    model.takeEvents();
    expect(model.useDoor()).toBe(true);
    expect(model.inside?.entrance).toBe(crypt.entrance);
    expect(model.takeEvents()).toContainEqual({ kind: 'arrive', name: crypt.name, level: crypt.level });
    const { plan } = cryptInside(model.seed, crypt.entrance);
    const start = { x: model.hero.x, z: model.hero.z };
    for (let t = 0; t < 6; t += FRAME) {
      model.update(0, -1, FRAME); // on up the corridor
      expect(isFloor(plan, Math.round(model.hero.x), Math.round(model.hero.z))).toBe(true);
    }
    expect(start.z - model.hero.z).toBeGreaterThan(3);
    for (let t = 0; t < 4; t += FRAME) model.update(1, 0, FRAME); // into the side wall: stopped by the rock
    expect(isFloor(plan, Math.round(model.hero.x), Math.round(model.hero.z))).toBe(true);
    // Back to the foot of the stairs, and out.
    Object.assign(model.hero, start);
    expect(model.doorInReach).toBe(crypt.entrance);
    expect(model.useDoor()).toBe(true);
    expect(model.inside).toBeNull();
    expect(Math.hypot(model.hero.x - crypt.entrance.x, model.hero.z - crypt.entrance.z)).toBeLessThan(0.01);
  });

  it('keeps the hero down there in a save, walled in as before', () => {
    const { model, crypt } = crypts[1];
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.useDoor();
    model.update(0, -1, 0.5);
    const at = { x: model.hero.x, z: model.hero.z };
    const loaded = new GameModel(model.seed, MID);
    restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(loaded.inside?.entrance.type).toBe('crypt');
    expect(loaded.hero.x).toBeCloseTo(at.x, 1);
    expect(loaded.inside?.walls).toBeDefined();
  });

  it('is drawn: its floor, rock, tombs and lights built into a scene, and freed again', () => {
    const { model, crypt } = crypts[0] as { model: GameModel; crypt: Crypt };
    const built = buildCryptScene(cryptInside(model.seed, crypt.entrance));
    expect(built.scene.children.length).toBeGreaterThan(10);
    built.seeHero(3, 3);
    built.update(1);
    built.dispose();
  });
});

it('(test worlds have their ruins too: a crypt in each)', () => {
  const model = new GameModel(TEST_SEEDS[0], { width: 96, depth: 96 });
  expect(model.crypts.length).toBe(model.ruins.length);
});
