// The quests people give, and how they stand. Each is written once (storyQuests.ts, villageQuests.ts, roadQuests.ts)
// and set wherever its people are (storyCast.ts): the first village's line, every village's own, the road's. Kept by
// a key, the quest's and where it's set ("scrapForTheForge@8201", "wordToTheInn@first", "wolvesAtMyHeels@road").
// Someone with one to give has a "!" over their head; taken, whoever it's handed in to has a "?" (grey while what it
// asks is still to do, gold once it's ready); a word with either opens the talk scene (controller/story/
// talkPanel.ts), which shows what `talk` says. What a quest asks is kept count of here (foes slain, a place reached,
// a camp cleared, a shift worked, a wish made: the game's own events; what's to be brought: the bag's). One that
// follows another is on offer only once that one's done. One with no one to go back to is done, and paid, the moment
// what it asks is. Paid in coin and experience by its village's level, some with a gift besides. Saved with the game.
import { addToBag, takeFromBag, type BagItem } from '../hero/bag';
import { canCarry } from '../hero/bagSlots';
import { gainXp, xpToNext } from '../hero/heroStats';
import { ITEMS } from '../human/equipment';
import { rollGear } from '../human/items/gear';
import { sleepTillMorning } from '../inn/roomLetting';
import type { Entrance } from '../interiors/interiors';
import { LOOT } from '../loot/loot';
import type { Npc } from '../npcs/npcs';
import type { Ruin } from '../ruins/ruins';
import type { Traveller } from '../travellers/travellers';
import type { Enemy, GameEvent, Hero } from '../types';
import { hashUnit, mulberry32 } from '../../util/random';
import type { Carter } from './carter';
import { RARE_QUESTS } from './rareQuests';
import { ROAD_QUESTS } from './roadQuests';
import { castKey, castOf, type CastHost, type Setting, type Who } from './storyCast';
import { FIRST_QUESTS, type Gift, type StoryPlace, type StoryQuest, type Told } from './storyQuests';
import { VILLAGE_QUESTS } from './villageQuests';
import { BAWDY_QUESTS } from './bawdyQuests';

export type { Who } from './storyCast';
export type StoryMark = 'offer' | 'waiting' | 'ready'; // "!", a grey "?", a gold "?"
export interface Talk {
  speaker: string;
  lines: string[];
  quest?: { name: string; task: string; copper: number; xp: number; gift: string; state: 'offered' | 'handIn' }; // the quest it's about, shown under the lines
  night?: boolean; // a night passes before its last line (the screen gone black, then the morning)
  answers: Array<{ label: string; primary?: boolean; trade?: boolean; pick(): void }>; // the hero's (none: just "Farewell"; `trade`: on to their wares)
}
// A quest under way, as the tracker and the journal tell it.
export interface TakenStory {
  id: string; // its key
  name: string;
  task: string;
  ready: boolean;
  tracked: boolean;
  have: number; // of what it asks: how far along (1 of 1, where it asks nothing)
  of: number;
  to: Carter | Npc | null; // who it's handed in to (no one: done as what it asks is; or off the maps just now)
  toName: string;
  fromName: string;
  door: Entrance | null; // the building they're in, if they're indoors
  goal: { x: number; z: number } | null; // where what it still asks is to be done, or (ready) where to go back to, if they're off the maps
  within: Entrance | null; // the building what it still asks is done in (a shift: the inn), if it's indoors
}

export const STORY_QUESTS: Record<string, StoryQuest> = Object.fromEntries([...Object.values(FIRST_QUESTS), ...VILLAGE_QUESTS, ...BAWDY_QUESTS, ...RARE_QUESTS, ...ROAD_QUESTS].map((q) => [q.id, q]));
const REACH = 1.7; // tiles from the carter, or a villager, for a word
// Where a foe's kind keeps, for those that keep to a place: pointed to while none of them is in sight.
const LAIR: Partial<Record<string, StoryPlace>> = { ghost: 'ruin', skeleton: 'ruin', skeletonArcher: 'ruin', draugr: 'ruin', cryptLord: 'ruin', bandit: 'camp', banditChief: 'camp', caveSpider: 'cave', caveBat: 'cave', caveWorm: 'cave', broodMother: 'cave' };
const FOE_SEEN = 90; // tiles: a quest's foes this near the hero are pointed to
const PER_LEVEL = 0.25; // more coin, a level of the village's over the first
const idOf = (key: string): string => key.split('@')[0];
const keyed = (id: string): string => (id.includes('@') ? id : `${id}@first`); // (a bare name: the first village's)
const isTraveller = (who: Who): who is Traveller => 'road' in who;
const hasTrade = (who: Who): boolean => 'role' in who && (who.role === 'barkeep' || who.role === 'smith' || who.role === 'herbalist' || who.role === 'pedlar');

export interface StoryHost extends CastHost {
  readonly hero: Hero;
  minutes: number; // the game's clock (a night spent: on to the morning)
  readonly folk: readonly Npc[];
  readonly enemies: readonly Enemy[];
  readonly entrances: readonly Entrance[];
  readonly inside: { entrance: Entrance } | null;
  readonly quests?: { trackRoom: boolean }; // the boards' quests: whether the screen takes one more tracked
  readonly lumber?: { axe: boolean }; // whether they've an axe to chop with (what's said of it)
  report(event: GameEvent): void;
}

interface Instance {
  key: string;
  quest: StoryQuest;
  at: Setting | null; // where it's set (the road's: nowhere)
}

export class Story {
  private state = new Map<string, 'taken' | 'done'>();
  private untracked = new Set<string>(); // those taken but kept off the screen's tracker (set in the journal)
  private counted = new Map<string, number>(); // what's been done toward each taken one (foes slain; a place reached, a thing done: 1)
  private kept = new Map<string, { to: string; from: string; x: number; z: number }>(); // each taken one's people and village, for when they're off the maps
  private world: { key: string; first: Setting | null; firstRuin: Ruin | null; all: Map<string, Instance>; by: Map<object, Instance[]>; road: Instance[] } | null = null;

  constructor(private readonly host: StoryHost) {}

  // Every quest as it's set in the world that's on the maps, and whose they are (found again only as the world changes).
  private get set(): NonNullable<Story['world']> {
    const key = castKey(this.host);
    if (this.world?.key === key) return this.world;
    const { first, firstRuin, villages } = castOf(this.host);
    const all = new Map<string, Instance>();
    const by = new Map<object, Instance[]>();
    const add = (quest: StoryQuest, at: Setting | null) => {
      const needs = quest.needs;
      const [giver, receiver] = [at?.who[quest.giver], quest.receiver ? at?.who[quest.receiver] : undefined];
      if (at && (!giver || (quest.receiver && !receiver) || (needs?.kind === 'reach' && !at.place[needs.place]) || (needs?.kind === 'slay' && LAIR[needs.foe] && !at.place[LAIR[needs.foe]!]) || (needs?.kind === 'do' && needs.what === 'clearCamp' && !at.place.camp))) return;
      const instance = { key: `${quest.id}@${at?.key ?? 'road'}`, quest, at };
      all.set(instance.key, instance);
      for (const who of new Set([giver, receiver])) if (who) by.set(who, [...(by.get(who) ?? []), instance]);
    };
    if (first) for (const quest of Object.values(FIRST_QUESTS)) add(quest, first);
    for (const at of villages) [...VILLAGE_QUESTS, ...BAWDY_QUESTS].forEach((quest, i) => hashUnit(Number(at.key), i, this.host.seed + 9173) < (quest.share ?? 1) && add(quest, at));
    // (The rare ones: few villages each; one that follows another, only where that one is.)
    for (const at of villages) RARE_QUESTS.forEach((quest, i) => hashUnit(Number(at.key), i, this.host.seed + 40127) < (quest.share ?? 1) && (!quest.follows || all.has(`${quest.follows}@${at.key}`)) && add(quest, at));
    for (const quest of ROAD_QUESTS) add(quest, null);
    return (this.world = { key, first, firstRuin, all, by, road: [...all.values()].filter((i) => !i.at) });
  }

  // The first village's people (the line a new game opens with), once they're all on the maps.
  get people(): { carter: Carter; barmaid: Npc; smith: Npc | null; village: Setting['village']; inn: Entrance; ruin: Ruin | null } | null {
    const { first, firstRuin } = this.set;
    return first && first.inn ? { carter: first.who.carter as Carter, barmaid: first.who.barmaid as Npc, smith: (first.who.smith as Npc) ?? null, village: first.village, inn: first.inn, ruin: firstRuin } : null;
  }

  // Those a quest is `who`'s: given by them, or handed in to them (someone on the road: their calling's).
  private of(who: Who): Instance[] {
    return isTraveller(who) ? this.set.road.filter((i) => i.quest.giver === who.role) : (this.set.by.get(who) ?? []);
  }

  private told(i: Instance, giver?: Who): Told {
    const { at, quest } = i;
    const name = (role: StoryQuest['giver'] | undefined, or: string) => (role && at?.who[role]?.name) || or;
    const from = at ? name(quest.giver, 'someone') : (giver?.name ?? 'a traveller');
    return {
      village: at?.names.village ?? 'the road', giver: from, receiver: name(quest.receiver, from), next: at?.names.next ?? 'the next village',
      barmaid: name('barmaid', 'the barmaid'), smith: name('smith', 'the smith'), carter: name('carter', 'the carter'), camp: at?.names.camp ?? 'the camp', axe: this.host.lumber?.axe ?? false,
    };
  }

  // How a quest stands: not to be had (the one it follows not done; its people off the maps), on offer, taken, done.
  stateOf(id: string): 'locked' | 'offered' | 'taken' | 'done' {
    const key = keyed(id);
    const state = this.state.get(key);
    if (state) return state;
    const i = this.set.all.get(key);
    if (!i) return 'locked';
    const before = i.quest.follows && `${i.quest.follows}@${i.at?.key ?? 'road'}`;
    if (!before || this.state.get(before) === 'done') return 'offered';
    return this.set.all.has(before) || i.quest.scope === 'first' ? 'locked' : 'offered'; // (a village's: the one before not set there, never in the way; the opening line's: always in its order)
  }

  private level(key: string): number {
    return this.set.all.get(key)?.at?.level ?? this.host.hero.level;
  }

  // What a quest pays: coin and experience by its village's level (the road's: the hero's own), and its gift, named.
  pays(id: string): { copper: number; xp: number; gift: string } {
    const key = keyed(id);
    const quest = STORY_QUESTS[idOf(key)];
    const level = this.level(key);
    const gift = quest.gift;
    const given = !gift ? '' : 'gear' in gift ? `${/^[aeiou]/.test(gift.least) ? 'an' : 'a'} ${gift.least} ${ITEMS[gift.gear].name.toLowerCase()}` : `${gift.count} × ${LOOT[gift.item].name}`;
    return { copper: Math.round(quest.copper * (1 + PER_LEVEL * (level - 1))), xp: Math.round(xpToNext(Math.max(1, level)) * quest.xpShare), gift: [given, quest.night ? "a night's rest" : ''].filter(Boolean).join(' and ') };
  }

  // How far along what a taken quest asks is: what's carried of what's to be brought; else what's been counted.
  progress(id: string): { have: number; of: number } {
    const key = keyed(id);
    const needs = STORY_QUESTS[idOf(key)]?.needs;
    if (!needs) return { have: 1, of: 1 };
    const of = needs.kind === 'reach' ? 1 : needs.count;
    const have = needs.kind === 'bring' ? (this.host.hero.bag[needs.item] ?? 0) : (this.counted.get(key) ?? 0);
    return { have: Math.min(of, have), of };
  }

  ready(id: string): boolean {
    const { have, of } = this.progress(id);
    return have >= of;
  }

  // Something done toward the taken quests it counts for: told (as the boards' are); one with no one to go back to,
  // all it asks done: finished, and paid.
  private count(matches: (quest: StoryQuest, key: string) => boolean, at: { x: number; y: number; z: number } = this.host.hero): void {
    for (const [key, state] of [...this.state]) {
      const quest = STORY_QUESTS[idOf(key)];
      if (state !== 'taken' || !quest || this.ready(key) || !matches(quest, key)) continue;
      this.counted.set(key, (this.counted.get(key) ?? 0) + 1);
      const { have, of } = this.progress(key);
      if (have >= of && !quest.receiver) this.handIn(key);
      else this.host.report({ kind: 'quest', text: `${quest.name}: ${have >= of ? 'done' : `${have}/${of}`}`, done: have >= of, x: at.x, y: at.y, z: at.z });
    }
  }

  // A foe slain.
  onKill(enemy: Enemy): void {
    this.count((q) => q.needs?.kind === 'slay' && q.needs.foe === enemy.kind, enemy);
  }

  // What the game tells of (GameModel.report): a bandit camp cleared, a shift worked to its end, a wish at a well.
  onEvent(event: GameEvent): void {
    const what = event.kind === 'cleared' && event.place === 'camp' ? 'clearCamp' : event.kind === 'shift' && !event.early ? 'shift' : event.kind === 'blessing' ? 'wish' : null;
    if (what) this.count((q) => q.needs?.kind === 'do' && q.needs.what === what);
  }

  // Each frame outdoors: a place a taken quest asks to be reached, come near.
  update(): void {
    if (this.host.inside || this.state.size === 0) return;
    const { hero } = this.host;
    this.count((q, key) => {
      const place = q.needs?.kind === 'reach' ? this.set.all.get(key)?.at?.place[q.needs.place] : undefined;
      return !!place && q.needs?.kind === 'reach' && Math.hypot(place.x - hero.x, place.z - hero.z) <= q.needs.within;
    });
  }

  // The mark over `who`'s head, if any: a quest ready to hand in to them (a gold "?"), else one of theirs to give (a
  // "!"), else one they wait on (a grey "?").
  markOf(who: Who): StoryMark | null {
    let mark: StoryMark | null = null;
    for (const i of this.of(who)) {
      const state = this.stateOf(i.key);
      if (state === 'taken' && i.quest.receiver && i.at?.who[i.quest.receiver] === who) {
        if (this.ready(i.key)) return 'ready';
        mark ??= 'waiting';
      } else if (state === 'offered' && (isTraveller(who) || i.at?.who[i.quest.giver] === who)) mark = 'offer'; // (one to give, over one they wait on)
    }
    return mark;
  }

  // Everyone on the maps with a mark over them (not those on the road), and which.
  get asking(): Array<{ who: Carter | Npc; mark: StoryMark }> {
    return [...this.set.by.keys()].flatMap((who) => {
      const mark = this.markOf(who as Carter | Npc);
      return mark ? [{ who: who as Carter | Npc, mark }] : [];
    });
  }

  // The keys a quest is set by, wherever it is on the maps ("firewood": one for each village that has it).
  keysOf(id: string): string[] {
    return [...this.set.all.keys()].filter((key) => idOf(key) === id);
  }

  // The carter, near enough for a word (outdoors, by his wagon).
  get carterInReach(): Carter | null {
    const carter = this.host.inside ? null : (this.set.first?.who.carter as Carter | undefined);
    return carter && Math.hypot(carter.x - this.host.hero.x, carter.z - this.host.hero.z) <= REACH ? carter : null;
  }

  // A villager with something of the story's to say, near enough for a word (those with a trade or a post: npcs/talk.ts).
  get askerInReach(): Npc | null {
    const { hero, inside } = this.host;
    let [best, near]: [Npc | null, number] = [null, REACH];
    for (const n of this.host.folk) {
      if (n.role !== 'villager' || n.where !== (inside?.entrance ?? null) || !this.set.by.has(n)) continue;
      const d = Math.hypot(n.x - hero.x, n.z - hero.z);
      if (d < near && this.talk(n)) [best, near] = [n, d];
    }
    return best;
  }

  // What `who` has to say now, and what the hero may answer; null: nothing of the story's (their own trade or word).
  // First a quest ready to hand in to them; then one of theirs to offer (someone with a trade: their wares too, an
  // answer away); then, from those with no trade to get on with, what they wait on, or say of the last of theirs done.
  talk(who: Who): Talk | null {
    const mine = this.of(who).map((i) => ({ i, state: this.stateOf(i.key), gives: isTraveller(who) || i.at?.who[i.quest.giver] === who, takes: !!i.quest.receiver && i.at?.who[i.quest.receiver] === who }));
    if (mine.length === 0) return null;
    const speaker = who.name;
    const about = (i: Instance, state: 'offered' | 'handIn') => ({ name: i.quest.name, task: i.quest.task(this.told(i, who)), ...this.pays(i.key), state });
    const handIn = mine.find((m) => m.state === 'taken' && m.takes && this.ready(m.i.key));
    if (handIn) {
      const full = !this.roomFor(handIn.i.quest.gift);
      if (full) return { speaker, lines: ["Your bag's full. Make room, and you'll have what I owe you."], answers: [] };
      return { speaker, lines: handIn.i.quest.handIn(this.told(handIn.i, who)), quest: about(handIn.i, 'handIn'), night: handIn.i.quest.night, answers: [{ label: handIn.i.quest.thanks, primary: true, pick: () => this.handIn(handIn.i.key) }] };
    }
    const offer = mine.find((m) => m.state === 'offered' && m.gives);
    if (offer) {
      const { quest } = offer.i;
      const trade = hasTrade(who) ? [{ label: 'Show me your wares.', trade: true, pick: () => {} }] : [];
      return { speaker, lines: quest.offer(this.told(offer.i, who)), quest: about(offer.i, 'offered'), answers: [{ label: quest.accept, primary: true, pick: () => this.accept(offer.i.key, who) }, { label: quest.decline, pick: () => {} }, ...trade] };
    }
    if (hasTrade(who)) return null; // (their trade, then)
    const awaited = mine.find((m) => m.state === 'taken' && m.takes);
    if (awaited) return { speaker, lines: (awaited.i.quest.pending ?? awaited.i.quest.waiting)(this.told(awaited.i, who)), answers: [] };
    const given = mine.find((m) => m.state === 'taken' && m.gives);
    if (given) return { speaker, lines: given.i.quest.waiting(this.told(given.i, who)), answers: [] };
    const done = isTraveller(who) ? undefined : mine.filter((m) => m.state === 'done' && m.gives).at(-1); // (on the road: their own word again)
    return done ? { speaker, lines: done.i.quest.after(this.told(done.i, who)), answers: [] } : null;
  }

  // Whether `who` has a quest to offer right now (after one's handed in to them: offered in the same breath).
  offers(who: Who): boolean {
    return this.markOf(who) === 'offer';
  }

  // Those under way and tracked on screen: how many.
  get trackedCount(): number {
    return [...this.state].filter(([key, s]) => s === 'taken' && !this.untracked.has(key)).length;
  }

  isTracked(id: string): boolean {
    return this.stateOf(id) === 'taken' && !this.untracked.has(keyed(id));
  }

  // Tracks a quest taken, or stops; returns whether it's as asked (not with the screen full).
  setTracked(id: string, on: boolean): boolean {
    const key = keyed(id);
    if (this.stateOf(key) !== 'taken') return false;
    if (on && !this.isTracked(key) && this.host.quests && !this.host.quests.trackRoom) return false;
    on ? this.untracked.delete(key) : this.untracked.add(key);
    return true;
  }

  // Taken up (`from`: whoever gave it, on the road), its people and village kept for when they're off the maps.
  accept(id: string, from?: Who): boolean {
    const key = keyed(id);
    const i = this.set.all.get(key);
    if (!i || this.stateOf(key) !== 'offered') return false;
    const room = this.host.quests?.trackRoom ?? true; // (tracked, if there's room)
    const t = this.told(i, from);
    this.state.set(key, 'taken');
    this.counted.delete(key);
    this.kept.set(key, { to: i.quest.receiver ? t.receiver : '', from: t.giver, x: i.at?.village.x ?? this.host.hero.x, z: i.at?.village.z ?? this.host.hero.z });
    room ? this.untracked.delete(key) : this.untracked.add(key);
    const { hero } = this.host;
    this.host.report({ kind: 'quest', text: `Quest taken: ${i.quest.name}`, done: false, x: hero.x, y: hero.y, z: hero.z });
    return true;
  }

  // Let go: on offer again from whoever gave it, to be taken up afresh (what was done toward it forgotten).
  abandon(id: string): boolean {
    const key = keyed(id);
    if (this.state.get(key) !== 'taken') return false;
    for (const kept of [this.state, this.untracked, this.counted, this.kept]) kept.delete(key);
    return true;
  }

  private roomFor(gift: Gift | undefined): boolean {
    return !gift || 'gear' in gift || canCarry(this.host.hero, gift.item); // (a piece of gear: a stack of its own, tried as it's given)
  }

  // Handed in (or, with no one to hand it to, done): what was to be brought given over, paid (coin, experience, its
  // gift), and done for good.
  handIn(id: string): boolean {
    const key = keyed(id);
    const quest = STORY_QUESTS[idOf(key)];
    if (!quest || this.state.get(key) !== 'taken' || !this.ready(key) || !this.roomFor(quest.gift)) return false;
    const { hero } = this.host;
    const { copper, xp } = this.pays(key);
    if (quest.needs?.kind === 'bring') for (let i = 0; i < quest.needs.count; i++) takeFromBag(hero.bag, quest.needs.item);
    const gift = quest.gift;
    if (gift && 'gear' in gift) addToBag(hero.bag, rollGear(gift.gear, this.level(key), mulberry32(Math.round(hashUnit(key.length, copper, this.host.seed) * 1e9)), 1, gift.least) as BagItem);
    else if (gift) for (let i = 0; i < gift.count; i++) addToBag(hero.bag, gift.item);
    this.state.set(key, 'done');
    for (const kept of [this.untracked, this.counted, this.kept]) kept.delete(key);
    hero.money += copper;
    gainXp(hero, xp);
    if (quest.night) sleepTillMorning(this.host);
    this.host.report({ kind: 'coins', amount: copper });
    this.host.report({ kind: 'quest', text: `${quest.name}: done`, done: true, x: hero.x, y: hero.y, z: hero.z });
    return true;
  }

  // Where what a taken quest still asks is to be done, if anywhere: the place to reach; the nearest such foe about;
  // the camp to clear, the inn to work at, the well (its village's; the road's: the nearest to the hero).
  private goalOf(key: string): { x: number; z: number } | null {
    const needs = STORY_QUESTS[idOf(key)]?.needs;
    const at = this.set.all.get(key)?.at ?? null;
    const { hero, enemies } = this.host;
    const nearest = <T extends { x: number; z: number }>(list: readonly T[], within = Infinity) => list.reduce<T | null>((best, p) => (Math.hypot(p.x - hero.x, p.z - hero.z) < (best ? Math.hypot(best.x - hero.x, best.z - hero.z) : within) ? p : best), null);
    if (needs?.kind === 'reach') return at?.place[needs.place] ?? null;
    if (needs?.kind === 'slay') return nearest(enemies.filter((e) => e.kind === needs.foe && e.state !== 'dead'), FOE_SEEN) ?? (LAIR[needs.foe] && at?.place[LAIR[needs.foe]!]) ?? null; // (none in sight: where its kind keeps)
    if (needs?.kind !== 'do') return null;
    if (needs.what === 'clearCamp') return at?.place.camp ?? nearest(this.host.camps.map((c) => c.way));
    if (needs.what === 'shift') return this.innOf(key);
    return at?.village ?? nearest(this.host.villages);
  }

  // The inn a taken quest's shift is worked at (its village's), if that's what it asks.
  private innOf(key: string): Entrance | null {
    const needs = STORY_QUESTS[idOf(key)]?.needs;
    if (needs?.kind !== 'do' || needs.what !== 'shift') return null;
    const { hero } = this.host;
    const far = (e: Entrance) => Math.hypot(e.x - hero.x, e.z - hero.z);
    return this.set.all.get(key)?.at?.inn ?? this.host.entrances.filter((e) => e.type === 'inn').reduce<Entrance | null>((best, e) => (!best || far(e) < far(best) ? e : best), null);
  }

  // Those under way, for the tracker and the journal (their people off the maps: as they were kept).
  get taken(): TakenStory[] {
    return [...this.state].filter(([, s]) => s === 'taken').map(([key]) => {
      const quest = STORY_QUESTS[idOf(key)];
      const i = this.set.all.get(key);
      const kept = this.kept.get(key) ?? { to: '', from: 'someone', x: this.host.hero.x, z: this.host.hero.z };
      const to = (i?.at && quest.receiver && (i.at.who[quest.receiver] as Carter | Npc | undefined)) || null;
      const ready = this.ready(key);
      const told: Told = i ? this.told(i) : { village: 'a village far off', giver: kept.from, receiver: kept.to, next: '', barmaid: kept.to, smith: kept.to, carter: kept.from, camp: 'the camp', axe: false };
      const back = quest.receiver && !to ? { x: kept.x, z: kept.z } : null; // (whoever takes it in off the maps: back to their village)
      return {
        id: key, name: quest.name, task: quest.task({ ...told, giver: kept.from, receiver: kept.to || kept.from }), ready, tracked: !this.untracked.has(key), ...this.progress(key),
        to, toName: kept.to, fromName: kept.from, door: to && 'where' in to ? to.where : null, goal: ready ? back : (this.goalOf(key) ?? back), within: ready ? null : this.innOf(key),
      };
    });
  }

  // Those done, for the journal.
  get done(): Array<{ id: string; name: string }> {
    return [...this.state].filter(([, s]) => s === 'done').map(([key]) => ({ id: key, name: STORY_QUESTS[idOf(key)]?.name ?? key }));
  }

  save(): { states: Record<string, 'taken' | 'untracked' | 'done'>; counted: Record<string, number>; kept: Record<string, { to: string; from: string; x: number; z: number }> } {
    return {
      states: Object.fromEntries([...this.state].map(([key, s]) => [key, s === 'taken' && this.untracked.has(key) ? 'untracked' : s])), // (untracked: taken, kept off the tracker)
      counted: Object.fromEntries(this.counted),
      kept: Object.fromEntries(this.kept),
    };
  }

  // (`data`: as saved; an older save's: its states alone, by their bare names: the first village's.)
  load(data: unknown): void {
    const saved = (data ?? {}) as { states?: Record<string, unknown>; counted?: Record<string, unknown>; kept?: Record<string, { to: string; from: string; x: number; z: number }> } & Record<string, unknown>;
    const states = (saved.states && typeof saved.states === 'object' ? saved.states : saved) as Record<string, unknown>;
    const known = Object.entries(states).filter((e): e is [string, 'taken' | 'untracked' | 'done'] => idOf(e[0]) in STORY_QUESTS && (e[1] === 'taken' || e[1] === 'untracked' || e[1] === 'done'));
    this.state = new Map(known.map(([id, s]) => [keyed(id), s === 'done' ? 'done' : 'taken']));
    this.untracked = new Set(known.filter(([, s]) => s === 'untracked').map(([id]) => keyed(id)));
    this.counted = new Map(Object.entries(saved.counted ?? {}).map(([id, n]) => [keyed(id), n] as const).filter((e): e is [string, number] => Number.isInteger(e[1]) && this.state.get(e[0]) === 'taken'));
    this.kept = new Map(Object.entries(saved.kept ?? {}).filter(([key]) => this.state.get(key) === 'taken'));
  }
}
