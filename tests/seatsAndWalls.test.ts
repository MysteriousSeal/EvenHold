// A seat, or a bed, behind an inner wall (model/interiors/indoors.ts seatInReach): not in reach through it, however
// near; from its own side of the wall, it is. The whole floor upstairs at an inn gone over, a fine grid of spots.
import { describe, expect, it } from 'vitest';
import { letRoomBed } from '../src/model/inn/roomLetting';
import { seatInReach } from '../src/model/interiors/indoors';
import { stairsOf, upstairsInside } from '../src/model/interiors/upstairs';
import { fresh } from './support/testWorld';

describe('a bed behind a wall', () => {
  it('is lain in from inside its room, never through the wall from the hallway', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    const below = model.inside!;
    const inside = (model.inside = upstairsInside(inn, below.room, stairsOf(below)!, model.seed, model.fullWalls));
    const { hero } = model;
    const beds = inside.furniture.filter((f) => f.kind === 'roomBed' || f.kind === 'doubleBed');
    const walls = inside.furniture.filter((f) => f.kind === 'hallWall' || f.kind === 'hallDoor');
    expect(beds.length).toBeGreaterThan(0);
    expect(walls.length).toBeGreaterThan(0);
    // Every spot of the floor, a fine grid of them: wherever a bed's in reach, no wall stands between.
    let [reached, refused] = [0, 0];
    for (let x = 0; x < inside.room.width; x += 0.1) {
      for (let z = 0; z < inside.room.depth; z += 0.1) {
        Object.assign(hero, { x, z });
        const seat = seatInReach(inside, hero);
        const near = beds.some((b) => Math.max(Math.abs(x - (b.x + (b.w - 1) / 2)) - b.w / 2, Math.abs(z - (b.z + (b.d - 1) / 2)) - b.d / 2) <= 0.4);
        if (!seat?.lying) {
          if (near) refused++;
          continue;
        }
        reached++;
        // (No wall between where they stand and where they'd lie: each wall's own line, in its tile, not crossed.)
        for (const wall of walls) {
          if (wall.kind === 'hallDoor' && wall.open) continue;
          const [wx, wz] = wall.wall === 'left' ? [wall.x - 0.4, null] : [null, wall.z - 0.4];
          const cross = (a: number, b: number, line: number) => (a - line) * (b - line) < 0;
          const along = (a: number, b: number, line: number) => a + ((b - a) * (line - (wx !== null ? x : z))) / ((wx !== null ? seat.x : seat.z) - (wx !== null ? x : z));
          if (wx !== null && cross(x, seat.x, wx)) {
            const at = along(z, seat.z, wx); // where their line meets the wall's
            expect(at > wall.z - 0.5 && at < wall.z + wall.d - 0.5, `through a wall from ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          }
          if (wz !== null && cross(z, seat.z, wz)) {
            const at = along(x, seat.x, wz);
            expect(at > wall.x - 0.5 && at < wall.x + wall.w - 0.5, `through a wall from ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          }
        }
      }
    }
    expect(reached).toBeGreaterThan(20); // (still lain in, from beside them)
    expect(refused).toBeGreaterThan(0); // (and some spots near one, the far side of a wall, turned down)
    expect(letRoomBed(inside)?.bed).toBeTruthy();
  });
});
