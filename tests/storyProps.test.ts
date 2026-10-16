// What the first arc leaves in the world (model/story/storyProps.ts): a grave post at its ruin once the hero's sent up to
// it, plated in iron after the smith's quest, three blue candles by it after the watch; a slab over its crypt's top step
// once nothing comes up; the men in grey at the camp from campedInTheAshes till silverToTheWell; nothing before.
import { describe, expect, it } from 'vitest';
import { firstArcPlaces, graveOf, storyProps, type StoryState } from '../src/model/story/storyProps';
import { GameModel } from '../src/model/GameModel';

const ARC = ['whereSheBurned', 'herNameInIron', 'campedInTheAshes', 'candlesForTheWatch', 'upHisStairs', 'whatTheyWerePaidIn', 'silverToTheWell'];
// The story with the first `done` of the arc done (and the one after them taken).
const upTo = (done: number): StoryState => ({
  stateOf: (id) => (ARC.indexOf(id) < done ? 'done' : ARC.indexOf(id) === done ? 'taken' : 'locked'),
  did: (id) => ARC.indexOf(id) >= 0 && ARC.indexOf(id) < done,
});
const count = (props: ReturnType<typeof storyProps>) => {
  const n: Record<string, number> = {};
  for (const p of props) n[p.kind] = (n[p.kind] ?? 0) + 1;
  return n;
};

describe("the first arc's marks in the world", () => {
  const model = new GameModel(7, { width: 256, depth: 256 });
  const at = firstArcPlaces(model);

  it('are found on the game: its ruin, the crypt under it, its village\'s camp', () => {
    expect(at.ruin).not.toBeNull();
    expect(at.crypt?.ruin).toBe(at.ruin);
    expect(at.camp).toBeDefined();
    expect(at.camp).not.toBeNull();
    expect(storyProps(model.story, at)).toEqual([]); // (a new game: nothing yet)
  });

  it('come as each quest is done, and the men in grey go once the silver is in the well', () => {
    expect(storyProps({ stateOf: () => 'offered', did: () => false }, at)).toEqual([]);
    expect(count(storyProps(upTo(0), at))).toEqual({ gravePost: 1 }); // (sent up to stand by it: there)
    expect(count(storyProps(upTo(2), at))).toEqual({ ironPost: 1, greyHood: 4, coveredCart: 1, mule: 2 }); // (camped: from the quest taken)
    expect(count(storyProps(upTo(4), at))).toEqual({ ironPost: 1, blueCandle: 3, greyHood: 4, coveredCart: 1, mule: 2 });
    expect(count(storyProps(upTo(5), at))).toEqual({ ironPost: 1, blueCandle: 3, stepSlab: 1, greyHood: 4, coveredCart: 1, mule: 2 });
    expect(count(storyProps(upTo(7), at))).toEqual({ ironPost: 1, blueCandle: 3, stepSlab: 1 }); // (gone after)
  });

  it('stand where they belong: by the grave, on the stairs, round the camp\'s fire and out past its gate', () => {
    const props = storyProps(upTo(5), at);
    const grave = graveOf(at.ruin!);
    for (const p of props.filter((p) => p.kind === 'blueCandle' || p.kind === 'ironPost')) expect(Math.hypot(p.x - grave.x, p.z - grave.z)).toBeLessThan(0.6);
    const slab = props.find((p) => p.kind === 'stepSlab')!;
    expect(Math.min(...at.crypt!.steps.map((s) => Math.hypot(s.x - slab.x, s.z - slab.z)))).toBeCloseTo(0.5, 5);
    const camp = at.camp!;
    for (const h of props.filter((p) => p.kind === 'greyHood')) {
      expect(Math.hypot(h.x - camp.x, h.z - camp.z)).toBeLessThan(1.5); // (inside, round the fire)
      expect(camp.pieces.some((piece) => piece.kind !== 'fire' && piece.kind !== 'palisade' && Math.round(h.x) === piece.x && Math.round(h.z) === piece.z), 'on a tent or crates').toBe(false);
    }
    const out = (p: { x: number; z: number }) => (p.x - camp.x) * (camp.way.x - camp.x) + (p.z - camp.z) * (camp.way.z - camp.z);
    for (const p of props.filter((p) => p.kind === 'coveredCart' || p.kind === 'mule')) {
      expect(out(p)).toBeGreaterThan(out(camp.way)); // (beyond the gate)
      expect(model.isOpenTile(Math.round(p.x), Math.round(p.z)), `${p.kind} at ${p.x},${p.z}`).toBe(true);
    }
  });
});

describe("the first arc's marks, drawn", () => {
  it('each kind a look of its own, at a sensible size (a grave post knee-to-chest high, a man in grey a man\'s height, a slab flat)', async () => {
    const { storyPropGeometry } = await import('../src/view/meshes/story/storyPropsView');
    const tall = { gravePost: [0.8, 1], ironPost: [0.8, 1], blueCandle: [0.2, 0.35], stepSlab: [0.05, 0.12], greyHood: [0.9, 1.05], coveredCart: [0.8, 0.95], mule: [0.6, 0.75] } as const;
    for (const [kind, [lo, hi]] of Object.entries(tall) as Array<[keyof typeof tall, readonly [number, number]]>) {
      const g = storyPropGeometry(kind);
      g.computeBoundingBox();
      const box = g.boundingBox!;
      expect(g.getAttribute('position').count, kind).toBeGreaterThan(0);
      expect(box.min.y, kind).toBeCloseTo(0, 5);
      expect(box.max.y, kind).toBeGreaterThanOrEqual(lo);
      expect(box.max.y, kind).toBeLessThanOrEqual(hi);
    }
  });
});
