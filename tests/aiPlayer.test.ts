// The whole game as a player learning it plays it (tests/ai/player.ts), kept working as the game changes: what's seen
// always its fixed size; a life the same every time from its seed; the keys doing as the game's do (E before a notice
// board takes its next quest, and hands it in there once done; eat eats); and paid for what it should be (ground
// walked into; a quest's steps, once each), and paying for what it should (being hurt, keys pressed for nothing).
import { describe, expect, it } from 'vitest';
import { OBSERVATION_SIZE, Player } from './ai/player';
import { noticeBoards } from '../src/model/quests/noticeBoards';
import { questProgress } from '../src/model/quests/quests';

const E = 4;
const EAT = 5;

describe("the player's game", () => {
  it('sees a fixed row of numbers, and plays a life the same every time from its seed', () => {
    const [a, b] = [new Player(), new Player()];
    const [first, again] = [a.reset(3), b.reset(3)];
    expect(first).toHaveLength(OBSERVATION_SIZE);
    expect(again).toEqual(first);
    for (let i = 0; i < 60; i++) {
      const [sa, sb] = [a.step(1 + (i % 8), i % 7), b.step(1 + (i % 8), i % 7)];
      expect(sa.observation).toHaveLength(OBSERVATION_SIZE);
      expect(sb).toEqual(sa);
    }
  });

  it('is paid for ground not walked before; pays for being hurt, a step into a wall, and E with nothing to do', () => {
    const player = new Player();
    player.reset(1);
    const { model } = player;
    // (open ground some way off: a patch not walked into yet)
    const [x, z] = (() => {
      for (let d = 20; d < 200; d++) for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (model.isOpenTile(Math.round(model.hero.x + dx * d), Math.round(model.hero.z + dz * d))) return [Math.round(model.hero.x + dx * d), Math.round(model.hero.z + dz * d)];
      throw new Error('no open ground');
    })();
    model.teleport(x, z);
    expect(player.step(0, 0).reward).toBeGreaterThan(0);
    expect(player.step(0, 0).reward).toBe(0); // (the same patch again: nothing)
    model.hero.hp -= 2;
    expect(player.step(0, 0).reward).toBeLessThan(0);
    expect(player.step(0, E).reward).toBeLessThan(0); // (no prompt: E for nothing)
  });

  it("E before a notice board takes its next quest, and hands it in there once it's done", () => {
    const player = new Player();
    player.reset(2);
    const { model } = player;
    const spot = noticeBoards(model)[0];
    model.teleport(spot.x + spot.front.dx * 0.6, spot.z + spot.front.dz * 0.6); // (where one stands to read it, as the bots do)
    expect(model.boardInReach).not.toBeNull();
    player.step(0, E);
    expect(model.quests.taken).toHaveLength(1);
    const taken = model.quests.taken[0];
    if (taken.quest.kind === 'kill') taken.kills = taken.quest.count;
    else model.hero.bag[taken.quest.item!] = taken.quest.count;
    expect(questProgress(taken.quest, model.quests.progress(taken)).text).toBeTruthy();
    const step = player.step(0, E);
    expect(step.info.quests).toBe(1);
    expect(step.info.taken).toBe(1);
    expect(step.reward).toBeGreaterThan(1); // (the quest, and its experience; its steps besides)
  });

  it('eats from the bag with its key', () => {
    const player = new Player();
    player.reset(4);
    const { hero } = player.model;
    hero.bag.bread = 2;
    hero.hp = 1;
    player.step(0, EAT);
    expect(hero.bag.bread).toBe(1);
  });
});
