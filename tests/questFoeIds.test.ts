// Quest foes' ids (quests/questBook.ts): a streamed world's, however many quests gathered for in one sitting, clear of
// every dungeon's block (crypts', caves', strongholds', the reliquary's, the haunting's risen), the bounties' and the
// world's own.
import { expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { boardNumber } from '../src/model/quests/quests';
import { BOUNTY_FOE_ID } from '../src/model/quests/bounties';
import { isWorldFoe } from '../src/model/enemies/foeIds';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';

it("a streamed world's quest foes' ids keep clear of the dungeons' after three hundred quests in one sitting", () => {
  const model = new GameModel(7, STREAMED_SIZE);
  const slots = (model.quests as unknown as { slots: Map<string, number> }).slots;
  for (let i = 0; i < 300; i++) slots.set(`gone:${i}`, slots.size); // (as if three hundred gathered for already)
  const quest = model.quests.offersAt(boardNumber(model, 0)).find((q) => q.kind === 'kill')!;
  expect(model.quests.accept(quest)).toBe(true);
  const marked = model.enemies.filter((e) => model.quests.marked(e));
  expect(marked.length).toBeGreaterThan(0);
  for (const { id } of marked) {
    expect(id >= 10_000_000, `${id}: in a dungeon's block`).toBe(true); // (theirs all short of 1e7)
    expect(id < BOUNTY_FOE_ID && !isWorldFoe(id)).toBe(true);
  }
});
