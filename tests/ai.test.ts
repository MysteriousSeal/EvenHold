// The AI's game (tests/ai/): what it sees is the size it says and all numbers; every key and way is safe to press in
// any order (a life at random, no crash); its windows work the game as a player's clicks do (a point spent, a quest
// taken from the board with the game held); the trainer's server answers in shape.
import { describe, expect, it } from 'vitest';
import { ACTIONS, MOVES, OBSERVATION_SIZE, Player } from './ai/player';
import { KEYS } from './ai/keys';
import { boardSpot } from '../src/model/quests/noticeBoards';
import { mulberry32 } from '../src/util/random';

describe("the AI's game", () => {
  it('sees what it says it sees: as many numbers as promised, all of them finite', () => {
    const player = new Player();
    const seen = player.reset(3);
    expect(seen.length).toBe(OBSERVATION_SIZE);
    expect(seen.every((n) => Number.isFinite(n))).toBe(true);
    expect(ACTIONS).toBe(KEYS.length);
  });

  it('survives a life of keys at random, time passing and the tally kept', () => {
    const player = new Player();
    const rng = mulberry32(99);
    player.reset(5);
    let reward = 0;
    for (let i = 0; i < 900; i++) {
      const step = player.step(Math.floor(rng() * MOVES), Math.floor(rng() * ACTIONS));
      expect(step.observation.length).toBe(OBSERVATION_SIZE);
      expect(Number.isFinite(step.reward)).toBe(true);
      reward += step.reward;
    }
    expect(player.seconds).toBeGreaterThan(60); // (windows that hold the game hold it a few decisions at most)
    expect(Object.values(player.tally.keys).reduce((a, b) => a + b, 0)).toBe(900);
    expect(JSON.stringify(player.tally).length).toBeGreaterThan(100);
    expect(Number.isFinite(reward)).toBe(true);
  }, 60_000);

  it('spends a point from its window, and takes a quest from the board with the game held', () => {
    const player = new Player();
    player.reset(7);
    const { model } = player;
    model.hero.statPoints = 1;
    player.step(0, KEYS.indexOf('points'));
    expect(player.window?.kind).toBe('points');
    player.step(0, KEYS.indexOf('row0'));
    expect(model.hero.statPoints).toBe(0);
    expect(player.tally.pointsSpent).toBe(1);
    player.step(0, KEYS.indexOf('close'));
    expect(player.window).toBeNull();
    // Before a board: E opens it, the game held; a row takes its quest; Escape shuts it and time goes on.
    const spot = boardSpot(model, model.world.villageNumber(model.villages[0]))!;
    model.teleport(spot.x + spot.front.dx * 0.55, spot.z + spot.front.dz * 0.55); // (just out from its face)
    for (let i = 0; i < 30 && model.boardInReach === null; i++) model.update(0, 0, 1 / 30);
    expect(model.boardInReach).not.toBeNull();
    player.step(0, KEYS.indexOf('use'));
    expect(player.window?.kind).toBe('board');
    const t = player.seconds;
    player.step(3, KEYS.indexOf('row0'));
    expect(player.seconds).toBe(t); // (held)
    expect(player.tally.quests.taken).toBe(1);
    expect(model.quests.taken.length).toBe(1);
    player.step(0, KEYS.indexOf('close'));
    player.step(0, 0);
    expect(player.seconds).toBeGreaterThan(t);
  });

  it('is paid a little for new ground (up to its cap), and for blows landed, each kept apart from the game\'s own pay', () => {
    const player = new Player();
    player.reset(11);
    // Straight on one way: new patches, paid for each, never past the cap; none of the game's own pay for walking.
    for (let i = 0; i < 400; i++) player.step(5, 0);
    const { pay } = player.tally;
    expect(pay.explore).toBeGreaterThan(0);
    expect(pay.explore).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(pay.quest).toBe(0);
    // A foe set beside it and struck: its blows paid, the share of its health lost.
    const { model } = player;
    const foe = model.foes.find((e) => e.state !== 'dead')!;
    Object.assign(foe, { x: model.hero.x, z: model.hero.z + 0.8, state: 'chase' });
    player.step(0, 0);
    const before = player.tally.pay.blows;
    foe.hp -= foe.maxHp / 2;
    player.step(0, 0);
    expect(player.tally.pay.blows - before).toBeCloseTo(0.15, 2);
  }, 60_000);
});
