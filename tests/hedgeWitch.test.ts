// @vitest-environment happy-dom
// A village's hedge-witch (model/npcs/hedgeWitch.ts): one in every herbalist's hut, a woman, on a free tile clear of
// the door, the counter and where the herbalist stands to work, staying there as time passes; spoken to
// ("Learn from …"); her window (controller/trade/charmPanel.ts) teaching a charm at a click, for its price.
import { describe, expect, it, vi } from 'vitest';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { witchPost } from '../src/model/npcs/hedgeWitch';
import { roomFree } from '../src/model/npcs/npcWalk';
import { talkPrompt, talkingTo } from '../src/model/npcs/talk';
import { titleOf } from '../src/model/npcs/npcs';
import { SPELLS, knows } from '../src/model/spells/spells';
import { createCharmPanel } from '../src/controller/trade/charmPanel';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

describe('a hedge-witch', () => {
  it("keeps to a free corner of every herbalist's hut, clear of the door and the counter", () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const herbalists = model.npcs.filter((n) => n.role === 'herbalist');
      const witches = model.npcs.filter((n) => n.role === 'hedgewitch');
      expect(herbalists.length).toBeGreaterThan(0);
      expect(witches.map((w) => w.home)).toEqual(herbalists.map((h) => h.home));
      expect(new Set(model.npcs.map((n) => n.id)).size).toBe(model.npcs.length); // (each their own number)
      for (const witch of witches) {
        expect(witch.look.build).toBe('female');
        expect(titleOf(witch)).toBe(`${witch.name} (Hedge-witch)`);
        const post = witchPost(witch, seed);
        const { room, furniture } = layoutOf(seed, witch.home);
        expect(roomFree(seed, witch.home)(post.x, post.z)).toBe(true);
        expect(Math.hypot(post.x - room.door, post.z - (room.depth - 1))).toBeGreaterThan(1.5);
        const counter = furniture.find((f) => f.kind === 'herbCounter')!;
        // (Nor where the herbalist stands to work at any of her pieces: before each; beside one on the left wall.)
        for (const piece of furniture.filter((f) => ['cauldron', 'herbTable', 'dryingRack', 'potionShelf'].includes(f.kind))) {
          const spot = piece.wall === 'left' ? { x: piece.x + piece.w, z: piece.z + (piece.d - 1) / 2 } : { x: piece.x + (piece.w - 1) / 2, z: piece.z + piece.d };
          expect(Math.hypot(post.x - spot.x, post.z - spot.z), `${piece.kind} (seed ${seed})`).toBeGreaterThan(0.9);
        }
        expect(Math.abs(post.z - counter.z) > 1 || post.x < counter.x - 1 || post.x > counter.x + counter.w).toBe(true); // (not in its rows)
      }
    }
  });

  it('stays at her place as time passes, and is spoken to there', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const witch = model.npcs.find((n) => n.role === 'hedgewitch')!;
    const herbalist = model.npcs.find((n) => n.role === 'herbalist' && n.home === witch.home)!;
    model.teleport(witch.home.x, witch.home.z);
    model.useDoor();
    expect(model.inside?.entrance).toBe(witch.home);
    const post = witchPost(witch, model.seed);
    for (let t = 0; t < 60; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect(Math.hypot(witch.x - post.x, witch.z - post.z)).toBeLessThan(0.2);
    expect(herbalist.where).toBe(witch.home);
    Object.assign(model.hero, { x: witch.x, z: witch.z + 1 });
    expect(talkingTo([witch], model.inside, model.hero)).toBe(witch);
    expect(talkPrompt(witch)).toBe(`Learn from ${witch.name}`);
  });

  it('teaches a charm from her window at a click, for its price; known, it says so', () => {
    document.body.replaceChildren();
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const witch = model.npcs.find((n) => n.role === 'hedgewitch')!;
    const panel = createCharmPanel(model);
    model.hero.money = 100;
    panel.open(witch);
    expect(document.body.textContent).toContain(SPELLS.hex.name);
    document.querySelector<HTMLElement>('.menu-slot')!.click();
    expect(knows(model.hero, 'hex')).toBe(true);
    expect(model.hero.money).toBe(100 - SPELLS.hex.price);
    expect(document.body.textContent).toContain('Known');
    document.querySelector<HTMLElement>('.menu-slot')!.click();
    expect(model.hero.money).toBe(100 - SPELLS.hex.price); // (not paid for twice)
    panel.update(); // (the hero nowhere near her: it shuts)
    expect(panel.menu.isOpen).toBe(false);
  });
});
