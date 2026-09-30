// @vitest-environment happy-dom
// The keys (KeyboardInput.ts): walking, striking, picking up, ordering at
// the bar; and, in every room of every test world, every seat one can sit on.
import { describe, expect, it } from 'vitest';
import { KeyboardInput } from '../src/controller/KeyboardInput';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { SIT_RANGE, bumpsFurniture, distanceTo, seatOf } from '../src/model/interiors/furniture';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const key = (code: string, down = true, repeat = false) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, repeat }));

describe('the keys', () => {
  it.each([
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
  ] as const)('%s walks %s while held, and stops when let go', (code, direction) => {
    const input = new KeyboardInput();
    key(code);
    expect(input.isPressed(direction)).toBe(true);
    key(code, false);
    expect(input.isPressed(direction)).toBe(false);
  });

  it('stops walking when the window loses focus mid-press (no hero running off on their own)', () => {
    const input = new KeyboardInput();
    key('KeyW');
    window.dispatchEvent(new Event('blur'));
    expect(input.isPressed('up')).toBe(false);
  });

  it('strikes once a press of Space, not again held down', () => {
    const input = new KeyboardInput();
    key('Space');
    key('Space', true, true); // held: the key repeating
    expect(input.consumeAttack()).toBe(true);
    expect(input.consumeAttack()).toBe(false);
  });

  it('picks up once a press of E', () => {
    const input = new KeyboardInput();
    key('KeyE');
    expect(input.consumePickup()).toBe(true);
    expect(input.consumePickup()).toBe(false);
  });

  it.each([
    ['KeyF', 'ale'],
    ['KeyG', 'pie'],
  ] as const)('orders at the bar with %s: %s, once a press', (code, what) => {
    const input = new KeyboardInput();
    key(code);
    expect(input.consumeOrder()).toBe(what);
    expect(input.consumeOrder()).toBeNull();
  });

  it('ignores keys it has no use for', () => {
    const input = new KeyboardInput();
    key('KeyQ');
    expect([input.consumeAttack(), input.consumePickup(), input.consumeOrder()]).toEqual([false, false, null]);
    for (const d of ['up', 'down', 'left', 'right'] as const) expect(input.isPressed(d)).toBe(false);
  });
});

// Where the hero can stand in a room: in it, clear of the furniture (indoors.ts walkInside's rule).
describe.each(TEST_SEEDS.map((s) => [s]))('every seat in every room, seed %i', (seed) => {
  it('can be sat on by the hero from somewhere they can stand', () => {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    const r = HERO_RADIUS * INDOOR_SCALE;
    for (const entrance of model.entrances) {
      const { room, furniture } = layoutOf(seed, entrance);
      const stands = (x: number, z: number) => x >= -0.5 + r && x <= room.width - 0.5 - r && z >= -0.5 + r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r);
      for (const piece of furniture) {
        if (!seatOf(piece)) continue;
        let near = false;
        for (let x = piece.x - 1.5; x <= piece.x + piece.w + 0.5 && !near; x += 0.05) {
          for (let z = piece.z - 1.5; z <= piece.z + piece.d + 0.5 && !near; z += 0.05) near = stands(x, z) && distanceTo(piece, x, z) <= SIT_RANGE;
        }
        expect(near, `${entrance.type} at ${entrance.x},${entrance.z}: its ${piece.kind} at ${piece.x},${piece.z}`).toBe(true);
      }
    }
  });
});
