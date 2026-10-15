// The quests people give, and how they stand. Each is written once (quests/, gathered in quests/catalog.ts) and set
// wherever its people are (storySet.ts): the first village's line, a village's own, the road's. Kept by a key, the
// quest's and where it's set ("scrapForTheForge@8201", "wordToTheInn@first", "wolvesAtMyHeels@road").
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
import { afterDark } from './nights';
import type { Entrance } from '../interiors/interiors';
import { LOOT } from '../loot/loot';
import type { Npc } from '../npcs/npcs';
import type { Ruin } from '../ruins/ruins';
import type { Enemy, GameEvent } from '../types';
import { hashUnit, mulberry32 } from '../../util/random';
import type { Carter } from './carter';
import { STORY_QUESTS } from './quests/catalog';
import { isTraveller, type Setting, type Who } from './storyCast';
import { alreadyDone } from './storyAlready';
import { restock } from './storyRestock';
import { goalOf, innOf } from './storyGoals';
import type { Gift, StoryQuest, Told } from './storyQuests';
import { Choices, choiceAnswers, type Choice } from './storyChoices';
import { keyOf, resettle, sameWorld, settle, type Instance, type QuestSet } from './storySet';
import { questsOf, replay } from './storyDebug';
import { loadLedger, saveLedger, type Ledger, type SavedStory } from './storySave';
import { idOf, keyed, type DebugQuest, type StoryHost, type StoryMark, type TakenStory, type Talk } from './storyTypes';
import { keyBefore, saintOf, type SaintState } from './saint/saintState';

export { STORY_QUESTS } from './quests/catalog';
export type { Who } from './storyCast';
export type { DebugQuest, StoryHost, StoryMark, TakenStory, Talk } from './storyTypes';
export type { SaintState } from './saint/saintState';

const REACH = 1.7; // tiles from the carter, or a villager, for a word
const PER_LEVEL = 0.25; // more coin, a level of the village's over the first
const hasTrade = (who: Who): boolean => 'role' in who && (who.role === 'barkeep' || who.role === 'smith' || who.role === 'herbalist' || who.role === 'pedlar' || who.role === 'witch');

export class Story {
  debug = false; // a cheat: Q beside someone lists every quest of their calling, to play again; the journal finishes any
  private l: Ledger = loadLedger({}); // how each stands, and what's kept of it (storySave.ts; in the save)
  private slept = new Set<string>(); // those whose night has passed already, in the telling (not again as they're handed in)
  private world: QuestSet | null = null;
  private haunted = -Infinity; // the game's minute what the quests ask for was last looked to (storyRestock.ts)
  readonly choices = new Choices(); // the ways the hero took where the story left it to them (storyChoices.ts; in the save)

  constructor(private readonly host: StoryHost) {}

  // Every quest as it's set in the world that's on the maps, and whose they are (found again only as the world changes).
  private get set(): QuestSet {
    if (sameWorld(this.world, this.host)) return this.world;
    this.world = settle(this.host, this.l.home, { road: this.l.road, town: this.l.town ?? this.host.cathedralTown?.() ?? null }); // (the second arc's places, as kept)
    const { town } = this.world.saint;
    if (town) this.l.town = { x: town.village.x, z: town.village.z }; // (Greyminster, seen: kept)
    this.l.carter ??= (this.world.first?.who.carter as Carter | undefined)?.name ?? null;
    resettle(this.world, new Map([...this.l.forced].map(([key, id]) => [key, this.host.npcs.find((n) => n.id === id)])), [...this.l.state].filter(([, s]) => s === 'taken').map(([key]) => key), STORY_QUESTS); // (those set by hand, and an older save's)
    return this.world;
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

  // Whether a quest of `who`'s is theirs to give, and theirs to take in.
  private part(i: Instance, who: Who): { gives: boolean; takes: boolean } {
    return { gives: isTraveller(who) || i.at?.who[i.quest.giver] === who, takes: !!i.quest.receiver && i.at?.who[i.quest.receiver] === who };
  }

  private told(i: Instance, giver?: Who): Told {
    const { at, quest } = i;
    const name = (role: StoryQuest['giver'] | undefined, or: string) => (role && at?.who[role]?.name) || or;
    const from = at ? name(quest.giver, 'someone') : (giver?.name ?? 'a traveller');
    return {
      village: at?.names.village ?? 'the road', giver: from, receiver: name(quest.receiver, from), next: at?.names.next ?? 'the next village',
      barmaid: name('barmaid', 'the barmaid'), smith: name('smith', 'the smith'), carter: name('carter', 'the carter'), camp: at?.names.camp ?? 'the camp', axe: this.host.lumber?.axe ?? false, chose: this.choices.of, did: this.did,
    };
  }

  // How a quest stands: not to be had (the one it follows not done; its people off the maps; a night with someone of
  // the hero's own sex; a giver who isn't the man or woman its words have them), on offer, taken, done.
  stateOf(id: string): 'locked' | 'offered' | 'taken' | 'done' {
    const key = keyed(id);
    const state = this.l.state.get(key);
    if (state) return state;
    const i = this.set.all.get(key);
    if (!i) return 'locked';
    // (One that ends in a night together: offered only by someone of the other sex than the hero's.)
    if (i.quest.night && !this.l.freed.has(key) && i.at?.who[i.quest.giver]?.look.build === this.host.hero.look.build) return 'locked';
    // (One whose giver speaks as a man, or a woman: offered only by one.)
    if (i.quest.sex && !this.l.freed.has(key) && i.at && i.at.who[i.quest.giver]?.look.build !== i.quest.sex) return 'locked';
    const saint = i.quest.scope === 'saint';
    const before = i.quest.follows && (saint ? keyBefore(i.quest.follows, this.l.state, this.set.all) : keyOf(i.quest.follows, i.at)); // (the second arc's: the one before set in another place)
    if (!before || this.l.state.get(before) === 'done' || this.l.freed.has(key)) return 'offered';
    return this.set.all.has(before) || i.quest.scope === 'first' || saint ? 'locked' : 'offered'; // (a village's: the one before not set there, never in the way; the opening line's, the second arc's: always in their order)
  }

  // (The second arc's: the hero's own, where that's more: it starts at home, after the first village's line.)
  private level(key: string): number {
    const at = this.set.all.get(key)?.at?.level ?? this.host.hero.level;
    return STORY_QUESTS[idOf(key)]?.scope === 'saint' ? Math.max(at, this.host.hero.level) : at;
  }

  // What a quest pays: coin and experience by its village's level (the road's: the hero's own), and its gift, named.
  pays(id: string): { copper: number; xp: number; gift: string } {
    const key = keyed(id);
    const quest = STORY_QUESTS[idOf(key)];
    const gift = quest.gift;
    const given = !gift ? '' : 'gear' in gift ? `${/^[aeiou]/.test(gift.least) ? 'an' : 'a'} ${gift.least} ${ITEMS[gift.gear].name.toLowerCase()}` : `${gift.count} × ${LOOT[gift.item].name}`;
    return { copper: Math.round(quest.copper * (1 + PER_LEVEL * (this.level(key) - 1))), xp: Math.round(xpToNext(Math.max(1, this.level(key))) * quest.xpShare), gift: [given, quest.night ? "a night's rest" : ''].filter(Boolean).join(' and ') };
  }

  // How far along what a taken quest asks is: what's carried of what's to be brought; else what's been counted.
  progress(id: string): { have: number; of: number } {
    const key = keyed(id);
    const needs = STORY_QUESTS[idOf(key)]?.needs;
    if (!needs) return { have: 1, of: 1 };
    const of = needs.kind === 'reach' ? 1 : needs.count;
    const have = needs.kind === 'bring' ? (this.host.hero.bag[needs.item] ?? 0) : (this.l.counted.get(key) ?? 0);
    return { have: Math.min(of, have), of };
  }

  ready = (id: string): boolean => this.progress(id).have >= this.progress(id).of;

  // Something done toward the taken quests it counts for: told (as the boards' are); one with no one to go back to,
  // all it asks done: finished, and paid.
  private count(matches: (quest: StoryQuest, key: string) => boolean, at: { x: number; y: number; z: number } = this.host.hero): void {
    for (const [key, state] of [...this.l.state]) {
      const quest = STORY_QUESTS[idOf(key)];
      if (state !== 'taken' || !quest || this.ready(key) || !matches(quest, key)) continue;
      this.l.counted.set(key, (this.l.counted.get(key) ?? 0) + 1);
      const { have, of } = this.progress(key);
      if (have >= of && !quest.receiver) this.handIn(key);
      else this.host.report({ kind: 'quest', text: `${quest.name}: ${have >= of ? 'done' : `${have}/${of}`}`, done: have >= of, x: at.x, y: at.y, z: at.z });
    }
  }

  // A foe slain.
  onKill(enemy: Enemy): void {
    this.count((q) => q.needs?.kind === 'slay' && q.needs.foe === enemy.kind, enemy);
  }

  // What the game tells of (GameModel.report): a bandit camp cleared, a shift worked to its end, a wish at a well, the
  // Undercroft under the Minster cleared (its saint fallen: the reliquary's to tell).
  onEvent(event: GameEvent): void {
    const cleared = event.kind === 'cleared' ? (event.place as string | undefined) : undefined;
    const what = cleared === 'camp' ? 'clearCamp' : cleared === 'reliquary' ? 'reliquary' : event.kind === 'shift' && !event.early ? 'shift' : event.kind === 'blessing' ? 'wish' : null;
    if (what) this.count((q) => q.needs?.kind === 'do' && q.needs.what === what);
  }

  // Each frame outdoors: a place a taken quest asks to be reached, come near; and what one asks found done already
  // (its camp cleared, its dungeon's boss slain, before it was ever taken: storyAlready.ts).
  update(): void {
    if (this.host.inside || this.l.state.size === 0) return;
    const { hero } = this.host;
    this.raise();
    this.count((q, key) => {
      const at = this.set.all.get(key)?.at ?? null;
      const place = q.needs?.kind === 'reach' ? (at?.place[q.needs.place] ?? this.l.kept.get(key)?.goal) : undefined; // (its place off the maps: as kept)
      return (!!place && q.needs?.kind === 'reach' && Math.hypot(place.x - hero.x, place.z - hero.z) <= q.needs.within) || alreadyDone(this.host, q, at);
    });
  }

  // What the quests under way send the hero for, kept there to be had (storyRestock.ts): looked to every couple of seconds.
  private raise(): void {
    const { host } = this;
    if (host.minutes - this.haunted < 2) return;
    this.haunted = host.minutes;
    const wants = [...this.l.state].filter(([, state]) => state === 'taken').map(([key]) => ({ quest: STORY_QUESTS[idOf(key)], at: this.set.all.get(key)?.at ?? null, left: this.progress(key).of - this.progress(key).have }));
    restock(host, wants.filter((w) => w.quest));
  }

  // The mark over `who`'s head, if any: a quest ready to hand in to them (a gold "?"), else one of theirs to give (a
  // "!"), else one they wait on (a grey "?").
  markOf(who: Who): StoryMark | null {
    if (this.shuns(who)) return null;
    let mark: StoryMark | null = null;
    for (const i of this.of(who)) {
      const [state, { gives, takes }] = [this.stateOf(i.key), this.part(i, who)];
      if (state === 'taken' && takes) {
        if (this.ready(i.key)) return 'ready';
        mark ??= 'waiting';
      } else if (state === 'offered' && gives) mark = 'offer'; // (one to give, over one they wait on)
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
    const carter = this.host.inside || this.saint.carterGone ? null : (this.set.first?.who.carter as Carter | undefined); // (gone up the road: the second arc)
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
  // answer away); then, from those with no trade to get on with (or `word`: theirs asked for, their window's greeting), what they wait on, or say of the last of theirs done.
  talk(who: Who, only?: string, word = false): Talk | null {
    const mine = this.of(who).filter((i) => !only || i.key === only).map((i) => ({ i, state: this.stateOf(i.key), ...this.part(i, who) }));
    if (mine.length === 0) return null;
    const speaker = who.name;
    if (this.shuns(who)) return word ? { speaker, lines: ['Pay, and go.'], answers: [] } : null; // (her trade, and not a word)
    const about = (i: Instance, state: 'offered' | 'handIn') => ({ name: i.quest.name, task: i.quest.task(this.told(i, who)), ...this.pays(i.key), state });
    const handIn = mine.find((m) => m.state === 'taken' && m.takes && this.ready(m.i.key));
    if (handIn) {
      const notYet = (line: string): Talk => ({ speaker, lines: [line], answers: hasTrade(who) ? [{ label: 'Show me your wares.', primary: true, trade: true, pick: () => {} }, { label: 'Later.', pick: () => {} }] : [] }); // (someone with a trade: their wares still to be had, to make that room)
      if (!this.roomFor(handIn.i.quest.gift)) return notYet("Your bag's full. Make room, and you'll have what I owe you.");
      if (handIn.i.quest.night && !afterDark(this.host.minutes)) return notYet('Not now, in broad daylight. Come back after dark.'); // (a night's quest: not a whole day slept away, nights.ts)
      return { speaker, lines: handIn.i.quest.handIn(this.told(handIn.i, who)), quest: about(handIn.i, 'handIn'), night: handIn.i.quest.night ? () => this.sleep(handIn.i.key) : undefined, answers: choiceAnswers(handIn.i.quest, this.told(handIn.i, who), speaker, (choice) => this.handIn(handIn.i.key, choice)) };
    }
    const offers = mine.filter((m) => m.state === 'offered' && m.gives);
    const offer = offers.find((m) => m.i.quest.scope === 'first' || m.i.quest.scope === 'saint') ?? offers[0]; // (a line's, over their village's own)
    if (offer) {
      const { quest } = offer.i;
      const trade = hasTrade(who) ? [{ label: 'Show me your wares.', trade: true, pick: () => {} }] : [];
      return { speaker, lines: quest.offer(this.told(offer.i, who)), quest: about(offer.i, 'offered'), answers: [{ label: quest.accept, primary: true, pick: () => void this.accept(offer.i.key, who) }, { label: quest.decline, pick: () => {} }, ...trade] };
    }
    if (hasTrade(who) && !word) return null; // (their trade, then)
    const awaited = mine.find((m) => m.state === 'taken' && m.takes);
    if (awaited) return { speaker, lines: (awaited.i.quest.pending ?? awaited.i.quest.waiting)(this.told(awaited.i, who)), answers: [] };
    const given = mine.find((m) => m.state === 'taken' && m.gives);
    if (given) return { speaker, lines: given.i.quest.waiting(this.told(given.i, who)), answers: [] };
    const done = isTraveller(who) ? undefined : mine.filter((m) => m.state === 'done' && m.gives).at(-1); // (on the road: their own word again)
    return done ? { speaker, lines: done.i.quest.after(this.told(done.i, who)), answers: [] } : null;
  }

  // Those under way and tracked on screen: how many.
  get trackedCount(): number { return [...this.l.state].filter(([key, s]) => s === 'taken' && !this.l.untracked.has(key)).length; }

  isTracked(id: string): boolean {
    return this.stateOf(id) === 'taken' && !this.l.untracked.has(keyed(id));
  }

  // Tracks a quest taken, or stops; returns whether it's as asked (not with the screen full).
  setTracked(id: string, on: boolean): boolean {
    const key = keyed(id);
    if (this.stateOf(key) !== 'taken') return false;
    if (on && !this.isTracked(key) && this.host.quests && !this.host.quests.trackRoom) return false;
    on ? this.l.untracked.delete(key) : this.l.untracked.add(key);
    return true;
  }

  // Taken up (`from`: whoever gave it, on the road), its people and village kept for when they're off the maps.
  accept(id: string, from?: Who): boolean {
    const key = keyed(id);
    const i = this.set.all.get(key);
    if (!i || this.stateOf(key) !== 'offered') return false;
    const room = this.host.quests?.trackRoom ?? true; // (tracked, if there's room)
    const t = this.told(i, from);
    this.l.state.set(key, 'taken');
    if (i.quest.scope === 'first' && i.at && (this.l.home === null || this.l.home === 'nearest')) this.l.home = { x: i.at.village.x, z: i.at.village.z }; // (its line under way: there for good)
    this.l.counted.delete(key);
    const goal = i.quest.needs?.kind === 'reach' ? i.at?.place[i.quest.needs.place] : undefined;
    this.l.kept.set(key, { to: i.quest.receiver ? t.receiver : '', from: t.giver, x: i.at?.village.x ?? this.host.hero.x, z: i.at?.village.z ?? this.host.hero.z, village: t.village, next: t.next, camp: t.camp, ...(goal ? { goal } : {}) });
    if (i.quest.needs?.kind === 'reach' && i.quest.needs.place === 'onward' && goal) this.l.road = goal; // (the witch's village, sent there: kept)
    room ? this.l.untracked.delete(key) : this.l.untracked.add(key);
    const { hero } = this.host;
    const stake = i.quest.stake;
    if (stake && !this.l.staked.has(key)) {
      this.l.staked.add(key);
      if ('copper' in stake) hero.money += stake.copper;
      else for (let n = 0; n < stake.count; n++) addToBag(hero.bag, stake.item);
    }
    this.host.report({ kind: 'quest', text: `Quest taken: ${i.quest.name}`, done: false, x: hero.x, y: hero.y, z: hero.z });
    if (!i.quest.needs && !i.quest.receiver) this.handIn(key); // (nothing asked, no one to go back to: done as it's heard)
    return true;
  }

  // Someone gone for good (turned into a chicken: spells/turned.ts): whatever of theirs is under way (given by them,
  // or to be handed in to them) let go, nothing of theirs set by hand kept; the rest follows from their being gone
  // from the world (no quest set that wants them: storySet.ts lacks).
  lose(who: Npc): void {
    for (const { key } of this.set.by.get(who) ?? []) [this.abandon(key), this.l.forced.delete(key)];
    for (const [key, id] of this.l.forced) if (id === who.id) this.l.forced.delete(key);
  }

  // Let go: on offer again from whoever gave it, to be taken up afresh (what was done toward it forgotten).
  abandon(id: string): boolean {
    const key = keyed(id);
    if (this.l.state.get(key) !== 'taken') return false;
    for (const kept of [this.l.state, this.l.untracked, this.l.counted, this.l.kept]) kept.delete(key);
    return true;
  }

  // The night a quest ends with, spent: morning, rested (once, however it's told).
  private sleep(key: string): void {
    if (this.slept.has(key)) return;
    this.slept.add(key);
    sleepTillMorning(this.host);
    const i = this.set.all.get(key);
    const beside = i?.quest.receiver && i.at?.who[i.quest.receiver];
    if (beside && 'home' in beside) this.host.wakeWith?.(beside);
  }

  private roomFor(gift: Gift | undefined): boolean {
    return !gift || 'gear' in gift || canCarry(this.host.hero, gift.item); // (a piece of gear: a stack of its own, tried as it's given)
  }

  // Handed in (or, with no one to hand it to, done): what was to be brought given over, paid (coin, experience, its
  // gift; a way chosen, its own on top; a way chosen before, what it earned here), and done for good.
  handIn(id: string, choice?: Choice): boolean {
    const key = keyed(id);
    const quest = STORY_QUESTS[idOf(key)];
    if (!quest || this.l.state.get(key) !== 'taken' || !this.ready(key) || !this.roomFor(quest.gift)) return false;
    const { hero } = this.host;
    const { copper, xp } = this.pays(key);
    if (quest.needs?.kind === 'bring') for (let i = 0; i < quest.needs.count; i++) takeFromBag(hero.bag, quest.needs.item);
    const give = (gift: Gift | null | undefined) => gift && ('gear' in gift ? addToBag(hero.bag, rollGear(gift.gear, this.level(key), mulberry32(Math.round(hashUnit(key.length, copper, this.host.seed) * 1e9)), 1, gift.least) as BagItem) : Array.from({ length: gift.count }, () => addToBag(hero.bag, gift.item)));
    if (choice) this.choices.take(idOf(key), choice.key);
    const gone = choice?.gone && this.set.all.get(key)?.at?.who[choice.gone]; // (taken away for good, after it's said)
    for (const gift of [quest.gift, choice?.gift, this.choices.laterFor(idOf(key), (at) => STORY_QUESTS[at]?.choice)]) give(gift);
    const more = Math.round((choice?.copper ?? 0) * (1 + PER_LEVEL * (this.level(key) - 1)));
    this.l.state.set(key, 'done');
    for (const kept of [this.l.untracked, this.l.counted, this.l.kept]) kept.delete(key);
    hero.money += copper + more;
    gainXp(hero, xp);
    if (quest.night) this.sleep(key);
    this.slept.delete(key);
    this.host.report({ kind: 'coins', amount: copper + more });
    this.host.report({ kind: 'quest', text: `${quest.name}: done`, done: true, x: hero.x, y: hero.y, z: hero.z });
    if (gone && 'home' in gone) this.host.takeAway?.(gone);
    const where = this.set.all.get(key)?.at?.village ?? hero;
    if (choice?.heat) choice.heat > 0 ? this.host.heat?.raise(where, choice.heat, `${quest.name}: ${choice.label}`) : this.host.heat?.calm(where, -choice.heat);
    return true;
  }

  // Those under way, for the tracker and the journal (their people off the maps: as they were kept).
  get taken(): TakenStory[] {
    return [...this.l.state].filter(([, s]) => s === 'taken').map(([key]) => {
      const quest = STORY_QUESTS[idOf(key)];
      const i = this.set.all.get(key);
      const kept = this.l.kept.get(key) ?? { to: '', from: 'someone', x: this.host.hero.x, z: this.host.hero.z };
      const to = (i?.at && quest.receiver && (i.at.who[quest.receiver] as Carter | Npc | undefined)) || null;
      const ready = this.ready(key);
      const named = (role: StoryQuest['giver'], or: string) => (quest.receiver === role && kept.to) || (quest.giver === role ? kept.from : or); // (a keeper it's about, by their part in it)
      const told: Told = i ? this.told(i) : { village: kept.village ?? 'a village far off', giver: kept.from, receiver: kept.to, next: kept.next ?? 'the next village', barmaid: named('barmaid', 'the barmaid'), smith: named('smith', 'the smith'), carter: named('carter', 'the carter'), camp: kept.camp ?? 'the camp', axe: false };
      const back = quest.receiver && !to ? { x: kept.x, z: kept.z } : null; // (whoever takes it in off the maps: back to their village)
      return {
        id: key, name: quest.name, task: quest.task({ ...told, giver: kept.from, receiver: kept.to || kept.from }), ready, tracked: !this.l.untracked.has(key), ...this.progress(key),
        to, toName: kept.to, fromName: kept.from, door: to && 'where' in to ? to.where : null, goal: ready ? back : (goalOf(this.host, quest, i?.at ?? null) ?? kept.goal ?? back), within: ready ? null : innOf(this.host, quest, i?.at ?? null),
      };
    });
  }

  // Every quest of `who`'s calling, set with them or not; and one put back on offer from them (the cheat's: storyDebug.ts).
  questsOf(who: Who): DebugQuest[] {
    return questsOf(this.set, who, (key) => this.stateOf(key));
  }

  replay(id: string, who: Who): string | null {
    return replay(this.set, this.l, id, who);
  }

  // What a taken quest asks, done at once (the cheat's): its foes counted slain, its place reached, what's to be
  // brought put in the bag; one with no one to go back to: paid.
  finish(id: string): boolean {
    const key = keyed(id);
    const quest = STORY_QUESTS[idOf(key)];
    if (!quest || this.l.state.get(key) !== 'taken') return false;
    const { have, of } = this.progress(key);
    if (quest.needs?.kind === 'bring') for (let n = have; n < of; n++) addToBag(this.host.hero.bag, quest.needs.item);
    else this.l.counted.set(key, of);
    if (!quest.receiver) return this.handIn(key);
    return this.ready(key);
  }

  // Whether `who` won't speak to the hero again: the first village's herbalist, the bishop's gold taken (the second
  // arc's end, quests/saintQuestsTown.ts): she sells, and says nothing.
  private shuns(who: Who): boolean {
    return who === this.set.first?.who.herbalist && this.did('theLastWord') && this.saint.ending === 'kept';
  }

  // Whether a quest's been done, wherever it was set.
  did = (id: string): boolean => [...this.l.state].some(([key, s]) => s === 'done' && idOf(key) === id);

  // How the second arc stands, for the rest of the game (saint/saintState.ts).
  get saint(): SaintState {
    return saintOf(this.l.state, this.choices.of, this.l.town, this.l.carter);
  }

  // Those done, for the journal.
  get done(): Array<{ id: string; name: string }> {
    return [...this.l.state].filter(([, s]) => s === 'done').map(([key]) => ({ id: key, name: STORY_QUESTS[idOf(key)]?.name ?? key }));
  }

  save(): SavedStory {
    return saveLedger(this.l, this.choices.saved());
  }

  // (`data`: as saved; an older save's too: storySave.ts.)
  load(data: unknown): void {
    this.l = loadLedger(data);
    this.choices.load((data as { choices?: unknown } | null)?.choices, (id) => id in STORY_QUESTS);
    this.world = null; // (set afresh, with those)
  }
}
