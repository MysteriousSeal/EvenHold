// @vitest-environment happy-dom
// The stranger things someone's turned into (view/meshes/turned/: a ghost, a painting, a rag doll), each of them:
// made of a person and of a beast-shaped foe alike, and what's made let go after; each one's telling, played full
// screen from start to finish, every line of it said once; and the one doll that lies in the world, its model.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { dollStagingOf } from '../src/view/cinema/stagings/dollStaging';
import { ghostStagingOf } from '../src/view/cinema/stagings/ghostStaging';
import { paintingStagingOf } from '../src/view/cinema/stagings/paintingStaging';
import type { Staging } from '../src/view/cinema/staging';
import { playTransformation } from '../src/view/cinema/transformCinema';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { LOOT_VOXEL_SIZE } from '../src/view/meshes/loot/lootModel';
import { DOLL_GRID, DOLL_MODEL, DOLL_PALETTE, DOLL_VOXEL_SIZE, buildDoll } from '../src/view/meshes/turned/dollVoxels';
import { PaintingRig, layoutOf, painted, paintingOf } from '../src/view/meshes/turned/painting';
import { SMALL, ragDollOf, softened } from '../src/view/meshes/turned/ragDoll';
import { LIFT, TurnedGhostRig, ghostFigure, ghosted } from '../src/view/meshes/turned/turnedGhost';

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  return rig.root;
};
// Something not human-shaped: a long low body on four legs, facing +Z, a label over it.
const beast = () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.7), new THREE.MeshStandardMaterial());
  body.position.y = 0.325;
  for (const [x, z] of [[-0.1, -0.25], [0.1, -0.25], [-0.1, 0.25], [0.1, 0.25]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), new THREE.MeshStandardMaterial());
    leg.position.set(x, 0.1, z);
    root.add(leg);
  }
  const over = Object.assign(new THREE.Group(), { name: 'overhead' });
  over.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  over.position.y = 5;
  root.add(body, over);
  return root;
};
const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });
// Every geometry and material drawn under `root`, each told when it's let go.
const freed = (root: THREE.Object3D) => {
  const gone = new Set<unknown>();
  const made = new Set<THREE.BufferGeometry | THREE.Material>();
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const thing of [mesh.geometry, mesh.material as THREE.Material]) [made.add(thing), thing.addEventListener('dispose', () => gone.add(thing))];
  });
  return { made, gone };
};
// What's drawn of `root` (nothing hidden, nor under anything hidden), as a box in the world.
const seenBox = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverseVisible((o) => (o as THREE.Mesh).isMesh && box.expandByObject(o, true));
  return box;
};
// A telling played through by hand: every line it showed, in order, each once.
const played = (of: () => THREE.Object3D, staging: Staging) => {
  document.body.replaceChildren();
  const done = vi.fn();
  const playing = playTransformation(of(), 'Idtram', staging, done, drawer);
  const said: string[] = [];
  for (let t = 0; t < 14 && !playing.over; t += 0.1) {
    playing.advance(0.1);
    const line = playing.root.querySelector('.transform-line')!.textContent!;
    if (said[said.length - 1] !== line) said.push(line);
  }
  return { said, done, title: playing.root.querySelector('.transform-title')!.textContent };
};

describe('someone turned into a ghost', () => {
  it('is themselves, pale and seen through, nothing under the knee but a wisp; let go after', () => {
    for (const of of [human, beast]) {
      const ghost = ghostFigure(of());
      const { made, gone } = freed(ghost.root);
      expect(made.size).toBeGreaterThan(2);
      let [solid, shade] = [0, 0];
      ghost.root.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!(mesh.material as THREE.Material).transparent) solid++;
        if (mesh.geometry.type === 'PlaneGeometry') shade++;
      });
      expect([solid, shade]).toEqual([0, 0]); // (all of it seen through; no shade on the ground)
      const box = seenBox(ghost.root);
      expect(box.min.y).toBeGreaterThan(0); // (off the ground, wisp and all)
      expect(box.min.y).toBeLessThan(LIFT);
      ghost.dispose();
      expect(gone.size).toBe(made.size);
    }
    // Every colour of theirs the one pale blue-white, lighter or darker as it was.
    const [dark, light] = [ghosted(new THREE.Color(0x101010)), ghosted(new THREE.Color(0xf0f0f0))];
    expect(light.g).toBeGreaterThan(dark.g * 1.5);
    for (const pale of [dark, light]) expect(pale.b).toBeGreaterThan(pale.r);
    const same = new THREE.Color(0xf0f0f0);
    expect(ghosted(same, same).g).toBeCloseTo(light.g, 6); // (in place, as well)
  });

  it('hangs where it was turned, facing as it did; bobbing, swaying, now more there and now less', () => {
    const rig = new TurnedGhostRig(human());
    const float = rig.root.children[0];
    const looks = () => {
      let opacity = 0;
      rig.root.traverse((o) => ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).renderOrder % 2 === 1 ? (opacity = ((o as THREE.Mesh).material as THREE.Material).opacity) : 0));
      return opacity;
    };
    const seen = new Set<string>();
    for (let t = 0; t < 8; t += 0.25) {
      rig.update({ id: 3, x: 4, y: 1, z: -2, facing: 0.7 }, 0.25);
      seen.add(`${float.position.y.toFixed(3)} ${float.rotation.z.toFixed(3)} ${looks().toFixed(2)}`);
      expect(looks()).toBeGreaterThan(0.2);
      expect(looks()).toBeLessThan(0.9);
    }
    expect(rig.root.position.toArray()).toEqual([4, 1, -2]);
    expect(rig.root.rotation.y).toBe(0.7);
    expect(seen.size).toBeGreaterThan(20);
    rig.dispose();
  });

  it('is told step by step: the colour, thinner, the face, the feet, a wisp', () => {
    for (const of of [human, beast]) {
      const { said, done, title } = played(of, ghostStagingOf(of));
      expect(title).toBe(ghostStagingOf(of).title);
      expect(said).toEqual([of === human ? 'Idtram feels the warmth go out of their hands.' : 'Idtram feels the warmth go out of it.', of === human ? 'The colour, first: out of the fingers, the hair, the hems.' : 'The colour, first: out of the ears, the feet, the edges of it.', 'Then inward. Pale, to the middle of them.', 'Thinner. The slab shows through the chest.', 'The face, theirs still. There is less of it.', 'The feet leave the ground. Nothing lifted them.', 'Below the knee, no legs to speak of: a wisp.', 'A ghost, where they stood.', 'A ghost.']);
      expect(done).toHaveBeenCalledTimes(1);
    }
  });
});

describe('someone turned into a painting', () => {
  it('is themselves pressed flat in a gilded frame: its middle at the origin, its back on the wall; let go after', () => {
    for (const of of [human, beast]) {
      const painting = paintingOf(of());
      const { made, gone } = freed(painting.root);
      const { size, flat, box: theirs } = painting.layout;
      const box = seenBox(painting.root);
      expect(box.min.z).toBeCloseTo(0, 6); // (its back: the wall's plane)
      expect(box.max.z).toBeCloseTo(size.z, 6); // (nothing of them proud of the frame's ridge)
      expect([box.min.x, box.max.x, box.min.y].map((n) => +n.toFixed(6))).toEqual([-size.x / 2, size.x / 2, -size.y / 2].map((n) => +n.toFixed(6))); // (the frame's middle: the origin)
      expect(box.max.y).toBeGreaterThan(size.y / 2); // (the cord and its nail, over it)
      expect(size.x).toBeGreaterThan(theirs.max.x - theirs.min.x);
      expect(size.y).toBeGreaterThan(theirs.max.y - theirs.min.y);
      expect(flat).toBeLessThanOrEqual(0.1);
      painting.dispose();
      expect(gone.size).toBe(made.size);
    }
    // A person's: about two thirds of a pace across, and half again as tall as it's wide.
    const { size } = layoutOf(new THREE.Box3(new THREE.Vector3(-0.15, 0, -0.08), new THREE.Vector3(0.15, 0.45, 0.08)));
    expect(size.toArray().map((n) => Math.round(n * 60))).toEqual([30, 36, 3]);
    // In paint: duller, nearer the middle.
    const red = new THREE.Color(1, 0, 0);
    expect(painted(red).r).toBeLessThan(1);
    expect(painted(red).g).toBeGreaterThan(0);
  });

  it('hangs at the point given, turned the way its wall faces, and never moves', () => {
    const rig = new PaintingRig(human());
    for (const dt of [0, 0.5, 3]) rig.update({ x: 2, y: 0.6, z: -5, facing: Math.PI / 2 }, dt);
    expect(rig.root.position.toArray()).toEqual([2, 0.6, -5]);
    const front = new THREE.Vector3(0, 0, 1).applyEuler(rig.root.rotation);
    expect([front.x, front.z].map((n) => +n.toFixed(6))).toEqual([1, 0]); // (facing +X: the way its wall does)
    rig.dispose();
    expect(rig.root.parent).toBeNull();
  });

  it('is told step by step: stiff, framed, flat, in paint, cracked, hung', () => {
    for (const of of [human, beast]) {
      const { said, done } = played(of, paintingStagingOf(of));
      expect(said).toEqual([of === human ? 'Idtram finds they cannot turn their head.' : 'Idtram finds they cannot turn.', 'Four corners of gilt, out of the dark.', 'They close. A rail under the feet; one over the head.', 'Behind them, a ground of old brown.', 'Flatter. The depth of them goes first.', "Chest to back, a finger's width; then less.", 'The colours, to paint: duller, and yellowing.', 'A crack or two. It is old already.', 'Up, to where a nail would be.', 'A painting.']);
      expect(done).toHaveBeenCalledTimes(1);
    }
  });
});

describe('someone turned into a rag doll', () => {
  it('is themselves made small, sewn, button-eyed, slack, on their back; let go after', () => {
    for (const of of [human, beast]) {
      const doll = ragDollOf(of());
      const tall = doll.box.max.y;
      const { made, gone } = freed(doll.root);
      doll.soften(1);
      for (const done of ['shrink', 'sew', 'button', 'slacken', 'fall'] as const) doll[done](1);
      const box = seenBox(doll.root);
      expect(box.min.y).toBeGreaterThan(-tall * 0.03); // (lying on the ground, not in it)
      expect(box.max.y).toBeLessThan(tall * SMALL); // (down)
      expect(box.max.z - box.min.z).toBeGreaterThan(box.max.y - box.min.y);
      doll.dispose();
      expect(gone.size).toBe(made.size);
    }
    // Someone: a seam up each limb and down their front, a button an eye, their mouth stitched.
    const doll = ragDollOf(human());
    let [before, after] = [0, 0];
    const sewnOn = () => {
      let count = 0;
      doll.root.traverse((o) => ((o as THREE.Mesh).isMesh && o.scale.x > 0.5 && (o as THREE.Mesh).userData.full ? count++ : 0));
      return count;
    };
    before = sewnOn();
    doll.sew(1);
    const seams = sewnOn();
    doll.button(1);
    after = sewnOn();
    expect(before).toBe(0);
    expect(seams).toBeGreaterThanOrEqual(10);
    expect(after - seams).toBe(4);
    const grey = new THREE.Color(0.2, 0.2, 0.2);
    expect(softened(grey).r).toBeGreaterThan(0.2); // (softer: nearer linen)
  });

  it('is told step by step: smaller, softer, sewn, buttoned, slack, down', () => {
    for (const of of [human, beast]) {
      const { said, done } = played(of, dollStagingOf(of));
      expect(said).toEqual(['Idtram looks at the slab, and it is wider than it was.', 'Smaller. Knee high; then less.', 'Softer: skin to linen, the rest to stuffing.', 'Seams, up the legs. Small, even stitches.', of === human ? 'Up the arms; down the front. Whoever sewed it took care.' : 'Along the back; down the front. Whoever sewed it took care.', 'The eyes: buttons. Thread through each.', 'Nothing in the limbs to hold them.', 'Down.', 'A rag doll.']);
      expect(done).toHaveBeenCalledTimes(1);
    }
  });

  it('lies in the world as the one doll: a small model in its own palette, on the ground', () => {
    const grid = buildDoll();
    expect(grid.size).toEqual(DOLL_GRID);
    expect(DOLL_VOXEL_SIZE).toBe(LOOT_VOXEL_SIZE);
    expect(DOLL_MODEL.palette).toBe(DOLL_PALETTE);
    const [sx, sy, sz] = grid.size;
    const used = new Set<number>();
    const [low, high] = [[Infinity, Infinity, Infinity], [-1, -1, -1]];
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      const cell = grid.cells[x + sx * (y + sy * z)];
      if (!cell) continue;
      used.add(cell);
      [x, y, z].forEach((n, axis) => [(low[axis] = Math.min(low[axis], n)), (high[axis] = Math.max(high[axis], n))]);
    }
    for (const cell of used) expect(cell).toBeLessThanOrEqual(DOLL_PALETTE.length); // (only its palette)
    expect(used.size).toBeGreaterThanOrEqual(10); // (linen, smock, wool, buttons, thread, a mouth...)
    expect(low).toEqual([0, 0, 0]); // (on the ground, and filling its grid)
    expect(high).toEqual([sx - 1, sy - 1, sz - 1]);
    expect(sz).toBeGreaterThan(sy * 2); // (lying: longer than it's high)
    expect(Math.max(sx, sy, sz)).toBeLessThanOrEqual(10);
  });
});
