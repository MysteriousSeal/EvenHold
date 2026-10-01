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
import { FACINGS } from '../src/model/map/grid';
import { floorReached, rockJoined, solidTiles } from './support/cryptChecks';
import { parseSave, restore, snapshot } from '../src/model/save';
import { buildCryptScene } from '../src/view/crypt/cryptView';
import { FRAME, TEST_SEEDS } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const models = [1, 2, 3].map((seed) => new GameModel(seed, MID));
const crypts = models.flatMap((model) => model.crypts.map((crypt) => ({ model, crypt })));

// Every floor tile reached from the foot of the stairs, round what's solid; and how many are open.
function reached(plan: CryptPlan, props: readonly CryptProp[]): { reached: number; open: number } {
  const solid = solidTiles(props);
  return { reached: floorReached(plan, solid).size, open: plan.floor.reduce((a, b) => a + b, 0) - solid.size };
}

describe('crypts', () => {
  it('have a way down in every ruin: a tomb on four blocked tiles inside it, its stairs two side by side, the spot before it open, of the zone\'s level, named', () => {
    for (const model of models) {
      expect(model.crypts.length).toBe(model.ruins.length);
      for (const c of model.crypts) {
        const { ruin, stairs, entrance } = c;
        expect(stairs.x).toBeGreaterThan(ruin.x);
        expect(stairs.x).toBeLessThan(ruin.x + ruin.w - 1);
        expect(c.steps).toHaveLength(2); // the stairs two wide, side by side across the way down; the tomb the two behind
        expect(Math.abs(c.steps[1].x - c.steps[0].x) + Math.abs(c.steps[1].z - c.steps[0].z)).toBe(1);
        expect(Math.abs(c.steps[1].x - c.steps[0].x)).toBe(Math.abs(entrance.outZ));
        expect(c.tiles).toEqual([...c.steps, ...c.steps.map((t) => ({ x: t.x - entrance.outX, z: t.z - entrance.outZ }))]);
        for (const t of c.tiles) expect(model.heightMap[t.x][t.z]).toBe(model.heightMap[stairs.x][stairs.z]); // level
        for (const t of c.tiles) expect(model.isOpenTile(t.x, t.z)).toBe(false); // blocked: down with E, not walked into
        for (const t of c.steps) expect(model.isOpenTile(t.x + entrance.outX, t.z + entrance.outZ)).toBe(true); // the ground before the stairs open
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
      // No island of rock: all of it joined to the rock round the crypt.
      expect(rockJoined(plan) + tiles).toBe(plan.width * plan.depth);
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
      expect(['skeleton', 'slumped', 'bones'].some((k) => kinds.has(k as CryptProp['kind'])), 'the dead').toBe(true);
      for (const p of props) {
        if (p.kind === 'sconce' || p.kind === 'niche') {
          expect(isFloor(plan, p.x, p.z), `${p.kind} in the rock`).toBe(false);
          const [ox, oz] = FACINGS[p.facing];
          expect(isFloor(plan, p.x + ox, p.z + oz), `${p.kind} facing the floor`).toBe(true);
          expect(inFullView(plan, p.x, p.z), `${p.kind} on rock that fades (seen through)`).toBe(true);
        } else if (p.kind === 'slumped') {
          const [ox, oz] = FACINGS[p.facing];
          expect(inFullView(plan, p.x - ox, p.z - oz), 'slumped against rock in full view').toBe(true); // (its back to it)
        } else if (p.kind === 'cobweb') {
          expect(inFullView(plan, p.x - 1, p.z) && inFullView(plan, p.x, p.z - 1), 'a cobweb hung on rock that fades').toBe(true);
        } else for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) expect(isFloor(plan, x, z), `${p.kind} on the floor`).toBe(true);
      }
    }
  });

  it('are gone down into from the spot before the stairs: its name and level told, walked through, never into the rock, climbed out of', () => {
    const { model, crypt } = crypts[0];
    // In reach before either of the stairs' two tiles, not off to the side of them.
    const { entrance: e } = crypt;
    for (const t of crypt.steps) {
      model.teleport(t.x + e.outX * 0.62, t.z + e.outZ * 0.62);
      expect(model.doorInReach).toBe(e);
    }
    const [ax, az] = [Math.abs(e.outZ), Math.abs(e.outX)];
    model.teleport(e.x + ax * 1.6, e.z + az * 1.6);
    expect(model.doorInReach).toBeNull();
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
    // Back to the foot of the stairs, and out: before either of their two tiles (door and door + 1).
    for (const x of [plan.door, plan.door + 1]) {
      Object.assign(model.hero, { x, z: start.z });
      expect(model.doorInReach).toBe(crypt.entrance);
    }
    Object.assign(model.hero, { x: plan.door + 2, z: start.z });
    expect(model.doorInReach).toBeNull();
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
