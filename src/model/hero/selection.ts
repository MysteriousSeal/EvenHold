// Whoever the hero has picked out that isn't a foe (a click on them, or Tab where there are no foes to turn to): a
// villager, a keeper, someone met on the road. Shown as a foe is (their frame by the hero's, the brackets at their
// feet), and no more than that: nothing aimed at a foe (a blow, a harmful spell: spells/casting.ts) is ever aimed at
// them. One or the other, a foe focused (focus.ts) or someone picked out: GameModel lets go the one for the other.
// Let go once they're far off, or no longer where the hero is (gone indoors, or the hero out).
import { FOCUS_RANGE } from '../constants';
import type { Entrance } from '../interiors/interiors';
import type { Npc } from '../npcs/npcs';
import type { Traveller } from '../travellers/travellers';

export type Person = Npc | Traveller;
type At = { hero: { x: number; z: number }; inside: { entrance: Entrance } | null };
const far = (p: Person, hero: { x: number; z: number }) => Math.hypot(p.x - hero.x, p.z - hero.z);
const here = (p: Person, at: At) => p.where === (at.inside?.entrance ?? null) && far(p, at.hero) <= FOCUS_RANGE;

export class Selection {
  person: Person | null = null;

  select(who: Person | null): void {
    this.person = who;
  }

  keep(at: At): void {
    if (this.person && !here(this.person, at)) this.person = null;
  }
}

export interface Selecting extends At {
  readonly folk: readonly Npc[];
  readonly travellers: { readonly list: readonly Traveller[] };
  readonly dungeon?: unknown;
  readonly chosen: Selection;
  select(who: Person | null): void;
}

// Those about who may be picked out: the villagers where the hero is, and outdoors those on the road, near enough.
export function peopleAbout(model: Selecting): Person[] {
  if (model.dungeon) return [];
  const people: Person[] = [...model.folk, ...(model.inside ? [] : model.travellers.list)];
  return people.filter((p) => here(p, model));
}

// On to the next of them, nearest first (Tab), or back; round again past the last; none about, let go.
export function cyclePeople(model: Selecting, back = false): void {
  const near = peopleAbout(model).sort((a, b) => far(a, model.hero) - far(b, model.hero) || a.id - b.id);
  if (near.length === 0) return model.select(null);
  const now = model.chosen.person ? near.indexOf(model.chosen.person) : -1;
  model.select(near[now < 0 ? (back ? near.length - 1 : 0) : (now + (back ? -1 : 1) + near.length) % near.length]);
}
