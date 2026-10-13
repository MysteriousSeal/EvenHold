// Someone's sex changed by a charm (spells.ts: cast at whoever's picked out): a villager or keeper, someone on the
// road, a bandit or their chief; no one else (no beast, none of the dead, not the hero). Their body the other build's,
// their hair one of its styles, a beard gone or (half of them) grown, a name of the other sex's; what they wear the
// same, cut for them; what they're called by their trade following (npcs.ts titleOf: a barmaid a barman). For good:
// cast on them again, they're as they were. Kept in a save by who's changed (each made afresh as the seed has them,
// then changed again: `remade`, as the world's made or a region of it is).
// Told as it happens ('swapped': how it happens is the view's to play, view/cinema/stagings/swapStaging.ts).
import { hashUnit } from '../../util/random';
import { STYLES_OF, type BodyLook } from '../human/humanoid';
import { nameAt, type Npc } from '../npcs/npcs';
import type { Traveller } from '../travellers/travellers';
import type { Enemy, GameEvent } from '../types';
import { isWorldFoe } from '../enemies/foeIds';
import { humanOf, isFoe, isNpc, type Being } from './beings';

type Kind = 'n' | 't' | 'f'; // a villager, a traveller, a foe
const kindOf = (being: Being): Kind => (isFoe(being) ? 'f' : isNpc(being) ? 'n' : 't');
const keyOf = (being: Being): string => `${kindOf(being)}:${being.id}`;
const body = humanOf; // (whose body it is: beings.ts)
// Whether two looks are the same in every part (someone made anew has a look of their own: never the very same one).
const sameLook = (a: BodyLook, b: BodyLook): boolean => a === b || (Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as Array<keyof BodyLook>).every((part) => a[part] === b[part]));
// What's told where the charm's cast at what has no man's or woman's body to change (a beast, the dead that walk): none
// where it's who they are (slain, only passing through), or where it may be cast.
export const whyNoSwap = (being: Being): string | null => (isFoe(being) && being.state !== 'dead' && !being.human ? 'It finds neither man nor woman there.' : null);

// Whether `being` may be changed: someone with a human body of their own, not only passing through.
export const maySwap = (being: Being): boolean => (isFoe(being) ? being.state !== 'dead' && !!being.human : !('led' in being && being.led));

// The look of the other sex, for the one numbered `id`: the same skin, hair colour and dye; a style of that sex's; a
// beard for half the men, none for a woman.
export function otherLook(look: BodyLook, id: number, seed: number): BodyLook {
  const build = look.build === 'male' ? 'female' : 'male';
  const styles = STYLES_OF[build];
  return { ...look, build, hairStyle: styles[Math.floor(hashUnit(id, seed % 1_000_003, 211) * styles.length)], beard: build === 'male' && hashUnit(id, seed % 1_000_003, 212) < 0.5 };
}

export interface SwapHost {
  readonly seed: number;
  readonly npcs: readonly Npc[];
  readonly enemies: readonly Enemy[];
  readonly travellers: { readonly list: readonly Traveller[] };
  report(event: GameEvent): void;
}

export class Swaps {
  private readonly changed = new Set<string>(); // who's changed, by kind and number
  private readonly was = new Map<string, { look: BodyLook; name?: string }>(); // as each was before (while they're about)

  constructor(private readonly host: SwapHost) {}

  // Changed (or, changed already, back as they were): whether they were.
  swap(being: Being): boolean {
    const whose = body(being);
    if (!whose || !maySwap(being)) return false;
    const before = { look: whose.look, equipment: { ...whose.equipment }, name: isFoe(being) ? undefined : being.name };
    this.turn(being);
    this.host.report({ kind: 'swapped', who: being, before });
    return true;
  }

  has = (being: Being): boolean => (isFoe(being) && !isWorldFoe(being.id) ? !!this.passing.get(being) : this.changed.has(keyOf(being)));
  private readonly passing = new WeakMap<Being, BodyLook | null>(); // a dungeon's foes changed: each one's look before (null: back as they were)

  private turn(being: Being): void {
    const [key, whose] = [keyOf(being), body(being)!];
    // A dungeon's own (made afresh each time the hero goes down, numbered alike in every one of its kind): changed
    // while they stand there, and back at a second cast, but none of it kept.
    if (isFoe(being) && !isWorldFoe(being.id)) {
      const before = this.passing.get(being);
      this.passing.set(being, before ? null : whose.look);
      whose.look = before ?? otherLook(whose.look, being.id, this.host.seed);
      return;
    }
    const was = this.was.get(key);
    if (this.changed.has(key) && was) {
      // Back as they were.
      whose.look = was.look;
      if (!(isFoe(being)) && was.name) being.name = was.name;
      this.changed.delete(key);
      this.was.delete(key);
      return;
    }
    this.was.set(key, { look: whose.look, name: isFoe(being) ? undefined : being.name });
    whose.look = otherLook(whose.look, being.id, this.host.seed);
    if (!(isFoe(being))) being.name = nameAt(being.id * 13 + 5, being.id * 7 + 3, this.host.seed + 57, whose.look.build);
    this.changed.add(key);
  }

  // Those just made (a world, a region of it, a save taken up): the changed among them, changed again.
  remade(beings: readonly Being[]): void {
    for (const being of beings) {
      const key = keyOf(being);
      if (this.changed.has(key) && !this.was.has(key) && body(being)) [this.changed.delete(key), this.turn(being)];
      else if (this.was.has(key) && body(being) && sameLook(body(being)!.look, this.was.get(key)!.look)) [this.changed.delete(key), this.was.delete(key), this.turn(being)]; // (made anew, as the seed has them: a look of their own, the same as they first had)
    }
  }

  save(): string[] {
    return [...this.changed];
  }

  load(saved: unknown): void {
    this.changed.clear();
    this.was.clear();
    for (const key of Array.isArray(saved) ? saved : []) if (typeof key === 'string' && /^[ntf]:\d+$/.test(key)) this.changed.add(key);
    this.remade([...this.host.npcs, ...this.host.enemies, ...this.host.travellers.list]);
  }
}
