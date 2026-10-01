// The inns' bouncers (inn/bouncer.ts): one to each inn, in his own studded
// leathers, at his post by the door with a round of the room now and then, with a gruff word or two.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BOUNCER_LINES, bouncerSpeaks, postOf } from '../src/model/inn/bouncer';
import { gearOf, ITEMS, type ItemId } from '../src/model/human/equipment';
import { titleOf } from '../src/model/npcs/npcs';
import { roomFree } from '../src/model/npcs/npcWalk';
import { talkingTo } from '../src/model/npcs/talk';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const KIT: ItemId[] = ['studdedJerkin', 'studdedBracers', 'beltedTrousers', 'ironCapBoots', 'bandedCudgel'];

describe('bouncers', () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  const inns = model.entrances.filter((e) => e.type === 'inn');
  const bouncerOf = (inn: (typeof inns)[number]) => model.npcs.find((n) => n.role === 'bouncer' && n.home === inn)!;

  it('one to every inn: a man, hair cropped or shaved, in his own kit, called "(Bouncer)"', () => {
    expect(inns.length).toBeGreaterThan(0);
    for (const inn of inns) {
      const b = bouncerOf(inn);
      expect(b.look.build).toBe('male');
      expect(['cropped', 'bald']).toContain(b.look.hairStyle);
      expect(Object.values(b.equipment).sort()).toEqual([...KIT].sort());
      expect(titleOf(b)).toBe(`${b.name} (Bouncer)`);
    }
  });

  it('wears what no one sells, and bandits never pick it', () => {
    for (const id of KIT.filter((id) => id !== 'beltedTrousers')) {
      expect(ITEMS[id].soldBy, id).toBeUndefined();
      expect(ITEMS[id].wornBy?.bandit, id).toBeUndefined();
    }
    expect(Object.values(gearOf('bandit')).flat().map(([id]) => id)).not.toContain('studdedJerkin');
  });

  it('keeps to his post beside the door, facing in, and now and then makes a short round of the room', () => {
    const inn = inns[0];
    const b = bouncerOf(inn);
    model.teleport(inn.x, inn.z);
    expect(model.useDoor()).toBe(true);
    const { room } = model.inside!;
    const post = postOf(b, model.seed);
    expect(Math.abs(post.x - room.door)).toBe(1); // right beside the door, off the way in
    expect(post.z).toBe(room.depth - 1); // back to the front wall
    const free = roomFree(model.seed, inn);
    const furniture = model.inside!.furniture;
    let [atPost, away, longestAway, rounds] = [0, 0, 0, 0];
    for (let t = 0; t < 300; t += FRAME * 2) {
      model.update(0, 0, FRAME * 2);
      expect(b.where).toBe(inn);
      expect(b.seat).toBeNull();
      expect(bumpsFurniture(furniture, b.x, b.z, 0.02), `in the furniture at ${b.x.toFixed(2)},${b.z.toFixed(2)}`).toBe(false);
      if (b.steps[0]?.kind === 'wait') expect(free(b.x, b.z), `stood behind the bar at ${b.x.toFixed(2)},${b.z.toFixed(2)}`).toBe(true);
      const there = Math.hypot(b.x - post.x, b.z - post.z) < 0.3;
      if (there) {
        if (away > 0) [rounds, longestAway, away] = [rounds + 1, Math.max(longestAway, away), 0];
        atPost += FRAME * 2;
      } else away += FRAME * 2;
    }
    expect(atPost / 300).toBeGreaterThan(0.6); // mostly at his post
    expect(rounds).toBeGreaterThanOrEqual(2); // but he makes his rounds
    expect(longestAway).toBeLessThan(25); // short ones (about 15 s)
  });

  it('can be spoken to, and has a gruff word each time (a different one)', () => {
    const inn = inns[0];
    const b = bouncerOf(inn);
    if (model.inside?.entrance !== inn) {
      model.teleport(inn.x, inn.z);
      model.useDoor();
    }
    model.hero.x = b.x + 0.5;
    model.hero.z = b.z;
    expect(talkingTo(model.npcs, model.inside, model.hero)).toBe(b);
    model.takeEvents();
    bouncerSpeaks(b);
    bouncerSpeaks(b);
    const said = model.takeEvents().filter((e) => e.kind === 'say').map((e) => (e as { text: string }).text);
    expect(said).toHaveLength(2);
    for (const line of said) expect(BOUNCER_LINES).toContain(line);
    expect(said[0]).not.toBe(said[1]);
  });
});
