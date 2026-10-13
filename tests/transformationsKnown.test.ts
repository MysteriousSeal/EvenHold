// @vitest-environment happy-dom
// What the ten new charms get wrong, as found by playing them whole (charmsWholeGame.test.ts and its neighbours, and
// by looking at them drawn): each a small reproduction, marked failing. Mended, one of these starts passing, and
// vitest says so: take its `fails` off then. None of them is mended here: each is in older code shared with the
// rest of the game, or is a question of how it should be, not of a slip.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { goIn, reloaded, scene } from './support/charmStage';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { INDOOR_SCALE } from '../src/model/constants';
import { castSpell } from '../src/model/spells/casting';
import { wallFor, type Hung } from '../src/model/spells/hung';
import { spellKey } from '../src/model/spells/spells';
import type { Hen } from '../src/model/spells/turned';
import { dollStagingOf } from '../src/view/cinema/stagings/dollStaging';
import { ghostStagingOf } from '../src/view/cinema/stagings/ghostStaging';
import { paintingStagingOf } from '../src/view/cinema/stagings/paintingStaging';
import { playTransformation } from '../src/view/cinema/transformCinema';
import { ROOM_VOXEL, ROOM_WALL, buildRoomVoxels } from '../src/view/interior/roomVoxels';
import { SmokePuffs } from '../src/view/meshes/common/smokePuffs';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { TurnedViews } from '../src/view/meshes/turned/turnedViews';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';

// No canvas in happy-dom: a 2D context that draws nothing, every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const WALL_HIGH = 34 * ROOM_VOXEL; // (a room's two full walls: view/interior/roomVoxels.ts HIGH)
const TILE = 25; // (and a floor tile, in its voxels)
const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  return rig.root;
};

describe('known: the model', () => {
  // model/travellers/travellers.ts load: a save with no one left on the roads is read as no save of them at all
  // (`if (on.length === 0) return`), and the seed's own set out again: the one turned is back, and what they were
  // turned into is there too. (So of a hen-wife's turn: older than the ten.) Seed 4 has the one pilgrim.
  it.fails('the last one on the roads, turned, is off them still after a save and a load', () => {
    const { model, who } = scene(4, 'traveller')!;
    expect(model.travellers.list).toHaveLength(1);
    expect(castSpell(model, 'pig')).toBe('cast');
    expect(model.travellers.list).toHaveLength(0);
    const again = reloaded(model);
    expect(again.chickens.hens.map((h) => h.kind)).toEqual(['pig']);
    expect(again.travellers.list.some((t) => t.id === who.id)).toBe(false);
  });

  // GameModel.useAction: a cast refused gives back false and no more, and the controller that asked does nothing
  // with it: a doll under a roof, a painting out of doors, are a key pressed and nothing at all, not a word why.
  it.fails('a charm refused where it cannot work tells the player something', () => {
    for (const [where, charm] of [['herbalist', 'doll'], ['wolf', 'painting']] as const) {
      const { model } = scene(TEST_SEEDS[0], where)!;
      model.hero.actionBar[0] = spellKey(charm);
      model.takeEvents();
      expect(model.useAction(0)).toBe(false);
      expect(model.takeEvents().length, `${charm} at ${where}`).toBeGreaterThan(0);
    }
  });
});

describe('known: a painting on its wall', () => {
  // turnedViews.ts HANGS: its middle 0.45 of its own scale up the wall. A life-size portrait at INDOOR_SCALE is
  // 1.08 to 1.17 high and its cord and nail 0.15 more: the frame's top is level with the wall's (1.36) or just over
  // it, and the cord and its nail are in the air over the wall, drawn across the top of it.
  it.fails('is all of it on the wall, its nail in it: none of it over the wall\'s top', () => {
    const views = new TurnedViews(() => human());
    const room = new THREE.Group();
    const hen = { id: 1, kind: 'painting', x: 3, y: 0, z: -0.5, facing: 0, at: '1,1', from: { x: 3, z: 2 }, to: null, peck: 0, hung: { wall: 'back', x: 3, z: 0 }, stone: { id: 1 } } as Hen;
    views.update([hen], room, INDOOR_SCALE, 0, new SmokePuffs());
    room.updateMatrixWorld(true);
    const box = new THREE.Box3();
    room.traverseVisible((o) => (o as THREE.Mesh).isMesh && box.expandByObject(o, true));
    expect(box.min.y).toBeGreaterThan(0); // (clear of the floor: it is)
    expect(box.max.y).toBeLessThanOrEqual(WALL_HIGH);
  });

  // view/interior/roomVoxels.ts daubRelief: a herbalist's walls have dried plants hung on them, standing two room
  // voxels (0.08) off the daub; a painting's canvas is 0.03 thick and whoever's painted on it no deeper than that
  // again, so a bunch behind one comes out through the canvas and their face. hung.ts knows furniture, not these.
  it.fails('has nothing of its wall coming through it (a herbalist\'s dried plants)', () => {
    let through = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const keeper of model.npcs.filter((n) => n.role === 'herbalist')) {
        goIn(model, keeper.home);
        const { room, furniture } = model.inside!;
        const grid = buildRoomVoxels(room, furniture);
        const taken: Hung[] = [];
        for (let hung = wallFor(room, furniture, taken, keeper); hung; hung = wallFor(room, furniture, taken, keeper)) {
          taken.push(hung);
          // Behind its canvas (the middle 15 voxels of its tile, from the knee to under the beam): anything two voxels proud of the wall.
          const along = ROOM_WALL + (hung.wall === 'back' ? hung.x : hung.z) * TILE + Math.floor(TILE / 2);
          for (let u = along - 7; u <= along + 7; u++) for (let y = 10; y <= 31; y++) if (hung.wall === 'back' ? colorAt(grid, u, y, ROOM_WALL + 1) : colorAt(grid, ROOM_WALL + 1, y, u)) through++;
        }
      }
    }
    expect(through).toBe(0);
  });
});

describe('known: what is said as a beast is turned', () => {
  // cinema/stagings/ghostStaging.ts, paintingStaging.ts, dollStaging.ts: one set of lines each, a person's, said of
  // anything: a wolf, a cave spider and a bat have the warmth go out of "their hands", colour out of "the fingers,
  // the hair, the hems", seams "up the arms", and "cannot turn their head". (The seven beasts' stagings have lines
  // of their own for what goes on four legs, and for what has no parts.)
  it.fails('a ghost, a painting, a doll made of a beast: nothing said of hands, fingers, hair or hems', () => {
    const beast = () => {
      const root = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.7), new THREE.MeshStandardMaterial());
      body.position.y = 0.3;
      root.add(body);
      return root;
    };
    const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });
    for (const staging of [ghostStagingOf(beast), paintingStagingOf(beast), dollStagingOf(beast)]) {
      const playing = playTransformation(beast(), 'Wolf', staging, () => {}, drawer);
      const said = new Set<string>();
      for (let t = 0; t < 14 && !playing.over; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
      playing.skip();
      expect([...said].filter((line) => /hands|fingers|hair|hems|arms/.test(line)), staging.title).toEqual([]);
    }
  });
});
