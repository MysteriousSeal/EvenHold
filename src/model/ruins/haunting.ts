// The dead of a ruin, risen again for a quest that asks them slain (story/story.ts): a ruin's ghosts, once laid,
// stay laid (enemies/enemies.ts makes them with the world, and a save keeps them slain), so a quest that sends the
// hero there after would have none to send them to. As many as it still asks for rise within the ruin's walls, bound
// to it as its own are, away from where the hero stands. Theirs for the quest alone: numbered clear of the world's
// own foes (never kept in a save; risen again, if still wanted, as the game's taken up).
import { makeEnemy } from '../enemies/enemies';
import { enemyLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';
import { hashCell } from '../../util/random';
import type { Enemy } from '../types';
import type { Ruin } from './ruins';

const RISEN_ID = 9_500_000; // (past the boards' quests' foes and the dungeons' own; short of a streamed world's)

export interface HauntedWorld {
  readonly enemies: Enemy[];
  readonly seed: number;
  readonly minutes: number; // the game's clock (a risen ghost's drops rolled by when it rose: hero/fighting.ts)
  readonly hero: { x: number; z: number };
  readonly size: MapSize;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
}

const hauntOf = (ruin: Ruin) => ({ x0: ruin.x + 0.5, z0: ruin.z + 0.5, x1: ruin.x + ruin.w - 1.5, z1: ruin.z + ruin.d - 1.5 });
const within = (e: { x: number; z: number }, ruin: Ruin) => e.x >= ruin.x && e.z >= ruin.z && e.x <= ruin.x + ruin.w - 1 && e.z <= ruin.z + ruin.d - 1;

// The ghosts still walking in a ruin.
export const ghostsIn = (enemies: readonly Enemy[], ruin: Ruin): number => enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead' && within(e, ruin)).length;

// `count` more risen in it (as many as there's room for): how many did.
export function raiseGhosts(world: HauntedWorld, ruin: Ruin, count: number): number {
  const haunt = hauntOf(ruin);
  const [cx, cz] = [Math.floor(ruin.x + ruin.w / 2), Math.floor(ruin.z + ruin.d / 2)];
  const taken = new Set(world.enemies.filter((e) => e.state !== 'dead').map((e) => `${Math.round(e.x)},${Math.round(e.z)}`));
  const spots: Array<[number, number]> = [];
  for (let x = Math.ceil(haunt.x0); x <= haunt.x1; x++) for (let z = Math.ceil(haunt.z0); z <= haunt.z1; z++) if (world.isOpenTile(x, z) && !taken.has(`${x},${z}`)) spots.push([x, z]);
  const far = ([x, z]: [number, number]) => Math.hypot(x - world.hero.x, z - world.hero.z);
  spots.sort((a, b) => far(b) - far(a)); // (the farthest from the hero first: not at their elbow)
  let id = Math.max(RISEN_ID - 1, ...world.enemies.filter((e) => e.id >= RISEN_ID && e.id < RISEN_ID + 500_000).map((e) => e.id)) + 1;
  const risen = spots.slice(0, Math.max(0, count));
  for (const [x, z] of risen) {
    const ghost = { ...makeEnemy(id, 'ghost', x, z, cx, cz, enemyLevel(spawnOf(world.size), cx, cz, id)), haunt, drops: hashCell(world.seed, Math.floor(world.minutes), id) }; // (its drops its own: the world, when it rose)
    ghost.y = world.getGroundY(x, z);
    world.enemies.push(ghost);
    id++;
  }
  return risen.length;
}
