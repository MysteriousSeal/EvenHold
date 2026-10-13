// A ghost of someone (model/spells/turned.ts), about the place it was turned in, in the real game on every test seed
// (support/charmStage.ts): out of doors, in a house, in an inn, down a crypt, a cave and a stronghold. Ten minutes
// of it, each time: never more than ROAM from where it was turned, never out of its room, never off a dungeon's open
// floor, never anywhere but the place it was turned in; in no one's way (the ground under it as open as it was, the
// hero walking through it); and nothing to strike or pick out, a blow swung at it harming no one.
import { describe, expect, it } from 'vitest';
import { scene, type Where } from './support/charmStage';
import { FRAME, TEST_SEEDS } from './support/testWorld';
import { ATTACK_DURATION } from '../src/model/constants';
import { peopleAbout } from '../src/model/hero/selection';
import { castSpell } from '../src/model/spells/casting';
import { GAIT, ROAM } from '../src/model/spells/turned';

const PLACES: readonly Where[] = ['wolf', 'villager in', 'barkeep', 'crypt', 'cave', 'stronghold'];

describe('a ghost of someone', () => {
  for (const where of PLACES)
    it(`turned at ${where}: ten minutes about the place, never past ROAM, never out of it`, () => {
      let seen = 0;
      for (const seed of TEST_SEEDS) {
        const made = scene(seed, where);
        if (!made) continue;
        seen++;
        const { model, place } = made;
        const said = `seed ${seed}`;
        expect(castSpell(model, 'ghost'), said).toBe('cast');
        const ghost = model.chickens.hens[0];
        const [at, from, room] = [ghost.at, { ...ghost.from }, model.inside?.room];
        Object.assign(model.hero, { x: ghost.x, z: ghost.z }); // (the hero stood in it: no bar to it, out of a dungeon)
        let [far, gone] = [0, 0];
        for (let t = 0; t < 600; t += 0.1) {
          const [x, z] = [ghost.x, ghost.z];
          model.chickens.update(0.1);
          gone += Math.hypot(ghost.x - x, ghost.z - z);
          far = Math.max(far, Math.hypot(ghost.x - from.x, ghost.z - from.z));
          expect(Math.hypot(ghost.x - x, ghost.z - z), said).toBeLessThanOrEqual(GAIT.ghost.pace * 0.1 + 1e-9); // (never faster than it drifts)
          if (place === 'room') expect(ghost.x > -0.5 && ghost.z > -0.5 && ghost.x < room!.width - 0.5 && ghost.z < room!.depth - 0.5, said).toBe(true);
          if (place === 'dungeon') expect(model.dungeon!.free(ghost.x, ghost.z, 0.05), said).toBe(true);
        }
        expect(far, said).toBeLessThanOrEqual(ROAM + 1e-6);
        expect([ghost.at, ghost.from, model.chickens.here], said).toEqual([at, from, [ghost]]);
        if (place !== 'dungeon') expect(gone, said).toBeGreaterThan(5); // (and it does drift: down a dungeon the hero stood on it holds it)
      }
      expect(seen).toBeGreaterThan(5);
    });

  it('is in no one\'s way, and nothing to strike or pick out', () => {
    for (const seed of TEST_SEEDS) {
      const { model, who } = scene(seed, 'wolf')!;
      const { hero } = model;
      const said = `seed ${seed}`;
      const stood = { x: who.x, z: who.z };
      model.enemies.length = 0; // (no one else about: a blow's for the ghost alone)
      model.enemies.push(who as never);
      model.focus(who.id);
      expect(castSpell(model, 'ghost'), said).toBe('cast');
      const ghost = model.chickens.hens[0];
      ghost.peck = 1e9; // (held where it is)
      expect(model.isBlocked(stood.x, stood.z, 0.2), said).toBe(!model.isOpenTile(Math.round(stood.x), Math.round(stood.z)) && model.isBlocked(stood.x, stood.z, 0.2)); // (no more shut than the ground under it)
      // Nothing to turn the focus to, no one to pick out.
      model.cycleFocus();
      expect([model.focused, peopleAbout(model).some((p) => p.id === who.id && p.x === ghost.x)], said).toEqual([null, false]);
      // A blow swung through it: no one harmed, nothing told of a hit, the ghost as it was.
      Object.assign(hero, { x: stood.x, z: stood.z - 0.5, facing: 0 });
      model.takeEvents();
      const was = JSON.stringify(ghost);
      expect(model.startAttack(), said).toBe(true);
      for (let t = 0; t < ATTACK_DURATION + 0.2; t += FRAME) model.update(0, 0, FRAME);
      expect(model.takeEvents().filter((e) => e.kind === 'hit'), said).toEqual([]);
      expect(JSON.stringify({ ...ghost, peck: 1e9 }), said).toBe(was.replace(/"peck":[^,]+/, '"peck":1000000000'));
      // The hero walks straight through where it is, as over open ground.
      if ([-1, 0, 1].every((d) => model.isOpenTile(Math.round(stood.x), Math.round(stood.z) + d) && !model.isBlocked(stood.x, stood.z + d * 0.8, 0.2))) {
        Object.assign(hero, { x: stood.x, z: stood.z - 0.8 });
        for (let t = 0; t < 3; t += FRAME) model.update(0, 1, FRAME);
        expect(hero.z, said).toBeGreaterThan(stood.z + 0.5);
      }
    }
  });
});
