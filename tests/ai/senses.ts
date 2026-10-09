// What the AI sees (player.ts): what's on a player's screen, as numbers, and no more. How they stand (the HUD: health,
// energy, breath, level, coin, the clock, where they are); what E would do (the prompt over whatever's in reach), and
// F and G (an ale, a pie, a room, sleep); the quests tracked (each how far along, which way, how far); the ground round
// them, tile by tile (15 a side); the nearest things in view, each by kind and offset (foes, doors and places, loot,
// folk, trees, a traveller); the open window's rows (windows.ts); and what the game just told (floating text, a word).
// No map it hasn't walked, no foe past the screen's edge, nothing hidden.
import type { GameModel } from '../../src/model/GameModel';
import type { Enemy, Tree, Village } from '../../src/model/types';
import type { Entrance } from '../../src/model/interiors/interiors';
import type { Camp } from '../../src/model/camps/camps';
import { campLevel } from '../../src/model/camps/camps';
import { armorOf, blowOf, maxEnergyOf, maxHpOf } from '../../src/model/hero/attributes';
import { xpToNext } from '../../src/model/hero/heroStats';
import { bagRoom } from '../../src/model/hero/bagSlots';
import { slotsUsed } from '../../src/model/hero/bagStacks';
import { betterThanWorn, isGear } from '../../src/model/human/items/gear';
import { LOOT_QUALITY } from '../../src/model/loot/loot';
import { chestInReach } from '../../src/model/loot/chests';
import { talkingTo } from '../../src/model/npcs/talk';
import { travellerInReach } from '../../src/model/travellers/travellerTalk';
import { doorAt, stairsInReach } from '../../src/model/interiors/upstairs';
import { bumpsFurniture } from '../../src/model/interiors/furniture';
import { boardSpot } from '../../src/model/quests/noticeBoards';
import { onPaving } from '../../src/model/map/roads';
import { goesUnder } from '../../src/model/dungeons/dungeonTypes';
import { dungeonAt } from '../../src/model/dungeons/dungeons';
import { isHerbalistHome } from '../../src/model/herbalist/herbalistHomes';
import { gradeOf, WOOD } from '../../src/model/skills/lumber';
import { skillOf } from '../../src/model/skills/skills';
import { atTheBar } from '../../src/controller/trade/barOrder';
import { roomAction } from '../../src/model/inn/roomLetting';
import { HERO_RADIUS, INDOOR_SCALE } from '../../src/model/constants';
import { Nearby } from '../../src/util/nearby';
import { CATEGORIES, WINDOW_KINDS, shown, type Window } from './windows';
import { ROWS } from './keys';

export const VIEW = 7; // tiles each way round the hero (15 a side: about the screen)
const SIDE = 2 * VIEW + 1;
const GRID_CHANNELS = 12;
export const PATCH = 8; // tiles a side of a patch of ground, walked or not (player.ts pays for each new one)
export const patchOf = (x: number, z: number): number => Math.floor(x / PATCH) * 4096 + Math.floor(z / PATCH);
export const PROMPTS = ['none', 'work', 'stopChop', 'loot', 'jobBoard', 'chest', 'chop', 'barmaidFromStool', 'standUp', 'getUp', 'sit', 'lie', 'barmaid', 'smith', 'herbalist', 'bouncer', 'pedlar', 'traveller', 'board', 'bench', 'well', 'hallDoor', 'stairs', 'leave', 'door', 'dungeon', 'cannotChop'] as const;
export type Prompt = (typeof PROMPTS)[number];
const PLACES = ['outdoors', 'house', 'inn', 'smithy', 'herbalist', 'crypt', 'cave', 'upstairs', 'camp'] as const;
const FOE_GROUPS = ['beast', 'bandit', 'undead', 'boss', 'crawler'] as const;
const DOOR_KINDS = ['house', 'inn', 'smithy', 'herbalist', 'crypt', 'cave', 'camp'] as const;
const LOOT_KINDS = ['junk', 'ingredient', 'common', 'gear', 'potion', 'tool', 'bag', 'quest'] as const;
const ROLES = ['villager', 'barkeep', 'server', 'smith', 'bouncer', 'herbalist'] as const;
export const EVENTS = ['coins', 'hitTaken', 'hitDealt', 'dodge', 'guard', 'levelUp', 'quest', 'questDone', 'blessing', 'arrive', 'campGate', 'village', 'shift', 'jobRank', 'cleared', 'locked', 'poor', 'mending', 'skillUp', 'crafted', 'salvaged', 'felled', 'say'] as const;
const TRACKED = 3;
const [FOES, DOORS, LOOT, FOLK, TREES] = [4, 4, 3, 3, 2];
const HUD = 30;
export const OBSERVATION_SIZE = HUD + PLACES.length + PROMPTS.length + 4 + TRACKED * 8 + SIDE * SIDE * GRID_CHANNELS + FOES * 12 + DOORS * 12 + LOOT * 12 + FOLK * 9 + TREES * 5 + 4 + (WINDOW_KINDS.length + 4) + ROWS * (8 + CATEGORIES.length) + EVENTS.length;

const foeGroup = (kind: Enemy['kind']): (typeof FOE_GROUPS)[number] =>
  kind === 'banditChief' || kind === 'cryptLord' || kind === 'broodMother' ? 'boss' : kind === 'bandit' ? 'bandit' : kind === 'skeleton' || kind === 'skeletonArcher' || kind === 'draugr' || kind === 'ghost' ? 'undead' : kind.startsWith('cave') || kind === 'hatchling' ? 'crawler' : 'beast';
const doorKind = (door: Entrance): (typeof DOOR_KINDS)[number] => (door.type === 'house' && isHerbalistHome(door) ? 'herbalist' : (door.type as (typeof DOOR_KINDS)[number]));
const oneHot = <T extends readonly string[]>(list: T, value: T[number] | null): number[] => list.map((v) => (v === value ? 1 : 0));

// What E would do now: the prompt, in the order the game decides it (GameController, main.ts promptTarget).
export function prompt(model: GameModel): Prompt {
  const { hero, inside } = model;
  if (model.work.shift) return model.work.action ? 'work' : model.work.noticeInReach ? 'jobBoard' : 'none';
  if (model.lumber.chopping) return 'stopChop';
  if (model.lootInReach) return 'loot';
  if (model.work.noticeInReach) return 'jobBoard';
  if (chestInReach(model)) return 'chest';
  const chop = model.lumber.action;
  if (chop?.kind === 'chop') return 'chop';
  const talker = talkingTo(model.folk, inside, hero);
  const seated = model.seated;
  if (seated) return seated.seat.piece.kind === 'barStool' && talker?.role === 'barkeep' ? 'barmaidFromStool' : seated.seat.lying ? 'getUp' : 'standUp';
  const seat = model.seatInReach;
  if (seat) return seat.lying ? 'lie' : 'sit';
  const leaving = !!inside && !!model.doorInReach;
  if (talker && !leaving) return talker.role === 'barkeep' ? 'barmaid' : talker.role === 'smith' ? 'smith' : talker.role === 'herbalist' ? 'herbalist' : 'bouncer';
  const traveller = !inside && !model.yard ? travellerInReach(model.travellers.list, hero) : null;
  if (traveller) return traveller.role === 'pedlar' ? 'pedlar' : 'traveller';
  if (model.boardInReach !== null) return 'board';
  if (model.salvage.benchInReach) return 'bench';
  if (model.wellInReach !== null) return 'well';
  if (inside?.below && doorAt(inside, hero)) return 'hallDoor';
  if (inside && stairsInReach(inside, hero)) return 'stairs';
  const door = model.doorInReach;
  if (!door) return chop ? 'cannotChop' : 'none';
  if (inside) return 'leave';
  return goesUnder(door) ? 'dungeon' : 'door';
}

// The lists near the hero, kept to hand (the world's whole lists are long).
export class Senses {
  private readonly trees: Nearby<Tree>;
  private readonly doors: Nearby<Entrance>;
  private readonly camps: Nearby<Camp>;
  private readonly villages: Nearby<Village>;

  constructor(private readonly model: GameModel) {
    this.trees = new Nearby(model.trees, (t) => t, VIEW + 2);
    this.doors = new Nearby(model.entrances, (e) => e, 60);
    this.camps = new Nearby(model.camps, (c) => c, 60);
    this.villages = new Nearby(model.villages, (v) => v, 60);
  }

  // Everything seen, as OBSERVATION_SIZE numbers.
  // (`walked`: the patches of ground this life has been on, as a player remembers where they've been)
  observe(window: Window | null, events: ReadonlySet<string>, walked: ReadonlySet<number> = new Set()): number[] {
    const { model } = this;
    const { hero, inside, moves } = model;
    const out: number[] = [];
    const camp = !inside ? model.campLife.status(hero) : null;
    const minutes = model.minutes % (24 * 60);
    const hour = (minutes / 60 / 24) * 2 * Math.PI;
    const seated = model.seated;
    out.push(
      hero.hp / maxHpOf(hero), hero.energy / maxEnergyOf(hero), moves.breath / moves.most, moves.guard === null ? 0 : 1, moves.rollProgress === null ? 0 : 1, model.attackProgress === null ? 0 : 1,
      hero.level / 20, hero.xp / xpToNext(hero.level), Math.log1p(hero.money) / 10, hero.statPoints > 0 ? 1 : 0, Math.sin(hour), Math.cos(hour),
      seated ? 1 : 0, seated?.seat.lying ? 1 : 0, hero.eating || hero.drinking ? 1 : 0, model.work.shift ? 1 : 0, model.lumber.chopping ? 1 : 0, model.woodworking.making ? 1 : 0, model.salvage.breaking ? 1 : 0, (hero.potionCooldown ?? 0) > 0 ? 1 : 0,
      skillOf(hero, 'lumberjacking').level / 300, skillOf(hero, 'woodworking').level / 300, skillOf(hero, 'salvaging').level / 300, armorOf(hero) / 50, blowOf(hero) / 20, slotsUsed(hero.bag) / bagRoom(hero), model.lumber.axe ? 1 : 0, model.quests.taken.length / 4, model.focused ? 1 : 0, hero.hurtFor > 0 ? 1 : 0,
    );
    const place = inside ? (inside.below ? 'upstairs' : inside.entrance.type === 'house' && isHerbalistHome(inside.entrance) ? 'herbalist' : (inside.entrance.type as (typeof PLACES)[number])) : camp ? 'camp' : 'outdoors';
    out.push(...oneHot(PLACES, place));
    out.push(...oneHot(PROMPTS, prompt(model)));
    const action = roomAction(model);
    const canOrder = atTheBar(model) && !hero.drinking && !hero.eating;
    out.push(canOrder ? 1 : 0, canOrder ? 1 : 0, action?.kind === 'rent' && !action.taken ? 1 : 0, action?.kind === 'sleep' ? 1 : 0);
    this.tracker(out);
    this.grid(out, walked);
    this.lists(out);
    this.window(out, window);
    out.push(...EVENTS.map((e) => (events.has(e) ? 1 : 0)));
    return out;
  }

  // The quests tracked, as the tracker's cards: how far along, done, which way (the nearest marked foe, where they
  // gather; done, back to the board) and how far.
  private tracker(out: number[]): void {
    const { model } = this;
    const { hero, inside } = model;
    const shown = model.quests.taken.filter((t) => t.tracked).slice(0, TRACKED);
    for (let i = 0; i < TRACKED; i++) {
      const t = shown[i];
      if (!t) {
        out.push(0, 0, 0, 0, 0, 0, 0, 0);
        continue;
      }
      const done = model.quests.done(t);
      const goal = inside ? null : done ? (boardSpot(model, t.quest.board) ?? t.quest) : (model.enemies.find((e) => e.quest === t.quest.key && e.state !== 'dead') ?? t.quest);
      const [gx, gz] = goal ? [goal.x - hero.x, goal.z - hero.z] : [0, 0];
      const d = Math.hypot(gx, gz) || 1;
      out.push(1, t.quest.kind === 'kill' ? 1 : 0, model.quests.progress(t) / t.quest.count, done ? 1 : 0, gx / d, gz / d, Math.min(d, 200) / 200, (t.quest.level - hero.level) / 6);
    }
  }

  // The ground round them, tile by tile (indoors: the room's floor and furniture).
  private grid(out: number[], walked: ReadonlySet<number>): void {
    const { model } = this;
    const { hero, inside } = model;
    const [cx, cz] = [Math.round(hero.x), Math.round(hero.z)];
    const r = HERO_RADIUS * (inside ? INDOOR_SCALE : 1);
    const foes = model.foes.filter((e) => e.state !== 'dead' && !e.buried && Math.abs(e.x - hero.x) <= VIEW + 1 && Math.abs(e.z - hero.z) <= VIEW + 1);
    const folk = model.folk.filter((n) => n.where === (inside?.entrance ?? null) && Math.abs(n.x - hero.x) <= VIEW + 1 && Math.abs(n.z - hero.z) <= VIEW + 1);
    const loot = [...model.groundHere.loot, ...model.groundHere.coins].filter((l) => Math.abs(l.x - hero.x) <= VIEW + 1 && Math.abs(l.z - hero.z) <= VIEW + 1);
    const doors = inside ? [] : this.doors.near(hero).filter((e) => Math.abs(e.x - hero.x) <= VIEW + 1 && Math.abs(e.z - hero.z) <= VIEW + 1);
    const trees = inside ? [] : this.trees.near(hero).filter((t) => !model.lumber.felled(t));
    const level = skillOf(hero, 'lumberjacking').level;
    const at = (list: ReadonlyArray<{ x: number; z: number }>, x: number, z: number) => list.find((p) => Math.round(p.x) === x && Math.round(p.z) === z);
    const seats = inside ? inside.furniture.filter((f) => ['chair', 'armchair', 'bench', 'barStool', 'bed', 'doubleBed', 'roomBed'].includes(f.kind)) : [];
    const specials = inside ? inside.furniture.filter((f) => ['stairs', 'stairwell', 'noticeBoard', 'salvageBench', 'counter', 'hallDoor'].includes(f.kind)) : [];
    const within = (f: { x: number; z: number; w?: number; d?: number }, x: number, z: number) => x >= f.x && x < f.x + (f.w ?? 1) && z >= f.z && z < f.z + (f.d ?? 1);
    const chest = chestInReach(model);
    const well = !inside && this.villages.near(hero).find((v) => Math.abs(v.x - hero.x) <= VIEW + 1 && Math.abs(v.z - hero.z) <= VIEW + 1);
    for (let dx = -VIEW; dx <= VIEW; dx++) {
      for (let dz = -VIEW; dz <= VIEW; dz++) {
        const [x, z] = [cx + dx, cz + dz];
        const blocked = inside ? x < 0 || z < 0 || x >= inside.room.width || z >= inside.room.depth || bumpsFurniture(inside.furniture, x, z, r) || !!inside.walls?.(x, z, r) : model.isBlocked(x, z, HERO_RADIUS);
        const foe = at(foes, x, z) as Enemy | undefined;
        const tree = inside ? undefined : (at(trees, x, z) as Tree | undefined);
        const special = inside ? specials.some((f) => within(f, x, z)) : (chest && Math.round(chest.x) === x && Math.round(chest.z) === z) || (well && Math.round(well.x) === x && Math.round(well.z) === z) || false;
        out.push(
          blocked ? 1 : 0,
          !inside && model.tiles.lake(x, z) ? 1 : 0,
          !inside && onPaving(model.tiles, x, z) ? 1 : 0,
          inside ? (x === inside.room.door && z === inside.room.depth - 1 ? 1 : 0) : at(doors, x, z) ? 1 : 0,
          foe ? Math.max(0.2, Math.min(1, 0.5 + (foe.level - hero.level) / 6)) : 0,
          foe ? foe.hp / foe.maxHp : 0,
          at(folk, x, z) ? 1 : 0,
          at(loot, x, z) ? 1 : 0,
          tree ? (model.lumber.axe && WOOD[gradeOf(tree, model.seed)].needs <= level ? 1 : 0.5) : 0,
          inside && seats.some((f) => within(f, x, z)) ? 1 : 0,
          special ? 1 : 0,
          !inside && walked.has(patchOf(x, z)) ? 1 : 0,
        );
      }
    }
  }

  // The nearest of each kind in view, by offset.
  private lists(out: number[]): void {
    const { model } = this;
    const { hero, inside } = model;
    const d2 = (p: { x: number; z: number }) => (p.x - hero.x) ** 2 + (p.z - hero.z) ** 2;
    const nearest = <T extends { x: number; z: number }>(list: readonly T[], n: number, reach: number) => list.filter((p) => d2(p) <= reach * reach).sort((a, b) => d2(a) - d2(b)).slice(0, n);
    const pad = (n: number, width: number) => { for (let i = 0; i < n * width; i++) out.push(0); };
    const foes = nearest(model.foes.filter((e) => e.state !== 'dead' && !e.buried), FOES, VIEW + 3);
    for (const e of foes) out.push(1, (e.x - hero.x) / 10, (e.z - hero.z) / 10, (e.level - hero.level) / 6, e.hp / e.maxHp, e.state === 'chase' ? 1 : 0, e.quest ? 1 : 0, ...oneHot(FOE_GROUPS, foeGroup(e.kind)));
    pad(FOES - foes.length, 12);
    const spots: Array<{ x: number; z: number; kind: (typeof DOOR_KINDS)[number]; level: number; cleared: number }> = inside ? [] : [
      ...this.doors.near(hero).filter((e) => e.type !== 'crypt' && e.type !== 'cave').map((e) => ({ x: e.x, z: e.z, kind: doorKind(e), level: 0, cleared: 0 })),
      ...this.doors.near(hero).filter((e) => goesUnder(e)).map((e) => ({ x: e.x, z: e.z, kind: doorKind(e), level: (dungeonAt(e)?.level ?? hero.level) - hero.level, cleared: model.clearedShare(e) })),
      ...this.camps.near(hero).map((c) => ({ x: c.way.x, z: c.way.z, kind: 'camp' as const, level: campLevel(c, model.size) - hero.level, cleared: model.campLife.status({ x: c.x, z: c.z })?.cleared ? 1 : 0 })),
    ];
    const near = nearest(spots, DOORS, 40);
    for (const s of near) out.push(1, (s.x - hero.x) / 40, (s.z - hero.z) / 40, ...oneHot(DOOR_KINDS, s.kind), s.level / 6, s.cleared);
    pad(DOORS - near.length, 12);
    const loot = nearest([...model.groundHere.loot, ...model.groundHere.coins.map((c) => ({ ...c, item: null }))], LOOT, VIEW + 1);
    for (const l of loot) {
      const item = (l as { item: string | null }).item;
      const kind = item === null ? 'common' : isGear(item) ? 'gear' : (LOOT_QUALITY[item as never] ?? 'common');
      out.push(1, (l.x - hero.x) / 10, (l.z - hero.z) / 10, ...oneHot(LOOT_KINDS, kind), item && isGear(item) && betterThanWorn(item, hero) ? 1 : 0);
    }
    pad(LOOT - loot.length, 12);
    const folk = nearest(model.folk.filter((n) => n.where === (inside?.entrance ?? null)), FOLK, VIEW + 1);
    for (const n of folk) out.push(1, (n.x - hero.x) / 10, (n.z - hero.z) / 10, ...oneHot(ROLES, n.role));
    pad(FOLK - folk.length, 9);
    const level = skillOf(hero, 'lumberjacking').level;
    const trees = inside ? [] : nearest(this.trees.near(hero).filter((t) => !model.lumber.felled(t)), TREES, VIEW + 1);
    for (const t of trees) {
      const grade = gradeOf(t, model.seed);
      out.push(1, (t.x - hero.x) / 10, (t.z - hero.z) / 10, WOOD[grade].needs / 100, model.lumber.axe && WOOD[grade].needs <= level ? 1 : 0);
    }
    pad(TREES - trees.length, 5);
    const traveller = inside ? null : nearest(model.travellers.list, 1, VIEW + 3)[0];
    if (traveller) out.push(1, (traveller.x - hero.x) / 10, (traveller.z - hero.z) / 10, traveller.role === 'pedlar' ? 1 : 0);
    else out.push(0, 0, 0, 0);
  }

  // The open window: which, its page, and its rows on show.
  private window(out: number[], window: Window | null): void {
    out.push(...oneHot(WINDOW_KINDS, window?.kind ?? null), window ? 1 : 0, window?.page === 'sell' ? 1 : 0, window ? window.offset / ROWS : 0, window?.modal ? 1 : 0);
    const rows = window ? shown(window) : [];
    for (let i = 0; i < ROWS; i++) {
      const r = rows[i];
      if (!r) {
        for (let k = 0; k < 8 + CATEGORIES.length; k++) out.push(0);
        continue;
      }
      out.push(1, ...oneHot(CATEGORIES, r.category), Math.log1p(r.price) / 10, r.affordable ? 1 : 0, r.better ? 1 : 0, Math.log1p(r.count) / 5, r.level / 6, r.can ? 1 : 0, r.flag ? 1 : 0);
    }
  }
}
