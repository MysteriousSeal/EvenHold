// Someone turned to stone (model/spells/turned.ts), played step by step (a staging all its own: staging.ts
// `direct`): a start; then the stone, from the ground up, through them and what they wear alike (themselves read
// off as fine cubes, each greyed as the stone comes to it, swollen a moment as it does): their feet, their legs,
// their hips, their chest and arms, their throat; seen close, their face, their eyes last; and a plinth of it risen
// under them. Then themselves in stone, on it (meshes/turned/statue.ts). What has no voxels to it (a ghost): only
// dwindling, as ever.
import * as THREE from 'three';
import { stoneFigure, stoned } from '../../meshes/turned/statue';
import { bell, smooth, through, type Span } from '../easing';
import { read } from '../morph/clouds';
import { sampleFigure } from '../morph/voxelMorph';
import type { Staging } from '../staging';

const LENGTH = 11; // seconds
const START: Span = [0, 0.05];
const RISING: Span = [0.08, 0.86]; // the stone, from their feet to the top of their head
const BAND = 0.12; // of their height, the stone's edge: where it's coming to them
const CLOSE: Span = [0.6, 0.68]; // seen close, for their face
const PLINTH: Span = [0.9, 1];
const LEAST = 40; // cubes there must be of them (fewer: nothing to turn)
// What's said as the stone reaches each height of them (of their height).
const STEPS: ReadonlyArray<[at: number, line: string]> = [
  [0, 'The feet: stone, and will not lift.'],
  [0.12, 'The legs, cold, to the knee; then past it.'],
  [0.3, 'The hips. What they wear, stone with them.'],
  [0.42, 'The chest; the arms, where they hang.'],
  [0.58, 'The throat. No breath for a word.'],
  [0.68, 'The face, as it was just then.'],
  [0.9, 'The eyes, last.'],
];

// `stood`: whoever's turned, drawn afresh as they stood (what they'll be, in stone).
export function statueStagingOf(stood: () => THREE.Object3D): Staging {
  const said: Staging['lines'] = [[0, '{name} feels the cold come up out of the ground.'], ...STEPS.map(([at, line]): [number, string] => [RISING[0] + (RISING[1] - RISING[0]) * at, line]), [PLINTH[0], 'A statue, where they stood.']];
  return {
    title: "Mason's curse",
    becomes: 'A statue',
    lines: [[0, '{name} feels the cold come up out of the ground.'], [0.5, 'And is still.']],
    target: () => {
      const statue = stoneFigure(stood());
      const height = new THREE.Box3().setFromObject(statue.root).max.y;
      return { root: statue.root, height, settle() {} };
    },
    direct(figure, scene, tall, actor) {
      const cloud = actor.human ? read(figure, tall) : sampleFigure(figure, tall, 30);
      if (cloud.at.length < LEAST) return null;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), cloud.at.length);
      mesh.frustumCulled = false;
      const top = Math.max(...cloud.at.map((at) => at.y)) + cloud.size / 2;
      const plinth = stoneFigure(new THREE.Group(), 0);
      const lifted = new THREE.Group();
      lifted.add(mesh);
      scene.add(lifted, plinth.root);
      const [matrix, scale, still, tint] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Color()];
      const greys = cloud.color.map((color) => stoned(color)); // (each cube's own, in stone)
      const high = new THREE.Box3().setFromObject(stoneFigure(new THREE.Group()).root).max.y; // (how high its plinth stands)
      return {
        length: LENGTH,
        lines: said,
        update(u) {
          const changing = u >= START[1];
          figure.visible = !changing;
          figure.position.y = changing ? 0 : bell(through(u, START)) * tall * 0.03; // (a start)
          mesh.visible = changing;
          // The stone's edge: from under their feet to over their head.
          const edge = (through(u, RISING) * (1 + BAND) - BAND) * top;
          for (const [i, at] of cloud.at.entries()) {
            const k = smooth(Math.max(0, Math.min(1, (edge + BAND * top - at.y) / (BAND * top)))); // 0 themselves, 1 stone
            scale.setScalar(cloud.size * (1 + 0.14 * bell(k)));
            mesh.setMatrixAt(i, matrix.compose(at, still, scale));
            mesh.setColorAt(i, tint.copy(cloud.color[i]).lerp(greys[i], k));
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          // Its plinth, risen under them.
          const raised = smooth(through(u, PLINTH));
          plinth.raise(raised);
          plinth.root.visible = raised > 0;
          lifted.position.y = high * raised;
        },
        view(u, j) {
          const close = smooth(through(u, CLOSE)) * (1 - smooth(through(u, [0.9, 0.97]))) * (1 - smooth(through(j, [0, 0.2])));
          const mix = (whole: number, near: number) => whole + (near - whole) * close;
          return { aim: mix(tall * 0.5, top * 0.8), far: mix(tall * 4.2, tall * 2.1), rise: mix(0.28, 0.16) };
        },
        dispose() {
          for (const object of [lifted, plinth.root]) object.removeFromParent();
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        },
      };
    },
  };
}
