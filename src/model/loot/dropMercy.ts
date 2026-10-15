// A mercy for what a story quest wants brought (story/story.ts wantedItems: a faded locket off the ruin's ghosts, old
// silver off the crypt's draugr): while it's wanted, each kill of a foe that carries it and leaves none makes the next
// the likelier (MERCY_STEP more each time), so the odds can't strand a player; one left, the count starts over. Not
// kept in a save (a load starts it over: the odds as they were, never worse).
import { hashUnit } from '../../util/random';
import { LOOT, type LootId, type LootSource } from './loot';

export const MERCY_STEP = 0.07; // the chance of it, more for each kill without it

export class DropMercy {
  private readonly misses = new Map<LootId, number>();

  // A foe of `source`'s family slain, leaving `dropped` (its own roll, `rolled`): what's wanted of what it carries, left
  // besides by mercy, or null.
  roll(source: LootSource, wanted: readonly LootId[], dropped: LootId | null, rolled: number): LootId | null {
    for (const item of wanted) {
      if (!LOOT[item]?.droppedBy[source]) continue;
      if (dropped === item) {
        this.misses.delete(item);
        continue;
      }
      const missed = (this.misses.get(item) ?? 0) + 1;
      if (hashUnit(rolled, missed, 99) < missed * MERCY_STEP) {
        this.misses.delete(item);
        return item;
      }
      this.misses.set(item, missed);
    }
    return null;
  }
}
