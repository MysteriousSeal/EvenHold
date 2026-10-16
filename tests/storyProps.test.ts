// What the first arc leaves at its ruin (model/story/storyProps.ts): a grave post once the hero's sent up to it, plated in
// iron after the smith's quest, three blue candles by it after the watch; nothing before.
import { describe, expect, it } from 'vitest';
import { storyProps, graveOf, type StoryState } from '../src/model/story/storyProps';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE } from './support/testWorld';

const ARC = ['whereSheBurned', 'herNameInIron', 'candlesForTheWatch'];
// The story with the first `done` of the arc done (and the one after them taken).
const upTo = (done: number): StoryState => ({
  stateOf: (id) => (ARC.indexOf(id) < done ? 'done' : ARC.indexOf(id) === done ? 'taken' : 'locked'),
  did: (id) => ARC.indexOf(id) >= 0 && ARC.indexOf(id) < done,
});
const kinds = (state: StoryState, ruin: Parameters<typeof storyProps>[1]) => storyProps(state, ruin).map((p) => p.kind);

describe("the first arc's marks at its ruin", () => {
  const model = new GameModel(7, TEST_MAP_SIZE);
  const ruin = model.story.people?.ruin ?? model.ruins[0];

  it('come as each quest is done, and not before', () => {
    const none: StoryState = { stateOf: () => 'offered', did: () => false };
    expect(kinds(none, ruin)).toEqual([]);
    expect(kinds(upTo(0), ruin)).toEqual(['gravePost']); // (sent up to stand by it: there)
    expect(kinds(upTo(1), ruin)).toEqual(['gravePost']);
    expect(kinds(upTo(2), ruin)).toEqual(['ironPost']);
    expect(kinds(upTo(3), ruin)).toEqual(['ironPost', 'blueCandle', 'blueCandle', 'blueCandle']);
    expect(kinds(upTo(3), null)).toEqual([]);
  });

  it('stand in the ruin, by its grave, on the game\'s own story too', () => {
    const grave = graveOf(ruin);
    expect(grave.x).toBeGreaterThan(ruin.x);
    expect(grave.x).toBeLessThan(ruin.x + ruin.w - 1);
    expect(grave.z).toBeGreaterThan(ruin.z);
    expect(grave.z).toBeLessThan(ruin.z + ruin.d - 1);
    for (const p of storyProps(upTo(3), ruin)) expect(Math.hypot(p.x - grave.x, p.z - grave.z)).toBeLessThan(0.6);
    expect(storyProps(model.story, ruin)).toEqual([]); // (a new game: nothing yet)
  });
});
