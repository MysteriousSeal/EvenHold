// What E does (model/hero/interaction.ts): one reckoning, read by the game's E, the prompt and the AI alike. Nothing in
// reach: nothing; the carter by his wagon; loot before him; a chopping tree's stop before all; at work, the work's and
// the notice board's alone; and a kind passed over (tried, come to nothing) gives the next.
import { describe, expect, it } from 'vitest';
import { interactionOf } from '../src/model/hero/interaction';
import { fresh } from './support/testWorld';
import { enterNearest } from '../src/model/cheats';

describe('what E does', () => {
  it('is nothing with nothing in reach, and the carter by his wagon', () => {
    const model = fresh();
    const { carter } = model.story.people!;
    model.teleport(carter.x - 6, carter.z + 6);
    const found = interactionOf(model);
    expect(found === null || found.kind === 'cannotChop' || found.kind === 'chop').toBe(true); // (open ground: at most a tree)
    model.teleport(carter.x - 1, carter.z + 0.3);
    expect(interactionOf(model)).toMatchObject({ kind: 'carter', carter });
  });

  it('puts loot in reach before him, and gives the next when a kind is passed over', () => {
    const model = fresh();
    const { carter } = model.story.people!;
    model.teleport(carter.x - 1, carter.z + 0.3);
    model.ground.loot.push({ id: 9001, item: 'birchLog', x: model.hero.x, y: model.hero.y, z: model.hero.z } as never);
    expect(interactionOf(model)?.kind).toBe('loot');
    expect(interactionOf(model, new Set(['loot']))?.kind).toBe('carter');
    expect(interactionOf(model, new Set(['loot', 'carter']))?.kind).not.toBe('carter');
  });

  it('indoors, is the way out at the door, a seat by a seat; sat, standing up', () => {
    const model = fresh();
    expect(enterNearest(model, 'inn', new Set())).toBe(true);
    expect(interactionOf(model)).toMatchObject({ kind: 'door', leaving: true });
    const stool = model.inside!.furniture.find((f) => f.kind === 'chair' || f.kind === 'armchair' || f.kind === 'barStool')!;
    for (const [dx, dz] of [[0, 0.3], [0.3, 0], [0, -0.3], [-0.3, 0], [0, 0]]) {
      Object.assign(model.hero, { x: stool.x + dx, z: stool.z + dz });
      if (model.seatInReach) break;
    }
    if (model.seatInReach) {
      expect(['sit', 'talk']).toContain(interactionOf(model)!.kind);
      expect(model.sitOrStand()).toBe(true);
      expect(['stand', 'talk']).toContain(interactionOf(model)!.kind); // (on a bar stool by the barmaid: a word with her first)
      expect(interactionOf(model, new Set(['talk']))?.kind).toBe('stand');
    }
  });

  it('at work is the work\'s alone: no door, no seat, no talk', () => {
    const model = fresh();
    expect(enterNearest(model, 'inn', new Set())).toBe(true);
    const inn = model.inside!.entrance;
    expect(model.work.start(inn, 'innServer')).toBe(true);
    const found = interactionOf(model);
    expect(found === null || found.kind === 'work' || found.kind === 'jobBoard').toBe(true);
    expect(interactionOf(model, new Set(['work', 'jobBoard']))).toBeNull();
    model.work.end(true);
  });
});
