// The quests people give, as written (model/story/quests/): every one of them sound before it's ever set in a world.
// No two of a name; what one follows is there, and of its own kind; what it asks for and gives exists; whoever takes
// in something that was asked of another has their own word for "not yet"; every line said is a whole sentence.
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/model/human/equipment';
import { LOOT } from '../src/model/loot/loot';
import { COMMON_QUESTS, FIRST_QUESTS, RARE_QUESTS, ROAD_QUESTS, STORY_QUESTS } from '../src/model/story/quests/catalog';
import type { StoryQuest, StoryRole, Told } from '../src/model/story/storyQuests';

const all = [...FIRST_QUESTS, ...COMMON_QUESTS, ...RARE_QUESTS, ...ROAD_QUESTS];
const told: Told = { village: 'Rookwick', giver: 'Ada', receiver: 'Bram', next: 'Thornby', barmaid: 'Cwen', smith: 'Osric', carter: 'Dunn', camp: "Red Hugh's camp", axe: true };
const ON_THE_ROAD: StoryRole[] = ['pedlar', 'pilgrim', 'guard'];
const said = (q: StoryQuest): string[] => [...q.offer(told), ...q.offer({ ...told, axe: false }), ...q.waiting(told), ...(q.pending?.(told) ?? []), ...q.after(told), ...q.handIn(told)];

describe('the quests people give, as written', () => {
  it('are each of a name of their own, in the list of their kind', () => {
    expect(Object.keys(STORY_QUESTS).length).toBe(all.length);
    expect([FIRST_QUESTS.length, COMMON_QUESTS.length, RARE_QUESTS.length, ROAD_QUESTS.length]).toEqual([30, 22, 30, 3]);
    expect(FIRST_QUESTS.every((q) => q.scope === 'first')).toBe(true);
    expect([...COMMON_QUESTS, ...RARE_QUESTS].every((q) => q.scope === 'village' && !ON_THE_ROAD.includes(q.giver) && q.giver !== 'carter')).toBe(true);
    expect(ROAD_QUESTS.every((q) => q.scope === 'road' && ON_THE_ROAD.includes(q.giver) && !q.receiver)).toBe(true);
  });

  it('follow only one of their own kind; the rare ones are rare', () => {
    for (const q of all) {
      if (q.follows) expect(STORY_QUESTS[q.follows]?.scope, `${q.id} after ${q.follows}`).toBe(q.scope);
      if (q.share !== undefined) expect(q.share > 0 && q.share <= 1, q.id).toBe(true);
    }
    expect(FIRST_QUESTS.slice(1).every((q, i) => q.follows === FIRST_QUESTS[i].id)).toBe(true); // (one line, in order)
    for (const q of RARE_QUESTS) expect(q.follows ? (q.share ?? 0) <= 0.35 : q.share! <= 0.35, q.id).toBe(true);
    expect(COMMON_QUESTS.every((q) => !q.follows || COMMON_QUESTS.some((c) => c.id === q.follows))).toBe(true); // (never waiting on a rare one)
  });

  it('ask for, and give, things there are', () => {
    for (const q of all) {
      if (q.needs?.kind === 'bring') expect(LOOT[q.needs.item], `${q.id} asks`).toBeDefined();
      if (q.needs && 'count' in q.needs) expect(q.needs.count, q.id).toBeGreaterThan(0);
      if (q.gift && 'gear' in q.gift) expect(ITEMS[q.gift.gear], `${q.id} gives`).toBeDefined();
      else if (q.gift) expect(LOOT[q.gift.item], `${q.id} gives`).toBeDefined();
      if (q.stake && 'item' in q.stake) expect(LOOT[q.stake.item], `${q.id} hands over`).toBeDefined();
      expect(q.copper >= 0 && q.xpShare > 0, q.id).toBe(true);
    }
  });

  it('are said in whole sentences, by whoever is speaking', () => {
    for (const q of all) {
      // Handed in to someone other than the giver, with something still to do first: their own "not yet".
      if (q.receiver && q.receiver !== q.giver && q.needs) expect(q.pending, `${q.id}: ${q.receiver}'s word while it's not ready`).toBeDefined();
      if (q.receiver) expect(q.handIn(told).length, `${q.id} handed in`).toBeGreaterThan(0);
      const lines = said(q);
      expect(lines.length, q.id).toBeGreaterThan(2);
      for (const line of lines) {
        expect(line, q.id).not.toMatch(/undefined|\[object|\$\{/);
        expect(line, `${q.id}: "${line}"`).toMatch(/^["'A-Z(.].*[.!?'"]$/);
      }
      for (const short of [q.name, q.accept, q.decline, q.task(told)]) expect(short.trim().length, q.id).toBeGreaterThan(2);
      if (q.receiver) expect(q.thanks.trim().length, `${q.id} thanks`).toBeGreaterThan(2);
    }
  });
});
