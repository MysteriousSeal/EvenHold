// Enemies: wolf packs in the forests, boars rooting in the woods (passive:
// they fight only once hit), bandits in their camps (camps/camps.ts), ghosts
// haunting the old ruins (bound to them: never out past their walls),
// wolves and a camp near spawn to meet early. They
// wander around home, chase the hero on sight, give up if outrun (or led too far from home), and
// attack once within reach. Placed from hashes and
// noise, not the world rng, so they don't change the world.

import { noticeFactor, type Blessing } from '../hero/blessing';
import { DUNGEON_FAMILIES, DUNGEON_LEASH, ENEMY_HEARING, ENEMY_LEASH, ENEMY_LOSE_TIME, ENEMY_STATS, VILLAGE_OUTER_RADIUS, WAIT_DISTANCE } from '../constants';
import type { Enemy, EnemyKind, Village } from '../types';
import type { Camp } from '../camps/camps';
import { CHIEF_OUTFIT, chiefLevel, chiefName, chiefSpot } from '../camps/campChief';
import type { Ruin } from '../ruins/ruins';
import { createForestDensity } from '../worldgen/trees';
import { hashUnit } from '../../util/random';
import { pickOutfit } from '../human/equipment';
import { lookAt } from '../human/humanoid';
import { enemyLevel, enemyPower } from './enemyLevels';
import { inArea, ownsSite, wholeMap, type Area, type MapSize } from '../map/grid';

interface Sites {
  grid: number; // one candidate site per grid x grid tiles
  chance: number;
  forest: (density: number) => boolean; // which land it likes
  clearance: number; // from villages
}
// Dense enough that walking any direction meets something every so often:
// wolf packs in the woods, fewer out on open ground, and bandit camps in the
// countryside between villages.
export const WILD_SITES: Record<'packs' | 'meadowPacks' | 'boars' | 'bears' | 'lynxes', Sites> = {
  packs: { grid: 18, chance: 0.91, forest: (d) => d >= 0.2, clearance: 14 },
  meadowPacks: { grid: 32, chance: 0.455, forest: (d) => d < 0.2, clearance: 14 },
  boars: { grid: 22, chance: 0.715, forest: (d) => d >= 0.12, clearance: 12 }, // rooting about the woods
  bears: { grid: 26, chance: 0.6, forest: (d) => d >= 0.35, clearance: 24 }, // alone, deep in the forest
  lynxes: { grid: 22, chance: 0.6, forest: (d) => d >= 0.1 && d < 0.32, clearance: 18 }, // lurking at the forest's edges
};
const SPAWN_CLEARANCE = 20;

export interface EnemyWorld {
  seed: number;
  size: MapSize;
  villages: Village[];
  hero: { x: number; z: number };
  camps: readonly Camp[]; // (the bandits start in them)
  ruins?: readonly Ruin[]; // (ghosts haunt them)
  isOpenTile(x: number, z: number): boolean;
}

// A fresh enemy of `kind` at `level` at (x, z), at home around (homeX, homeZ).
export function makeEnemy(id: number, kind: EnemyKind, x: number, z: number, homeX = x, homeZ = z, level = 1): Enemy {
  const power = enemyPower(kind, level);
  return {
    id,
    kind,
    x,
    z,
    y: 0,
    homeX,
    homeZ,
    level,
    maxHp: power.maxHp,
    hp: power.maxHp,
    damage: power.damage,
    xp: power.xp,
    state: 'wander',
    target: null,
    restFor: hashUnit(x, z, 3) * 3,
    hurtFor: 0,
    deadFor: 0,
    swingFor: null,
    cooldown: 0,
    path: null,
    pathAge: 0,
    lastSeen: null,
    lostFor: 0,
    // Bandits: someone different each, in their own mix of bandit gear; their chief in the best of it (camps/campChief.ts).
    human: kind === 'bandit' ? { look: lookAt(x, z, 0, 0.25), equipment: pickOutfit('bandit', x, z) } : kind === 'banditChief' ? { look: lookAt(x, z, 0, 0), equipment: { ...CHIEF_OUTFIT } } : null, // a woman one time in four (a chief, a man)
  };
}

// `area`: the part of the map to place them on (a streamed world's region: its sites, those whose spot falls in it;
// else the whole map); `firstId`: the first of their ids (a streamed world's region's block: enemies/foeIds.ts).
export function spawnEnemies(world: EnemyWorld, area: Area = wholeMap(world.size), firstId = 0): Enemy[] {
  const forest = createForestDensity(world.seed);
  const enemies: Enemy[] = [];
  const taken = new Set<string>();
  const open = (x: number, z: number) => world.isOpenTile(x, z) && !taken.has(`${x},${z}`);

  // Up to `count` enemies on open tiles in rings around (cx, cz).
  const group = (kind: EnemyKind, cx: number, cz: number, count: number, salt: number, minRing = 0) => {
    let placed = 0;
    for (let r = minRing; r <= 3 && placed < count; r++) {
      for (let dx = -r; dx <= r && placed < count; dx++) {
        for (let dz = -r; dz <= r && placed < count; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !open(x, z) || hashUnit(x, z, salt) >= 0.6) continue;
          taken.add(`${x},${z}`);
          enemies.push(makeEnemy(firstId + enemies.length, kind, x, z, cx, cz, enemyLevel(world.hero, cx, cz, firstId + enemies.length)));
          placed++;
        }
      }
    }
  };
  // The bandits: each camp's own number of them, each on a free tile inside
  // its palisade (not a tent, the fire, the crates or the rack), in an order
  // rolled from the seed; and their chief, before the banner (camps/campChief.ts).
  // No other foe starts inside a camp.
  for (const camp of world.camps) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) taken.add(`${camp.x + dx},${camp.z + dz}`);
  const bandits = (camp: Camp) => {
    const spots: Array<[number, number]> = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (world.isOpenTile(camp.x + dx, camp.z + dz)) spots.push([camp.x + dx, camp.z + dz]);
    const roll = ([x, z]: [number, number]) => hashUnit(x, z, world.seed + 56);
    spots.sort((a, b) => roll(a) - roll(b));
    const chief = chiefSpot(camp, spots);
    const rest = spots.filter((s) => s !== chief);
    for (const [x, z] of rest.slice(0, camp.bandits)) enemies.push({ ...makeEnemy(firstId + enemies.length, 'bandit', x, z, camp.x, camp.z, enemyLevel(world.hero, camp.x, camp.z, firstId + enemies.length)), pen: 2 });
    if (chief) enemies.push({ ...makeEnemy(firstId + enemies.length, 'banditChief', chief[0], chief[1], camp.x, camp.z, chiefLevel(camp, world.size)), pen: 2, name: chiefName(camp, world.seed) });
  };

  // One of each a short walk from spawn, so there's something to fight right away.
  const { x: sx, z: sz } = world.hero;
  if (inArea(area, sx, sz)) group('wolf', Math.round(sx + 7), Math.round(sz - 6), 2, 41);
  if (world.camps[0]) bandits(world.camps[0]); // the camp near spawn

  const scatter = (sites: Sites, salt: number, place: (x: number, z: number, big: boolean) => void) => {
    for (let gx = Math.floor(area.x0 / sites.grid); gx * sites.grid < area.x1; gx++) {
      for (let gz = Math.floor(area.z0 / sites.grid); gz * sites.grid < area.z1; gz++) {
        if (hashUnit(gx, gz, salt) >= sites.chance) continue;
        const x = Math.floor(gx * sites.grid + hashUnit(gx, gz, salt + 1) * sites.grid);
        const z = Math.floor(gz * sites.grid + hashUnit(gx, gz, salt + 2) * sites.grid);
        if (!ownsSite(area, world.size, x, z) || !sites.forest(forest(x, z))) continue; // (a site's its area's whose spot falls in it)
        if (Math.hypot(x - sx, z - sz) < SPAWN_CLEARANCE) continue;
        if (world.villages.some((v) => Math.hypot(v.x - x, v.z - z) < sites.clearance + VILLAGE_OUTER_RADIUS)) continue;
        place(x, z, hashUnit(gx, gz, salt + 3) < 0.5);
      }
    }
  };
  scatter(WILD_SITES.packs, 42, (x, z, big) => group('wolf', x, z, big ? 3 : 2, 46));
  scatter(WILD_SITES.meadowPacks, 62, (x, z) => group('wolf', x, z, 2, 66));
  scatter(WILD_SITES.boars, 72, (x, z) => group('boar', x, z, 1 + Math.floor(hashUnit(x, z, 73) * 3), 76)); // one to three
  for (const camp of world.camps.slice(1)) bandits(camp);
  // Ghosts haunting each old ruin, two to four, bound to it (within its walls); last, so the rest keep their ids.
  for (const ruin of world.ruins ?? []) {
    const [cx, cz] = [Math.floor(ruin.x + ruin.w / 2), Math.floor(ruin.z + ruin.d / 2)];
    const haunt = { x0: ruin.x + 0.5, z0: ruin.z + 0.5, x1: ruin.x + ruin.w - 1.5, z1: ruin.z + ruin.d - 1.5 };
    const count = 2 + Math.floor(hashUnit(ruin.x, ruin.z, 81) * 3);
    const spots: Array<[number, number]> = [];
    for (let x = Math.ceil(haunt.x0); x <= haunt.x1; x++) for (let z = Math.ceil(haunt.z0); z <= haunt.z1; z++) if (open(x, z)) spots.push([x, z]);
    spots.sort((a, b) => hashUnit(a[0], a[1], 82) - hashUnit(b[0], b[1], 82));
    for (const [x, z] of spots.slice(0, count)) {
      taken.add(`${x},${z}`);
      enemies.push({ ...makeEnemy(firstId + enemies.length, 'ghost', x, z, cx, cz, enemyLevel(world.hero, cx, cz, firstId + enemies.length)), haunt });
    }
  }
  // The fiercer beasts, last of all (so every other foe keeps its id, and a save its slain): a bear alone in each
  // stretch of deep forest that has one; a lynx or two at the forest's edges.
  scatter(WILD_SITES.bears, 92, (x, z) => group('bear', x, z, 1, 96));
  scatter(WILD_SITES.lynxes, 102, (x, z, big) => group('lynx', x, z, big ? 2 : 1, 106));
  return enemies;
}

// One frame of a living enemy: chase the hero when close (once in reach it
// attacks instead: a bandit swings, a wolf lunges and bites), otherwise wander between spots around home, resting in
// between. `move` walks it with collisions and returns whether it got anywhere.
// What an enemy can do in the world, supplied by the game model.
export interface EnemyActions {
  // Walks it with collisions; returns whether it got anywhere.
  move(enemy: Enemy, dx: number, dz: number): boolean;
  // Where to head for `quarry`: itself if the way is clear, else the next point around what's between.
  // `still`: a spot it's walking to, not the hero chased (a nearer look round, and one path will do).
  steer(enemy: Enemy, quarry: { x: number; z: number }, still?: boolean): { x: number; z: number };
  // Whether it can see the hero.
  sees(enemy: Enemy): boolean;
  // Whether it's waiting its turn: more than ENGAGED at once on the hero, the farther ones hang back.
  waitsTurn?(enemy: Enemy): boolean;
  // Its blow lands, halfway through the swing.
  strike(enemy: Enemy): void;
  // Whether it could stand at (x, z), for picking where to wander (given only where most spots round it can't be: a crypt).
  standable?(enemy: Enemy, x: number, z: number): boolean;
}

export const ENEMY_STRIKE = 0.5; // point of an enemy's swing (0..1) where the blow lands

export function stepEnemy(enemy: Enemy, hero: { x: number; z: number; blessings?: Blessing[] }, dt: number, actions: EnemyActions): void {
  const { steer, sees } = actions;
  // Bound to a place (a ruin's ghost): never a step out of it, nor after the hero once they're out of it.
  const haunt = enemy.haunt;
  const kept = (p: { x: number; z: number }) => (haunt ? { x: Math.min(haunt.x1, Math.max(haunt.x0, p.x)), z: Math.min(haunt.z1, Math.max(haunt.z0, p.z)) } : p);
  const within = (p: { x: number; z: number }) => kept(p).x === p.x && kept(p).z === p.z;
  const move = (e: Enemy, dx: number, dz: number) => {
    const to = kept({ x: e.x + dx, z: e.z + dz });
    return Math.hypot(to.x - e.x, to.z - e.z) >= 1e-5 && actions.move(e, to.x - e.x, to.z - e.z);
  };
  const stats = ENEMY_STATS[enemy.kind];
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  if (enemy.swingFor !== null) {
    const before = enemy.swingFor;
    enemy.swingFor += dt;
    if (before < stats.swing * ENEMY_STRIKE && enemy.swingFor >= stats.swing * ENEMY_STRIKE) actions.strike(enemy);
    if (enemy.swingFor >= stats.swing) {
      enemy.swingFor = null;
      enemy.cooldown = stats.cooldown;
    }
    return; // committed to the blow
  }

  // It notices the hero in sight range with nothing solid in between, or
  // close enough to hear whatever's in the way.
  const toHero = Math.hypot(hero.x - enemy.x, hero.z - enemy.z);
  const quiet = noticeFactor(hero); // a well's Quiet step halves how far it sees and hears
  // (A passive one never notices: only a blow sets it chasing. Nor does one
  // still on its way back from too far, not till it's most of the way home.)
  const fromHome = Math.hypot(enemy.x - enemy.homeX, enemy.z - enemy.homeZ);
  const leash = DUNGEON_FAMILIES.has(stats.family) ? DUNGEON_LEASH : ENEMY_LEASH;
  const headingHome = enemy.state === 'wander' && fromHome > leash * 0.6;
  const noticed = !stats.passive && !headingHome && within(hero) && (toHero < ENEMY_HEARING * quiet || (toHero < stats.sight * quiet && sees(enemy)));
  if (enemy.state === 'wander' && noticed) enemy.state = 'chase';
  if (enemy.state === 'chase') {
    if (noticed || (toHero < stats.giveUp && sees(enemy))) {
      enemy.lastSeen = { x: hero.x, z: hero.z };
      enemy.lostFor = 0;
    } else {
      enemy.lostFor += dt;
    }
    // Out of range, or lost from view too long (or searched where it was
    // last seen, and it's not there): back home.
    // Or led too far from home (its leash: a dungeon's foe hounds them further): back, and healed, so it can't be worn down bit by bit that way.
    const searched = !!enemy.lastSeen && enemy.lostFor > 0 && Math.hypot(enemy.lastSeen.x - enemy.x, enemy.lastSeen.z - enemy.z) < 0.25;
    const leashed = fromHome > leash;
    if (leashed) enemy.hp = enemy.maxHp;
    if (toHero > stats.giveUp || enemy.lostFor > ENEMY_LOSE_TIME || searched || leashed || !within(hero)) {
      enemy.state = 'wander';
      enemy.target = { x: enemy.homeX, z: enemy.homeZ };
      enemy.lastSeen = null;
      enemy.lostFor = 0;
      enemy.path = null;
    }
  }

  if (enemy.state === 'chase') {
    // Waiting its turn (a pack's: only a few set on the hero at once): it closes
    // in only to WAIT_DISTANCE, and doesn't swing.
    const waiting = actions.waitsTurn?.(enemy) ?? false;
    const stop = waiting ? WAIT_DISTANCE : stats.stop;
    // A small margin: stepping exactly to `stop` can leave it a hair outside,
    // which would never count as in reach.
    if (toHero > stop + 0.02 || enemy.lostFor > 0) {
      // Toward the hero (or where it was last seen), or the next point on
      // the way around what's between.
      const quarry = enemy.lostFor > 0 && enemy.lastSeen ? enemy.lastSeen : hero;
      const goal = steer(enemy, quarry);
      const d = Math.hypot(goal.x - enemy.x, goal.z - enemy.z);
      const step = Math.min(stats.run * dt, goal === hero ? toHero - stop : d);
      if (d > 1e-4) move(enemy, ((goal.x - enemy.x) / d) * step, ((goal.z - enemy.z) / d) * step);
    } else if (!waiting && enemy.cooldown === 0) {
      enemy.swingFor = 0;
    }
    return;
  }

  if (!enemy.target) {
    enemy.restFor -= dt;
    if (enemy.restFor > 0) return;
    const t = enemy.id * 7.31 + enemy.x;
    // Kept in (a camp's bandits): a tile inside the palisade, so they stay
    // in their camp, not crowding its gate going in and out. Else anywhere round home.
    // Where it could stand, if the place says (a crypt's narrow passages: a few rolls, else the last).
    const pen = enemy.pen;
    for (let roll = 0; roll < (actions.standable ? 6 : 1); roll++) {
      const [hx, hz] = [hashUnit(Math.floor(t * 10) + roll * 101, enemy.id, 5), hashUnit(Math.floor(t * 10) + roll * 101, enemy.id, 6)];
      enemy.target =
        pen !== undefined
          ? { x: enemy.homeX + Math.floor(hx * (2 * pen + 1)) - pen, z: enemy.homeZ + Math.floor(hz * (2 * pen + 1)) - pen }
          : { x: enemy.homeX + (hx - 0.5) * 2 * stats.wander, z: enemy.homeZ + (hz - 0.5) * 2 * stats.wander };
      enemy.target = kept(enemy.target);
      if (actions.standable?.(enemy, enemy.target.x, enemy.target.z)) break;
    }
  }
  // Toward it (home, or a spot round home): straight on while it can, and
  // once something's in the way (a camp's palisade), round it as when
  // chasing (a path to the gate), till it's there.
  // Held back to a crawl (sliding along a post into a narrow gap), it
  // sidesteps at full pace instead, so it lines up with the gap at once.
  const walk = (to: { x: number; z: number }) => {
    const [dx, dz] = [to.x - enemy.x, to.z - enemy.z];
    const d = Math.hypot(dx, dz);
    const step = Math.min(stats.walk * dt, d);
    if (d < 1e-4) return false;
    const [x0, z0] = [enemy.x, enemy.z];
    const went = move(enemy, (dx / d) * step, (dz / d) * step);
    if (Math.hypot(enemy.x - x0, enemy.z - z0) >= step / 2) return true;
    const side = (a: number) => Math.sign(a) * Math.min(step, Math.abs(a));
    return move(enemy, side(to.x - enemy.x), 0) || move(enemy, 0, side(to.z - enemy.z)) || went;
  };
  const target = enemy.target!; // (picked above, if it had none)
  const arrived = Math.hypot(target.x - enemy.x, target.z - enemy.z) < 0.05;
  const went = !arrived && ((!enemy.path && walk(target)) || walk(steer(enemy, target, true)));
  // Arrived, or no way nearer (it's somewhere it can't stand, or can't be
  // reached): rest a while, then go elsewhere.
  if (!went) {
    enemy.target = null;
    enemy.path = null;
    enemy.restFor = stats.rest[0] + hashUnit(enemy.id, Math.floor(enemy.x * 10), 7) * stats.rest[1];
  }
}

// Whether a step of a walker of half-width r from `from` to (x, z) bumps a
// living enemy: refused if it would overlap one and bring the two closer
// (stepping away from one pressed against them is always allowed, so no one
// gets pinned).
export function bumpsEnemy(enemies: readonly Enemy[], from: { x: number; z: number }, x: number, z: number, r: number): boolean {
  return enemies.some((enemy) => {
    const reach = r + ENEMY_STATS[enemy.kind].radius;
    if (enemy.state === 'dead' || enemy.buried || Math.abs(enemy.x - x) >= reach || Math.abs(enemy.z - z) >= reach) return false;
    return Math.hypot(enemy.x - x, enemy.z - z) < Math.hypot(enemy.x - from.x, enemy.z - from.z);
  });
}
