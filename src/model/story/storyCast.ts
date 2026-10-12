// Who's who, and what's where, for the quests people give (story.ts): each village's setting (its keepers, two of its
// villagers, the barmaid of the village nearest it, the ruin, camp and cave nearest it, its names), and the first
// village's own (the one nearest where the hero set out: the carter too, and the ruin nearest the start). Worked out
// from the world as it stands (a streamed world's: the villages on its maps), afresh only as that changes.
import type { Camp } from '../camps/camps';
import { campName } from '../camps/campNames';
import type { Cave } from '../caves/caves';
import { zoneLevel } from '../enemies/enemyLevels';
import type { Entrance } from '../interiors/interiors';
import { spawnOf, type MapSize } from '../map/grid';
import type { Npc } from '../npcs/npcs';
import type { Ruin } from '../ruins/ruins';
import type { Scenery } from '../scenery/scenery';
import type { Traveller } from '../travellers/travellers';
import type { Village } from '../types';
import { villageName } from '../villages/villageNames';
import { carterOf, type Carter } from './carter';
import type { StoryPlace, StoryRole } from './storyQuests';

export type Who = Carter | Npc | Traveller;
export type Point = { x: number; z: number };

export const isTraveller = (who: Who): who is Traveller => 'road' in who;
// The keepers' parts, by their trade.
const KEEPERS = { barmaid: 'barkeep', smith: 'smith', herbalist: 'herbalist', bouncer: 'bouncer' } as const satisfies Partial<Record<StoryRole, Npc['role']>>;
// The parts `who` may play in a quest: the carter's, a keeper's own, either villager's, on the road their calling's.
export function partsOf(who: Who): StoryRole[] {
  if (isTraveller(who)) return [who.role as StoryRole];
  if (!('role' in who)) return ['carter'];
  if (who.role === 'villager') return ['villagerA', 'villagerB'];
  return (Object.keys(KEEPERS) as Array<keyof typeof KEEPERS>).filter((part) => KEEPERS[part] === who.role);
}

export interface Setting {
  key: string; // 'first', or its village's number: what its quests are kept by
  village: Village;
  level: number; // what its quests pay by
  who: Partial<Record<StoryRole, Who>>;
  place: Partial<Record<StoryPlace, Point>>;
  inn: Entrance | null;
  names: { village: string; next: string; camp: string };
}

export interface CastHost {
  readonly seed: number;
  readonly size: MapSize;
  readonly villages: readonly Village[];
  readonly npcs: readonly Npc[];
  readonly scenery: readonly Scenery[];
  readonly ruins: readonly Ruin[];
  readonly camps: readonly Camp[];
  readonly caves: readonly Cave[];
  boardOf(village: Village): number;
}

const NEAR = 320; // tiles from a village a ruin, a camp or a cave still counts as its own
const NEXT = 700; // and the next village
export const far = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// The nearest of `list` to `to` (each one's spot: `at`), within so far.
export const nearest = <T>(list: readonly T[], at: (item: T) => Point, to: Point, within = Infinity): T | null => {
  let [best, d]: [T | null, number] = [null, within];
  for (const item of list) {
    const now = far(at(item), to);
    if (now < d) [best, d] = [item, now];
  }
  return best;
};
const middle = (r: Ruin): Point => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 });

// What changes when the world about does: asked before working any of it out again.
// (How many of each, and which: the first and last village and villager, for a streamed world that lets a region go
// and makes another of the same size.)
export const castKey = (host: CastHost): string => {
  const [v, n] = [host.villages, host.npcs];
  const ends = v.length ? `${v[0].x},${v[0].z},${v[v.length - 1].x},${v[v.length - 1].z}` : '';
  return `${v.length}|${n.length}|${host.scenery.length}|${host.ruins.length}|${host.camps.length}|${host.caves.length}|${ends}|${n.length ? `${n[0].id},${n[n.length - 1].id}` : ''}`;
};

export function castOf(host: CastHost): { first: Setting | null; firstRuin: Ruin | null; villages: Setting[] } {
  const spawn = spawnOf(host.size);
  const folk = new Map<Village, Npc[]>();
  for (const n of host.npcs) folk.set(n.village, [...(folk.get(n.village) ?? []), n]);
  const keeper = (v: Village, role: Npc['role']) => folk.get(v)?.find((n) => n.role === role);
  const villages = host.villages.map((village): Setting => {
    const mine = folk.get(village) ?? [];
    const villagers = mine.filter((n) => n.role === 'villager').sort((a, b) => a.id - b.id);
    const b = villagers.find((n, i) => i > 0 && n.field) ?? villagers[1]; // (one who works a field, if any does: the boars are theirs)
    const keepers = Object.fromEntries((Object.keys(KEEPERS) as Array<keyof typeof KEEPERS>).map((part) => [part, keeper(village, KEEPERS[part])])) as Partial<Record<keyof typeof KEEPERS, Npc>>;
    const barmaid = keepers.barmaid;
    const next = nearest(host.villages.filter((v) => v !== village && keeper(v, KEEPERS.barmaid)), (v) => v, village, NEXT);
    const [ruin, camp, cave] = [nearest(host.ruins, middle, village, NEAR), nearest(host.camps, (c) => c, village, NEAR), nearest(host.caves, (c) => c.entrance, village, NEAR)];
    return {
      key: String(host.boardOf(village)),
      village,
      level: zoneLevel(spawn, village),
      who: { ...keepers, villagerA: villagers[0], villagerB: b, nextBarmaid: (next && keeper(next, KEEPERS.barmaid)) ?? undefined },
      place: { ruin: ruin ? middle(ruin) : undefined, camp: camp?.way, cave: cave?.entrance },
      inn: barmaid?.home ?? null,
      names: { village: villageName(village, host.seed), next: next ? villageName(next, host.seed) : 'the next village', camp: camp ? campName(camp, host.seed) : 'the camp' },
    };
  });
  // The first village's: the one nearest the start, with the carter by his wagon and the ruin nearest the start.
  const home = nearest(villages, (s) => s.village, spawn);
  const carter = carterOf(host);
  const firstRuin = nearest(host.ruins, middle, spawn);
  const first = home && carter && home.who.barmaid ? { ...home, key: 'first', level: 1, who: { ...home.who, carter }, place: { ...home.place, ruin: firstRuin ? middle(firstRuin) : undefined } } : null;
  return { first, firstRuin, villages };
}
