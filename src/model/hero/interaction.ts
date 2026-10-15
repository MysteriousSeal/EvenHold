// What E would do right now, worked out in one place: the first of these that's there to be done. The game's own E
// (controller/GameController.ts: it does it), the prompt over it (main.ts: it words it) and whatever else plays by
// the keys (tests/ai/senses.ts) all read it here, so none can tell it differently from another.
// In order: at work (a shift), the work's own thing in reach, else the inn's notice board, and nothing else; chopping
// a tree, stopping; a line out, hooking a bite (or reeling in); loot in reach; an inn's notice board (its work); a chest; the carter by his wagon; a tree to chop; a lake's shore, to fish from;
// sat on a bar stool by the barmaid, a word with her; sat, standing up; a seat in reach, sitting; someone to talk to
// (not at the way out: out first); a traveller on the road; a village's notice board; the smithy's salvage bench; a
// fire to cook at (skills/cooking.ts); a well; a door upstairs; the stairs; a door; any villager, for a word; and, with nothing else, a tree that
// can't be chopped yet, a shore with no rod to fish it (told why).
// `skip`: kinds to pass over (the game's E, tried and come to nothing: a full bag's loot, a seat taken: the next).
import type { GameModel } from '../GameModel';
import type { Entrance } from '../interiors/interiors';
import type { Furniture, Seat } from '../interiors/furniture';
import { doorAt, stairsInReach } from '../interiors/upstairs';
import { chestInReach } from '../loot/chests';
import type { GroundLoot } from '../loot/loot';
import { talkingTo } from '../npcs/talk';
import { villagerInReach } from '../npcs/chat';
import type { Npc } from '../npcs/npcs';
import type { ChopAction } from '../skills/lumber';
import type { FishAction } from '../skills/fishing';
import type { Fire } from '../skills/cooking';
import type { Carter } from '../story/carter';
import { travellerInReach } from '../travellers/travellerTalk';
import type { Traveller } from '../travellers/travellers';

export type Interaction =
  | { kind: 'work' } // at work: what the shift has to hand (jobs/work.ts action)
  | { kind: 'jobBoard'; inn: Entrance } // an inn's notice board: its work (at work: the shift, to check or end)
  | { kind: 'stopChop' }
  | { kind: 'fishing' } // a line out: a bite hooked, or reeled in (skills/fishing.ts)
  | { kind: 'loot'; loot: GroundLoot }
  | { kind: 'chest'; chest: NonNullable<ReturnType<typeof chestInReach>> }
  | { kind: 'carter'; carter: Carter }
  | { kind: 'chop'; action: ChopAction }
  | { kind: 'fish'; action: FishAction }
  | { kind: 'talk'; npc: Npc; fromStool: boolean }
  | { kind: 'stand'; seat: Seat }
  | { kind: 'sit'; seat: Seat }
  | { kind: 'traveller'; traveller: Traveller }
  | { kind: 'board'; board: number }
  | { kind: 'bench'; bench: Furniture }
  | { kind: 'fire'; fire: Fire }
  | { kind: 'well'; village: number }
  | { kind: 'hallDoor'; door: Furniture }
  | { kind: 'stairs'; down: boolean }
  | { kind: 'door'; door: Entrance; leaving: boolean }
  | { kind: 'cannotChop'; action: ChopAction }
  | { kind: 'cannotFish'; action: FishAction };
export type InteractionKind = Interaction['kind'];

export function interactionOf(model: GameModel, skip?: ReadonlySet<InteractionKind>): Interaction | null {
  for (const found of candidates(model)) if (found && !skip?.has(found.kind)) return found;
  return null;
}

// Each thing E might do, in order, looked for only as far as the first that's there (and not passed over).
function* candidates(model: GameModel): Generator<Interaction | null> {
  const { hero, inside, work, lumber, fishing } = model;
  const notice = () => (work.noticeInReach ? ({ kind: 'jobBoard', inn: work.noticeInReach } as const) : null);
  if (work.shift) {
    if (work.held) return; // (someone coming into their room, or going: nothing to do but watch)
    yield work.action ? { kind: 'work' } : null;
    yield notice();
    if (work.shift.job === 'innCompanion' && inside) {
      // (Work done in a room upstairs: the stairs and the hallway's doors, to get to it.)
      const hallDoor = inside.below ? doorAt(inside, hero) : null;
      yield hallDoor ? { kind: 'hallDoor', door: hallDoor } : null;
      yield stairsInReach(inside, hero) ? { kind: 'stairs', down: !!inside.below } : null;
    }
    return; // (at work: nothing else: no doors, no seats, no talk)
  }
  if (lumber.chopping) return void (yield { kind: 'stopChop' });
  if (fishing.line) return void (yield { kind: 'fishing' });
  const loot = model.lootInReach;
  yield loot ? { kind: 'loot', loot } : null;
  yield notice();
  const chest = chestInReach(model);
  yield chest ? { kind: 'chest', chest } : null;
  const carter = model.story.carterInReach;
  yield carter ? { kind: 'carter', carter } : null;
  const chop = lumber.action;
  yield chop?.kind === 'chop' ? { kind: 'chop', action: chop } : null;
  const fish = fishing.action;
  yield fish?.kind === 'fish' ? { kind: 'fish', action: fish } : null;
  const talker = talkingTo(model.folk, inside, hero) ?? model.story.askerInReach; // the barmaid, the smith (of the villagers round about); else a villager with something to ask
  const seated = model.seated;
  yield talker && seated?.seat.piece.kind === 'barStool' ? { kind: 'talk', npc: talker, fromStool: true } : null;
  yield seated ? { kind: 'stand', seat: seated.seat } : null;
  const seat = seated ? null : model.seatInReach;
  yield seat ? { kind: 'sit', seat } : null;
  const leaving = !!inside && !!model.doorInReach; // (at the way out: out, before a word with whoever stands by it)
  yield talker && !leaving ? { kind: 'talk', npc: talker, fromStool: false } : null;
  const traveller = !inside && !model.yard ? travellerInReach(model.travellers.list, hero) : null;
  yield traveller ? { kind: 'traveller', traveller } : null;
  const board = model.boardInReach;
  yield board !== null ? { kind: 'board', board } : null;
  const bench = model.salvage.benchInReach;
  yield bench ? { kind: 'bench', bench } : null;
  const fire = model.cooking.fireInReach;
  yield fire ? { kind: 'fire', fire } : null;
  const well = model.wellInReach;
  yield well !== null ? { kind: 'well', village: well } : null;
  const hallDoor = inside?.below ? doorAt(inside, hero) : null;
  yield hallDoor ? { kind: 'hallDoor', door: hallDoor } : null;
  yield inside && stairsInReach(inside, hero) ? { kind: 'stairs', down: !!inside.below } : null;
  const door = model.doorInReach;
  yield door ? { kind: 'door', door, leaving: !!inside } : null;
  const chatter = seated ? null : villagerInReach(model); // (any villager, for a word: npcs/chat.ts; after everything else, no door nor seat lost to one passing)
  yield chatter ? { kind: 'talk', npc: chatter, fromStool: false } : null;
  yield chop?.kind === 'cannot' ? { kind: 'cannotChop', action: chop } : null;
  yield fish?.kind === 'cannot' ? { kind: 'cannotFish', action: fish } : null;
}
