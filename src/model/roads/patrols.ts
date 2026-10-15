// The bishop's men in grey on the roads: witch-finders walking in threes (more, once the hero's cut a party down:
// heat.ts `blood`), a leader and the rest a pace behind each other, as the guards walk. Not the seed's: set out on a
// road as they're wanted (out of the hero's sight) and called off as they're not, so there are more of them after
// arc 2 begins, near the cathedral, and where the hero's wanted, and none on a road a party was cut down on for a day.
//
// Within sight of the hero, a party that's heard of them (heat.ts `known`) comes off the road to them for a word
// (questioning.ts: `stopped`), the leader up close, the rest round them; the hero walking off before they're reached
// either lets them shrug (a little heard of) or sets them after them (wanted). Asked once, a party leaves them be a
// while. Turned on the hero (questioning.ts: a run, a fight), they're foes (`witchFinder`), in what they wore:
//  - after them to seize them: their blow takes hold of them (an arrest: arrest.ts) and hurts nothing, unless the
//    hero strikes one first (then it's a fight);
//  - a fight: blows as anyone's; the hero felled is taken to the stocks, not to an inn (setbacks.ts);
//  - got away from (past their leash, or out of sight) they go back to the road, and the word of it goes round;
//  - cut down, every one: blood on the hero's hands, the word going round the more.
import { hashUnit } from '../../util/random';
import { makeEnemy } from '../enemies/enemies';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf } from '../map/grid';
import { DAY_MINUTES } from '../clock';
import { makeTraveller, turnToward, type Traveller, type Travellers } from '../travellers/travellers';
import type { Enemy } from '../types';
import type { GameModel } from '../GameModel';
import { SEIZE, SUSPECT, WANTED } from './heat';

export const PARTY = 3; // witch-finders to a party, at the least
const MOST_MORE = 3; // more to a party for the blood on the hero's hands, at most
const FINDER_ID = 2 ** 46; // the finders' ids on the road: past any band's (each region's block, 2 ** 20 of them)
export const HUNTER_ID = 2 ** 47 + 2 ** 46; // and as foes: past the bounties' targets (quests/bounties.ts, from 2 ** 47), short of a streamed world's own (enemies/foeIds.ts)
const BASE = 0.2; // the chance of a party on a road, anywhere
const ARC_TWO = 0.25; // more, once arc 2's begun (the long road walked)
const CATHEDRAL = 0.45; // more, near the cathedral (fading over CATHEDRAL_REACH)
const CATHEDRAL_REACH = 500; // tiles
const HUNTED = 0.15; // more, while the hero's to be seized on sight somewhere
const MOST_CHANCE = 0.85;
const UNSEEN = 36; // tiles from the hero, at least, where a party's set out or called off (unseen)
const SPOT = 7; // tiles: a party this near the hero, that's heard of them, comes for a word
const TALK = 1.3; // tiles: the leader this near, the word's had
const SLIPPED = 11; // tiles: the hero this far from the leader as they come, they've walked off
const COME = 1.9; // tiles a second they come at, off the road
const ROUND = 1.7; // tiles from the hero the rest stand, round them
const ASKED_AGAIN = 3 * 60; // game minutes before a party asks the hero again
const GAVE_UP = 30; // tiles: the hero this far from every one of them, hunting, they've gone
const SYNC = 2; // seconds between setting out and calling off
export const FOLLOW = 1.2; // tiles one follows another by (travellers.ts)

export type HuntMode = 'seize' | 'fight';

// What the roads read of arc 2 (story/: `model.story.saint`, the story's to keep): its act (0 not begun, 1 at home,
// 2 the witch's village, 3 Greyminster, 4 over), what became of the chained witch, how it ended, Greyminster's spot.
export interface Saint {
  act: number;
  witch: 'freed' | 'handed' | 'left' | null;
  ending: 'exposed' | 'kept' | null;
  town: { x: number; z: number } | null;
}

export interface Party {
  key: string; // its band's and its road's
  band: Travellers;
  road: number;
  members: Traveller[]; // the leader first
  coming: boolean; // off the road to the hero for a word
  going: boolean; // back to the road after it
  asked: number; // the game minute they last asked the hero (-Infinity: never)
}

export interface Hunt {
  party: Party; // as they were on the road (to go back to it)
  along: number;
  way: 1 | -1;
  foes: Enemy[];
  mode: HuntMode;
}

export class Patrols {
  readonly parties = new Map<string, Party>();
  readonly hunts: Hunt[] = [];
  private readonly cutDown = new Map<string, number>(); // roads a party was cut down on, by key: the game minute
  private sinceSync = SYNC; // (at once, the first frame)
  private nextFoe = HUNTER_ID;
  stopped: Party | null = null; // a party come up to the hero for a word, not yet had (questioning.ts)

  constructor(private readonly model: GameModel) {}

  // How arc 2 stands (story/: the bishop's saint), if the story keeps it.
  get saint(): Saint | null {
    return (this.model.story as { saint?: Saint }).saint ?? null;
  }

  // How much heard of the hero a party stops them for: a little, or (a hero who handed a witch in) wanted, a nod short of it.
  get heeded(): number {
    return this.saint?.witch === 'handed' ? WANTED : SUSPECT;
  }

  // Whether arc 2's begun: its first act (the story's), else the carter's long road walked (story/quests/firstQuestsWatch.ts).
  get arcTwo(): boolean {
    const saint = this.saint;
    return saint ? saint.act >= 1 : this.model.story.stateOf('theLongRoad') === 'done';
  }

  // Whether the witch-finders have scattered: the false saint exposed (none on the roads, nobody taken, after).
  get scattered(): boolean {
    return this.saint?.ending === 'exposed';
  }

  // Where the cathedral town is: Greyminster, as the story knows it; else, of the villages known, a stand-in for the
  // one whose level is nearest 12, among those of level 9 and up.
  cathedralAt(): { x: number; z: number } | null {
    const town = this.saint?.town;
    if (town) return town;
    const spawn = spawnOf(this.model.size);
    let best: { x: number; z: number } | null = null;
    let off = Infinity;
    for (const v of this.model.villages) {
      const level = zoneLevel(spawn, v);
      if (level >= 9 && Math.abs(level - 12) < off) [best, off] = [v, Math.abs(level - 12)];
    }
    return best;
  }

  // The chance of a party on a road whose middle is at `at`.
  chanceAt(at: { x: number; z: number }, cathedral = this.cathedralAt()): number {
    if (this.scattered) return 0;
    const near = cathedral ? Math.max(0, 1 - Math.hypot(at.x - cathedral.x, at.z - cathedral.z) / CATHEDRAL_REACH) : 0;
    const hunted = this.model.heat.known(at) >= SEIZE ? HUNTED : 0;
    return Math.min(MOST_CHANCE, BASE + (this.arcTwo ? ARC_TWO : 0) + CATHEDRAL * near + hunted);
  }

  // How many to a party just now.
  get size(): number {
    return PARTY + Math.min(MOST_MORE, this.model.heat.blood);
  }

  update(dt: number): void {
    this.sinceSync += dt;
    if (this.sinceSync >= SYNC) {
      this.sinceSync = 0;
      this.sync();
    }
    for (const party of this.parties.values()) this.step(party, dt);
    for (const hunt of [...this.hunts]) this.hunting(hunt);
  }

  // Parties set out on the roads that want one and called off those that don't (each unseen); those whose band's
  // gone (its region let go) or whose leader's off the roads (turned, a classic world's save taken up) forgotten.
  private sync(): void {
    const { model } = this;
    const { hero, minutes } = model;
    const cathedral = this.cathedralAt();
    const bands = model.travellers.bands;
    for (const [key, party] of [...this.parties]) {
      const band = bands.get(Number(key.split(':')[0]));
      party.members = band === party.band ? party.members.filter((t) => band.list.includes(t)) : [];
      if (party.members.length === 0) this.parties.delete(key);
    }
    for (const [bandKey, band] of bands) {
      band.roads.forEach((road, r) => {
        const key = `${bandKey}:${r}`;
        const mid = road.route[Math.floor(road.route.length / 2)];
        if (!mid) return;
        const party = this.parties.get(key);
        const cut = this.cutDown.get(key);
        const wanted = (cut === undefined || minutes - cut >= DAY_MINUTES) && hashUnit(bandKey, r, 977) < this.chanceAt({ x: mid[0], z: mid[1] }, cathedral);
        if (party && !wanted && !party.coming && party.members.every((t) => far(t, hero, UNSEEN))) this.callOff(party);
        else if (!party && wanted && !this.hunts.some((h) => h.party.key === key)) this.setOut(key, band, r);
      });
    }
  }

  // A party set out on a road, somewhere along it out of the hero's sight (none, if it's all in sight).
  setOut(key: string, band: Travellers, road: number, at?: { along: number; way: 1 | -1 }): Party | null {
    const { model } = this;
    const route = band.roads[road].route;
    const [bandKey] = key.split(':').map(Number);
    let along = at?.along ?? hashUnit(bandKey, road, 978) * (route.length - 1);
    const way = at?.way ?? (hashUnit(bandKey, road, 979) < 0.5 ? 1 : -1);
    if (!at) {
      const point = (a: number) => route[Math.max(0, Math.min(route.length - 1, Math.round(a)))];
      const spot = [along, 0, route.length - 1].find((a) => far({ x: point(a)[0], z: point(a)[1] }, model.hero, UNSEEN));
      if (spot === undefined) return null;
      along = spot;
    }
    const members: Traveller[] = [];
    for (let i = 0; i < this.size; i++) {
      const id = FINDER_ID + bandKey * 2 ** 16 + road * 8 + i;
      const t = makeTraveller(id, 'finder', road, along - way * FOLLOW * i, way, band.roads, model.seed + bandKey, spawnOf(model.size), members[i - 1]?.id ?? null);
      members.push(t);
      model.travellers.join(band, t);
    }
    const party: Party = { key, band, road, members, coming: false, going: false, asked: -Infinity };
    this.parties.set(key, party);
    return party;
  }

  private callOff(party: Party): void {
    for (const t of party.members) this.model.travellers.lose(t);
    this.parties.delete(party.key);
    if (this.stopped === party) this.stopped = null;
  }

  // A party's step: coming to the hero for a word (or giving it up), going back to the road after.
  private step(party: Party, dt: number): void {
    const { model } = this;
    const { hero } = model;
    const [leader] = party.members;
    if (party.going) return this.goBack(party, dt);
    if (!party.coming) {
      const near = !far(leader, hero, SPOT);
      const heard = model.heat.known(leader);
      if (near && !this.scattered && !model.inside && !model.outdoors.seated && model.minutes - party.asked >= ASKED_AGAIN && heard >= this.heeded) {
        party.coming = true;
        for (const t of party.members) t.off = { x: t.x, z: t.z };
      }
      return;
    }
    if (this.stopped === party) return; // (stood, waiting on the word: questioning.ts)
    if (model.inside || far(leader, hero, SLIPPED)) return this.slipped(party);
    party.members.forEach((t, i) => {
      const angle = Math.atan2(t.x - hero.x, t.z - hero.z) + (i === 0 ? 0 : ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 3);
      const reach = i === 0 ? TALK * 0.9 : ROUND;
      const to = i === 0 ? { x: hero.x + ((t.x - hero.x) / Math.max(1e-6, Math.hypot(t.x - hero.x, t.z - hero.z))) * reach, z: hero.z + ((t.z - hero.z) / Math.max(1e-6, Math.hypot(t.x - hero.x, t.z - hero.z))) * reach } : { x: hero.x + Math.sin(angle) * reach, z: hero.z + Math.cos(angle) * reach };
      walkTo(t, to, COME * dt, party.band, model);
      t.facing = turnToward(t.facing, Math.atan2(hero.x - t.x, hero.z - t.z), dt);
    });
    if (!far(leader, hero, TALK)) this.stopped = party;
  }

  // Walked off before they were reached: wanted, it's a run (questioning.ts); else a shrug, and back to the road.
  private slipped(party: Party): void {
    if (this.model.heat.known(party.members[0]) >= WANTED) this.hunt(party, 'seize');
    else this.letGo(party);
  }

  // The word had (or given up): asked, back to the road.
  letGo(party: Party): void {
    [party.coming, party.going, party.asked] = [false, true, this.model.minutes];
    if (this.stopped === party) this.stopped = null;
  }

  private goBack(party: Party, dt: number): void {
    let home = true;
    for (const t of party.members) {
      if (!t.off) continue;
      if (walkTo(t, t.off, COME * 0.7 * dt, party.band, this.model)) t.off = null;
      else home = false;
    }
    if (home) party.going = false;
  }

  // Turned on the hero: off the road, foes in what they wore, after them (`mode`: to seize them, or to fight).
  hunt(party: Party, mode: HuntMode): Hunt {
    const { model } = this;
    if (this.stopped === party) this.stopped = null;
    this.parties.delete(party.key);
    const [leader] = party.members;
    const back = leader.off ?? leader;
    const level = Math.max(leader.level, model.hero.level);
    const foes = party.members.map((t) => {
      model.travellers.lose(t);
      const foe = makeEnemy(this.nextFoe++, 'witchFinder', t.x, t.z, back.x, back.z, level);
      Object.assign(foe, { y: t.y, human: { look: t.look, equipment: t.equipment }, state: 'chase', lastSeen: { x: model.hero.x, z: model.hero.z } });
      model.enemies.push(foe);
      return foe;
    });
    const hunt: Hunt = { party, along: leader.along, way: leader.way, foes, mode };
    this.hunts.push(hunt);
    return hunt;
  }

  // The hunt among foes this frame: struck first while only seizing, a fight; all cut down, blood on the hero's
  // hands; got away from, back to the road.
  private hunting(hunt: Hunt): void {
    const { model } = this;
    const alive = hunt.foes.filter((e) => e.state !== 'dead');
    if (hunt.mode === 'seize' && hunt.foes.some((e) => e.hp < e.maxHp)) {
      hunt.mode = 'fight';
      model.heat.raise(hunt.foes[0], 2, 'struck the bishop\'s men');
    }
    if (alive.length === 0) {
      this.hunts.splice(this.hunts.indexOf(hunt), 1);
      this.cutDown.set(hunt.party.key, model.minutes);
      model.heat.blood++;
      model.heat.raise(hunt.foes[0], 2, 'cut down the bishop\'s men');
      return;
    }
    const gone = alive.every((e) => e.state === 'wander' || far(e, model.hero, GAVE_UP)) || model.inside !== null;
    if (gone) this.giveUp(hunt);
  }

  // A hunt given up: its foes gone from the world, back on their road as they were (those left), the word going round.
  giveUp(hunt: Hunt, told = true): void {
    const { model } = this;
    this.hunts.splice(this.hunts.indexOf(hunt), 1);
    for (const e of hunt.foes) if (model.enemies.includes(e)) model.enemies.splice(model.enemies.indexOf(e), 1);
    if (told) model.heat.raise(hunt.foes[0], 1, 'got away from the bishop\'s men');
    const { party } = hunt;
    const band = model.travellers.bands.get(Number(party.key.split(':')[0]));
    if (band !== party.band || this.parties.has(party.key)) return;
    const again = this.setOut(party.key, band, party.road, { along: hunt.along, way: hunt.way });
    if (again) again.asked = model.minutes;
  }

  // Whether `foe` is a witch-finder out to seize the hero (their blow takes hold, hurting nothing).
  seizing(foe: Enemy): boolean {
    return this.hunts.some((h) => h.mode === 'seize' && h.foes.includes(foe));
  }

  // Whether the hero is being hunted (any mode), and how.
  get hunted(): HuntMode | null {
    return this.hunts.find((h) => h.mode === 'fight')?.mode ?? this.hunts[0]?.mode ?? null;
  }

  // Every hunt called off (the hero taken to the stocks): back to the road, nothing more said of it.
  endHunts(): void {
    for (const hunt of [...this.hunts]) this.giveUp(hunt, false);
  }

  // Kept in the save: the roads a party was cut down on, and each hunt under way counted as got away from (where it
  // was, for the word to go round as it's taken up: its foes aren't saved).
  save(): { cut: Array<[string, number]>; fled: Array<[number, number]> } {
    return { cut: [...this.cutDown], fled: this.hunts.map(({ foes: [e] }) => [Math.round(e.x), Math.round(e.z)]) };
  }

  // As saved (an older save's, or anything amiss: none cut down, none got away from).
  load(saved: unknown): void {
    this.cutDown.clear();
    const { cut, fled } = (saved && typeof saved === 'object' ? saved : {}) as Partial<ReturnType<Patrols['save']>>;
    for (const e of Array.isArray(cut) ? cut : []) if (Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])) this.cutDown.set(e[0], e[1]);
    for (const e of Array.isArray(fled) ? fled : []) if (Array.isArray(e) && Number.isFinite(e[0]) && Number.isFinite(e[1])) this.model.heat.raise({ x: e[0], z: e[1] }, 1, 'got away from the bishop\'s men');
  }
}

// Whether `a` is at least `d` tiles from `b`.
const far = (a: { x: number; z: number }, b: { x: number; z: number }, d: number): boolean => Math.hypot(a.x - b.x, a.z - b.z) >= d;

// A step toward `to` (axis by axis, round what's in the way; through it, hemmed in): whether they're there.
function walkTo(t: Traveller, to: { x: number; z: number }, step: number, band: Travellers, model: Pick<GameModel, 'getGroundY'>): boolean {
  const [dx, dz] = [to.x - t.x, to.z - t.z];
  const d = Math.hypot(dx, dz);
  if (d <= Math.max(step, 0.05)) return ([t.x, t.z] = [to.x, to.z], (t.y = model.getGroundY(t.x, t.z)), true);
  const [sx, sz] = [(dx / d) * step, (dz / d) * step];
  const [x0, z0] = [t.x, t.z];
  if (!band.blocked(t.x + sx, t.z)) t.x += sx;
  if (!band.blocked(t.x, t.z + sz)) t.z += sz;
  if (Math.hypot(t.x - x0, t.z - z0) < step * 0.5) [t.x, t.z] = [x0 + sx, z0 + sz]; // (hemmed in: through, rather than stuck)
  t.y = model.getGroundY(t.x, t.z);
  t.facing = turnToward(t.facing, Math.atan2(dx, dz), 1 / 30);
  return false;
}
