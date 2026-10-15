import { describe, expect, it } from 'vitest';
import { CAMERA_OFFSET } from '../src/view/constants';
import { along, atRim, screenFacing, toMap, toScreen } from '../src/view/atlas/mapView';
import { nameAt } from '../src/view/atlas/mapPaint';
import type { GameModel } from '../src/model/GameModel';
import { CHUNK } from '../src/model/atlas/fog';
import { fresh } from './support/testWorld';

const look = { x: 500, z: 300, scale: 2 };
const [W, H] = [860, 560];

describe('the map turned as the game is seen', () => {
  it('has up the map the way the camera looks', () => {
    const ahead = { x: -CAMERA_OFFSET.x, z: -CAMERA_OFFSET.z }; // (the camera's look, along the ground)
    const n = Math.hypot(ahead.x, ahead.z);
    const [x, y] = toScreen(look, W, H, look.x + (10 * ahead.x) / n, look.z + (10 * ahead.z) / n);
    expect(x).toBeCloseTo(W / 2);
    expect(y).toBeCloseTo(H / 2 - 10 * look.scale);
  });

  it('finds the tile under a pixel again (hover, drag, zoom to the pointer)', () => {
    for (const [x, z] of [[500, 300], [512.5, 280], [430, 391]]) {
      const [sx, sy] = toScreen(look, W, H, x, z);
      const [bx, bz] = toMap(look, W, H, sx, sy);
      expect(bx).toBeCloseTo(x);
      expect(bz).toBeCloseTo(z);
    }
    const [dx, dz] = along(look.scale, 30, -14);
    const [sx, sy] = toScreen(look, W, H, look.x + dx, look.z + dz);
    expect([sx - W / 2, sy - H / 2].map((v) => Math.round(v))).toEqual([30, -14]);
  });

  it('names a pin under the pointer where it is drawn', () => {
    const pins = [{ kind: 'quest' as const, x: 520, z: 290, label: 'The mill' }];
    const [sx, sy] = toScreen(look, W, H, 520.5, 290.5);
    expect(nameAt({} as GameModel, look, W, H, { names: true, pins, places: [] }, sx, sy - 12)).toBe('The mill');
  });

  it('holds a far pin at the rim, the way to walk on the screen', () => {
    const [px, py] = toScreen({ ...look, scale: 1.75 }, 150, 150, look.x - 400, look.z - 400); // (far ahead, up the screen)
    const [x, y] = atRim(px, py, 150, 150);
    expect(x).toBeCloseTo(75);
    expect(y).toBeCloseTo(16);
    const [qx, qy] = atRim(75 + 300, 75 + 100, 150, 150);
    expect(qx).toBeCloseTo(150 - 8);
    expect((qy - 75) / (qx - 75)).toBeCloseTo(100 / 300);
  });

  it('points the hero the way they face on the screen', () => {
    for (const facing of [0, 1, -2.2, Math.PI]) {
      const [sx, sy] = toScreen(look, W, H, look.x + Math.sin(facing), look.z + Math.cos(facing));
      const f = screenFacing(facing);
      expect((sx - W / 2) / look.scale).toBeCloseTo(Math.sin(f));
      expect((sy - H / 2) / look.scale).toBeCloseTo(Math.cos(f));
    }
  });
});

describe('the corner map at a glance', () => {
  it('charts the hero own chunk at once, if no chart has come', () => {
    const model = fresh();
    model.atlas.chartsFrom({ request: () => {}, ready: () => [] }); // (a worker that's not answered yet)
    const [cx, cz] = [Math.floor(model.hero.x / CHUNK), Math.floor(model.hero.z / CHUNK)];
    expect(model.atlas.chart(cx, cz)).toBeNull();
    model.atlas.chartNow(cx, cz);
    expect(model.atlas.chart(cx, cz)?.cx).toBe(cx);
  });
});
