// Someone turned into a painting (model/spells/turned.ts), played step by step (a staging all its own: staging.ts
// `direct`): a start, and they're held stiff, lifted a hand off the slab (themselves read off as fine cubes); a
// frame round them, its four corners first, out of the dark, then its rails grown from them till they meet; a
// painted ground behind them, from its edges in; then flatter, the depth of them gone back into it, their back
// where it was; their colours to paint, from the head down, and a crack or two across it; a cord and a nail, and
// it rises, turns to be looked at, and hangs. Then the painting of them (meshes/turned/painting.ts), there. What has
// no voxels to it (a ghost): only dwindling, as ever.
import * as THREE from 'three';
import { HUMAN_VOXEL_SIZE } from '../../meshes/human/bodyVoxels';
import { PAINTING_PALETTE, PROUD, RAIL, ROOM, layoutOf, painted, paintingOf } from '../../meshes/turned/painting';
import { boxOf, solidMeshes } from '../../meshes/turned/recoloured';
import { bell, smooth, through, type Span } from '../easing';
import { read } from '../morph/clouds';
import { cloudOf, sampleFigure } from '../morph/voxelMorph';
import type { Staging } from '../staging';

const V = HUMAN_VOXEL_SIZE;
const LENGTH = 12; // seconds
const START: Span = [0, 0.05];
const HELD: Span = [0.05, 0.13]; // lifted off the slab, as far as the frame's rail is wide
const FRAMING: Span = [0.08, 0.4]; // its corners, then its rails from them
const GROUND: Span = [0.36, 0.5];
const FLATTENING: Span = [0.5, 0.68];
const PAINTING: Span = [0.66, 0.86]; // their colours, from the head down
const CRACKING: Span = [0.78, 0.88];
const HANGING: Span = [0.88, 1];
const LEAST = 40; // cubes there must be of them (fewer: nothing to turn)
const TURN = 0.6; // radians it turns as it hangs, to be looked at
const HUNG = 0.3; // of their height, how far it rises to hang
const SAID: ReadonlyArray<[at: number, line: string]> = [
  [0, '{name} finds they cannot turn their head.'],
  [FRAMING[0], 'Four corners of gilt, out of the dark.'],
  [0.2, 'They close. A rail under the feet; one over the head.'],
  [GROUND[0], 'Behind them, a ground of old brown.'],
  [FLATTENING[0], 'Flatter. The depth of them goes first.'],
  [0.6, "Chest to back, a finger's width; then less."],
  [PAINTING[0] + 0.02, 'The colours, to paint: duller, and yellowing.'],
  [CRACKING[0] + 0.02, 'A crack or two. It is old already.'],
  [HANGING[0], 'Up, to where a nail would be.'],
];
// What's said of a beast's, where it differs (what has no head to turn: a spider, a worm).
const BEASTLY: Record<string, string> = { '{name} finds they cannot turn their head.': '{name} finds they cannot turn.' };
const saidOf = (person: boolean) => (person ? SAID : SAID.map(([at, line]): [number, string] => [at, BEASTLY[line] ?? line]));
// A number from 0 to 1 that's `i`'s own, the same each time.
const own = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// `stood`: whoever's turned, drawn afresh as they stood (what's in the painting).
export function paintingStagingOf(stood: () => THREE.Object3D): Staging {
  // Where a painting of what takes up `box` forms, round them as they stand: its middle on the wall, in their space
  // (their back where it was); how far it's lifted for its rail to clear the slab; and how far up it hangs after.
  const placed = (box: THREE.Box3, tall: number) => {
    const layout = layoutOf(box);
    return { layout, middle: new THREE.Vector3(-layout.at.x, -layout.at.y, box.min.z - PROUD), held: (RAIL + ROOM.under + 1) * V, hung: tall * HUNG };
  };
  return {
    title: "Limner's curse",
    becomes: 'A painting',
    lines: [[0, '{name} finds they cannot turn.'], [0.5, 'And is a small picture of themselves.']],
    target: () => {
      const painting = paintingOf(stood());
      const { box, size } = painting.layout;
      const { middle, held, hung } = placed(box, box.max.y);
      const root = new THREE.Group();
      root.add(painting.root);
      root.position.set(middle.x, middle.y + held + hung, middle.z); // (where the staging leaves it: lifted, hung, turned)
      root.rotation.y = TURN;
      return { root, height: root.position.y + size.y / 2, settle() {} };
    },
    direct(figure, scene, tall, actor) {
      const cloud = actor.human ? read(figure, tall) : sampleFigure(figure, tall, 30);
      if (cloud.at.length < LEAST) return null;
      const box = boxOf(figure, solidMeshes(figure));
      const { layout, middle, held, hung } = placed(box, tall);
      const { frame, flat } = layout;
      const paints = cloud.color.map((color) => painted(color)); // (each cube's own, in paint)
      const top = box.max.y;
      // Them: fine cubes, in their own space still (hung with the frame, to go where it does).
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), cloud.at.length);
      mesh.position.copy(middle).negate();
      // A crack: a line of cubes across them, wandering; a few of them.
      const cracks = [0, 1].map((i) => ({ y: top * (0.25 + 0.5 * own(i, 1)), lean: (own(i, 2) - 0.5) * 2.4, from: box.min.x + (box.max.x - box.min.x) * own(i, 3) * 0.6 }));
      const cracked = cloud.at.map((at) => cracks.some((crack) => at.x >= crack.from && at.x <= crack.from + top * 0.2 && Math.abs(at.y - crack.y - crack.lean * (at.x - crack.from)) < cloud.size * 0.5));
      const dark = new THREE.Color(PAINTING_PALETTE[PAINTING_PALETTE.length - 1]);
      // The frame, the ground in it, the cord and nail over it: its voxels, each to come in its turn.
      const around = cloudOf([frame], V);
      const framed = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x2a1c06 }), around.at.length);
      for (const drawn of [mesh, framed]) drawn.frustumCulled = false;
      const [half, high] = [(frame.wide * V) / 2, (frame.tall * V) / 2];
      const parts = around.at.map((at) => {
        const [fromSide, fromEnd] = [half - Math.abs(at.x), high - Math.abs(at.y)]; // how far in from the frame's outside, across and up
        if (at.y > high) return { kind: 'cord' as const, turn: 0, out: new THREE.Vector3() };
        if (Math.min(fromSide, fromEnd) > RAIL * V) return { kind: 'ground' as const, turn: 1 - Math.min(1, Math.hypot(at.x / half, at.y / high)), out: new THREE.Vector3() };
        // (A rail's voxel: its turn by how far it is along it from its corner; come from out past that corner, and above.)
        const along = (Math.max(0, fromSide - RAIL * V) + Math.max(0, fromEnd - RAIL * V)) / Math.max(half, high);
        return { kind: 'rail' as const, turn: along > 0 ? 0.3 + 0.7 * along : 0, out: new THREE.Vector3(Math.sign(at.x) * tall * 0.9, tall * (at.y > 0 ? 0.9 : 0.35), 0) };
      });
      const hang = new THREE.Group(); // (its middle on the wall: what's lifted, turned and hung)
      hang.add(mesh, framed);
      scene.add(hang);
      const [matrix, scale, still, tint, spot] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Color(), new THREE.Vector3()];
      for (const [i, color] of around.color.entries()) framed.setColorAt(i, color);
      return {
        length: LENGTH,
        lines: saidOf(!!actor.human),
        update(u) {
          const changing = u >= START[1];
          figure.visible = !changing;
          figure.position.y = changing ? 0 : bell(through(u, START)) * tall * 0.03; // (a start)
          hang.visible = changing;
          const [lifted, rising] = [smooth(through(u, HELD)), smooth(through(u, HANGING))];
          hang.position.set(middle.x, middle.y + held * lifted + hung * rising, middle.z);
          hang.rotation.y = TURN * rising;
          // Them: flatter, their back where it was; in paint, from the head down; cracked.
          const [pressed, paint, crack] = [smooth(through(u, FLATTENING)), through(u, PAINTING) * 1.3, smooth(through(u, CRACKING))];
          const deep = 1 + (flat - 1) * pressed;
          for (const [i, at] of cloud.at.entries()) {
            const k = smooth(Math.max(0, Math.min(1, (paint - (1 - at.y / top)) / 0.3))); // 0 their own colour, 1 paint
            spot.set(at.x, at.y, box.min.z + (at.z - box.min.z) * deep);
            scale.set(cloud.size, cloud.size, cloud.size * deep);
            mesh.setMatrixAt(i, matrix.compose(spot, still, scale));
            tint.copy(cloud.color[i]).lerp(paints[i], k);
            mesh.setColorAt(i, cracked[i] ? tint.lerp(dark, crack * 0.7) : tint);
          }
          // Its frame: the corners in from out of the dark, the rails from them; the ground, from its edges in; the cord, last.
          const [closing, laid, corded] = [through(u, FRAMING), through(u, GROUND), smooth(through(u, [HANGING[0] - 0.04, HANGING[0] + 0.02]))];
          for (const [i, at] of around.at.entries()) {
            const part = parts[i];
            const k = part.kind === 'cord' ? corded : part.kind === 'ground' ? smooth(Math.max(0, Math.min(1, (laid * 1.3 - part.turn) / 0.3))) : smooth(Math.max(0, Math.min(1, (closing * 1.25 - part.turn) / 0.25)));
            spot.copy(at).addScaledVector(part.out, part.turn === 0 ? (1 - k) ** 2 : 0);
            scale.setScalar(Math.max(1e-5, V * (part.kind === 'rail' && part.turn === 0 ? Math.min(1, k * 4) : k)));
            framed.setMatrixAt(i, matrix.compose(spot, still, scale));
          }
          for (const drawn of [mesh, framed]) drawn.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        },
        view(u) {
          const [lifted, rising] = [smooth(through(u, HELD)), smooth(through(u, HANGING))];
          return { aim: tall * 0.52 + held * lifted + hung * rising, far: tall * (4.6 + 0.6 * smooth(through(u, FRAMING))), rise: 0.24 };
        },
        dispose() {
          hang.removeFromParent();
          for (const drawn of [mesh, framed]) [drawn.geometry.dispose(), (drawn.material as THREE.Material).dispose()];
        },
      };
    },
  };
}
