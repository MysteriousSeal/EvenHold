// What E would do right now, worked out in one place: the first of these that's there to be done. The game's own E
// (controller/GameController.ts: it does it), the prompt over it (main.ts: it words it) and whatever else plays by
// the keys (tests/ai/senses.ts) all read it here, so none can tell it differently from another.
// In order: at work (a shift), the work's own thing in reach, else the inn's notice board, and nothing else; chopping
// a tree, stopping; a line out, hooking a bite (or reeling in); loot in reach; an inn's notice board (its work); a chest; the inn's strongbox (or the let room's chest); the carter by his wagon; a tree to chop; a lake's shore, to fish from;
// sat on a bar stool by the barmaid, a word with her; sat, standing up; a seat in reach, sitting; someone to talk to
// (not at the way out: out first); a traveller on the road; a village's notice board; the smithy's salvage bench, its anvil; a cauldron to brew at; a
// fire to cook at (skills/cooking.ts); a well; a door upstairs; the stairs; a door; any villager, for a word; and, with nothing else, a tree that
// can't be chopped yet, a shore with no rod to fish it (told why).
// `skip`: kinds to pass over (the game's E, tried and come to nothing: a full bag's loot, a seat taken: the next).
import type { GameModel } from '../GameModel';
import type { Entrance } from '../interiors/interiors';
import type { Furniture, Seat } from '../interiors/furniture';
import { doorAt, stairsInReach } from '../interiors/upstairs';
import { chestInReach } from '../loot/chests';
import { strongboxInReach } from './stash';
import type { GroundLoot } from '../loot/loot';
import { talkingTo } from '../npcs/talk';
import { acrossTheBar, patronBeside } from '../inn/barPatrons';
import { villagerInReach } from '../npcs/chat';
import type { Npc } from '../npcs/npcs';
import type { ChopAction } from '../skills/lumber';
import type { MineAction } from '../skills/mining';
import type { PickAction } from '../skills/herbalism';
import type { FishAction } from '../skills/fishing';
import type { Fire } from '../skills/cooking';
import type { Carter } from '../story/carter';
import { travellerInReach } from '../travellers/travellerTalk';
import type { Traveller } from '../travellers/travellers';

export type Interaction =
  | { kind: 'work' } // at work: what the shift has to hand (jobs/work.ts action)
  | { kind: 'jobBoard'; inn: Entrance } // an inn's notice board: its work (at work: the shift, to check or end)
  | { kind: 'stopChop' }
  | { kind: 'stopMine' }
  | { kind: 'stopPick' }
  | { kind: 'fishing' } // a line out: a bite hooked, or reeled in (skills/fishing.ts)
  | { kind: 'loot'; loot: GroundLoot }
  | { kind: 'chest'; chest: NonNullable<ReturnType<typeof chestInReach>> }
  | { kind: 'strongbox'; box: Furniture } // the inn's strongbox, or the let room's chest: the hero's stash (hero/stash.ts)
  | { kind: 'carter'; carter: Carter }
  | { kind: 'chop'; action: ChopAction }
  | { kind: 'mine'; action: MineAction }
  | { kind: 'pick'; action: PickAction }
  | { kind: 'fish'; action: FishAction }
  | { kind: 'talk'; npc: Npc; fromStool: boolean }
  | { kind: 'stand'; seat: Seat }
  | { kind: 'sit'; seat: Seat }
  | { kind: 'traveller'; traveller: Traveller }
  | { kind: 'board'; board: number }
  | { kind: 'bench'; bench: Furniture }
  | { kind: 'anvil'; anvil: Furniture }
  | { kind: 'cauldron'; cauldron: Furniture }
  | { kind: 'fire'; fire: Fire }
  | { kind: 'well'; village: number }
  | { kind: 'hallDoor'; door: Furniture }
  | { kind: 'stairs'; down: boolean }
  | { kind: 'door'; door: Entrance; leaving: boolean }
  | { kind: 'cannotChop'; action: ChopAction }
  | { kind: 'cannotFish'; action: FishAction }
  | { kind: 'cannotMine'; action: MineAction }
  | { kind: 'cannotPick'; action: PickAction };
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
  if (model.mining.striking) return void (yield { kind: 'stopMine' });
  if (model.herbs.picking) return void (yield { kind: 'stopPick' });
  if (fishing.line) return void (yield { kind: 'fishing' });
  const loot = model.lootInReach;
  yield loot ? { kind: 'loot', loot } : null;
  yield notice();
  const chest = chestInReach(model);
  yield chest ? { kind: 'chest', chest } : null;
  const box = strongboxInReach(model);
  yield box ? { kind: 'strongbox', box } : null;
  const carter = model.story.carterInReach;
  yield carter ? { kind: 'carter', carter } : null;
  const chop = lumber.action;
  yield chop?.kind === 'chop' ? { kind: 'chop', action: chop } : null;
  const mine = model.mining.action;
  yield mine?.kind === 'mine' ? { kind: 'mine', action: mine } : null;
  const fish = fishing.action;
  yield fish?.kind === 'fish' ? { kind: 'fish', action: fish } : null;
  const herb = model.herbs.action;
  yield herb?.kind === 'pick' ? { kind: 'pick', action: herb } : null;
  // Stood before a smithy's salvage bench or anvil: to work at it, before a word with the smith passing or behind his
  // counter (within a word of either in most smithies; a step off, he's spoken to).
  const bench = model.salvage.benchInReach;
  yield bench ? { kind: 'bench', bench } : null;
  const anvil = model.smithing.anvilInReach;
  yield anvil ? { kind: 'anvil', anvil } : null;
  const cauldron = model.alchemy.cauldronInReach; // (a herbalist's, the hero's own: to brew at, before a word with whoever stirs it)
  yield cauldron ? { kind: 'cauldron', cauldron } : null;
  const talker = talkingTo(model.folk, inside, hero) ?? model.story.askerInReach; // the barmaid, the smith (of the villagers round about); else a villager with something to ask
  const seated = model.seated;
  const atTheBar = seated?.seat.piece.kind === 'barStool';
  const beside = atTheBar && inside ? patronBeside(model.folk, inside.entrance, hero) : null; // (a word with the patron next to them: npcs/chat.ts)
  const first = !!talker && (talker.role === 'barkeep' ? acrossTheBar(talker, hero) : talker.role === 'villager'); // (before the neighbour: the barmaid right across from them, or someone with a quest to give)
  const atBar = first || !beside ? talker : beside;
  yield atTheBar && atBar ? { kind: 'talk', npc: atBar, fromStool: true } : null;
  yield seated ? { kind: 'stand', seat: seated.seat } : null;
  const seat = seated ? null : model.seatInReach;
  yield seat ? { kind: 'sit', seat } : null;
  const leaving = !!inside && !!model.doorInReach; // (at the way out: out, before a word with whoever stands by it)
  yield talker && !leaving ? { kind: 'talk', npc: talker, fromStool: false } : null;
  const traveller = !inside && !model.yard ? travellerInReach(model.travellers.list, hero) : null;
  yield traveller ? { kind: 'traveller', traveller } : null;
  const board = model.boardInReach;
  yield board !== null ? { kind: 'board', board } : null;
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
  yield mine?.kind === 'cannot' ? { kind: 'cannotMine', action: mine } : null;
  yield herb?.kind === 'cannot' ? { kind: 'cannotPick', action: herb } : null;
}
