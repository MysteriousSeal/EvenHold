// Someone turned into a ghost (model/spells/turned.ts), played step by step (a staging all its own: staging.ts
// `direct`): a start; then the colour out of them, from the edges in (themselves read off as fine cubes, each paled
// as it comes to it: their hands, their hair and their hems first, the middle of them last), a cold light on them
// as it goes; then thinner, till the slab shows through them; seen close, their face, theirs still; their feet off
// the ground; and their legs, from the feet up, drawn in and trailing away to a wisp. Then themselves, a ghost, hung
// where they stood (meshes/turned/turnedGhost.ts). What has no voxels to it (a ghost of the ruins): only dwindling,
// as ever.
import * as THREE from 'three';
import { HUMAN_VOXEL_SIZE } from '../../meshes/human/bodyVoxels';
import { LIFT, SEEN, ghostFigure, ghostLooks, ghosted, kneeOf, seenThrough, wispAt } from '../../meshes/turned/turnedGhost';
import { bell, smooth, through, type Span } from '../easing';
import { read } from '../morph/clouds';
import { sampleFigure } from '../morph/voxelMorph';
import type { Staging } from '../staging';

const LENGTH = 11; // seconds
const START: Span = [0, 0.05];
const DRAINING: Span = [0.08, 0.5]; // their colour, from the edges of them to their middle
const BAND = 0.25; // of the way in, the pale's edge: where it's coming to them
const THINNING: Span = [0.42, 0.7];
const CLOSE: Span = [0.52, 0.62]; // seen close, for their face
const LIFTING: Span = [0.72, 0.86];
const TRAILING: Span = [0.82, 0.97]; // their legs, to a wisp
const LEAST = 40; // cubes there must be of them (fewer: nothing to turn)
const COLD = { color: 0xa8d4ff, most: 2.2 }; // the light on them
const SAID: ReadonlyArray<[at: number, line: string]> = [
  [0, '{name} feels the warmth go out of their hands.'],
  [DRAINING[0], 'The colour, first: out of the fingers, the hair, the hems.'],
  [0.27, 'Then inward. Pale, to the middle of them.'],
  [THINNING[0], 'Thinner. The slab shows through the chest.'],
  [CLOSE[0], 'The face, theirs still. There is less of it.'],
  [LIFTING[0], 'The feet leave the ground. Nothing lifted them.'],
  [TRAILING[0] + 0.03, 'Below the knee, no legs to speak of: a wisp.'],
  [0.96, 'A ghost, where they stood.'],
];

// `stood`: whoever's turned, drawn afresh as they stood (what they'll be, a ghost).
export function ghostStagingOf(stood: () => THREE.Object3D): Staging {
  const cold = () => new THREE.PointLight(COLD.color, 0, 0, 1.2);
  return {
    title: "Gravedigger's curse",
    becomes: 'A ghost',
    lines: [[0, '{name} feels the warmth go out of their hands.'], [0.5, 'And is hardly there.']],
    target: () => {
      const ghost = ghostFigure(stood());
      const height = new THREE.Box3().setFromObject(ghost.root).max.y;
      const light = cold();
      light.position.set(-height * 0.5, height * 1.5, height * 0.9);
      light.intensity = COLD.most;
      ghost.root.add(light);
      return { root: ghost.root, height, settle: (_j, time) => ghost.drift(time) };
    },
    direct(figure, scene, tall, actor) {
      const cloud = actor.human ? read(figure, tall) : sampleFigure(figure, tall, 30);
      if (cloud.at.length < LEAST) return null;
      const looks = ghostLooks(0xffffff);
      const mesh = seenThrough(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), looks.plain, cloud.at.length), looks.depth);
      for (const drawn of [mesh, ...mesh.children]) drawn.frustumCulled = false;
      const box = new THREE.Box3().setFromPoints(cloud.at);
      const top = box.max.y + cloud.size / 2;
      const knee = kneeOf(figure, top);
      const long = knee + LIFT - HUMAN_VOXEL_SIZE; // (the wisp's, as it'll be)
      // How near the edge of them each cube is (0 their middle, 1 the farthest of them from it): the pale comes from there.
      const core = new THREE.Vector3(0, top * 0.58, 0);
      const span = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(cloud.size);
      const far = cloud.at.map((at) => Math.hypot((at.x - core.x) / span.x, (at.y - core.y) / (top * 0.58), (at.z - core.z) / span.z));
      const farthest = Math.max(...far);
      const pale = cloud.color.map((color) => ghosted(color)); // (each cube's own, a ghost's)
      const light = cold();
      light.position.set(-tall * 0.5, tall * 1.5, tall * 0.9);
      const lifted = new THREE.Group();
      lifted.add(mesh);
      scene.add(lifted, light);
      const [matrix, scale, still, tint, spot] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Color(), new THREE.Vector3()];
      return {
        length: LENGTH,
        lines: SAID,
        update(u, time) {
          const changing = u >= START[1];
          figure.visible = !changing;
          figure.position.y = changing ? 0 : bell(through(u, START)) * tall * 0.03; // (a start)
          mesh.visible = changing;
          const [drained, thin, trail] = [through(u, DRAINING) * (1 + BAND), smooth(through(u, THINNING)), through(u, TRAILING)];
          looks.ghostly(smooth(through(u, [DRAINING[0] + 0.12, DRAINING[1] + 0.06])));
          looks.plain.opacity = 1 - (1 - SEEN) * thin;
          light.intensity = COLD.most * smooth(through(u, [DRAINING[0], THINNING[1]]));
          lifted.position.y = LIFT * smooth(through(u, LIFTING)) + Math.sin(time * 1.7) * 0.01 * smooth(through(u, LIFTING));
          for (const [i, at] of cloud.at.entries()) {
            const k = smooth(Math.max(0, Math.min(1, (drained - (1 - far[i] / farthest)) / BAND))); // 0 their own colour, 1 a ghost's
            spot.copy(at);
            if (at.y < knee && trail > 0) {
              // Under the knee: drawn in to where the wisp is and down its length, the feet first; swaying, once it's that.
              const t = (knee - at.y) / knee; // 0 the knee, 1 the sole
              const drawn = smooth(Math.max(0, Math.min(1, trail * 1.7 - (1 - t) * 0.7)));
              const { wide, aside, behind } = wispAt(t);
              const sway = Math.sin(time * 1.9 + t * 2) * 0.05 * t * drawn;
              spot.x = at.x * (1 + (wide - 1) * drawn) + (aside * HUMAN_VOXEL_SIZE + sway) * drawn;
              spot.z = at.z * (1 + (wide - 1) * drawn) - behind * HUMAN_VOXEL_SIZE * drawn;
              spot.y = at.y + (knee - t * long - at.y) * drawn;
            }
            scale.setScalar(cloud.size * (1 + 0.12 * bell(k)));
            mesh.setMatrixAt(i, matrix.compose(spot, still, scale));
            mesh.setColorAt(i, tint.copy(cloud.color[i]).lerp(pale[i], k));
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        },
        view(u, j) {
          const close = smooth(through(u, CLOSE)) * (1 - smooth(through(u, [0.66, 0.74]))) * (1 - smooth(through(j, [0, 0.2])));
          const mix = (whole: number, near: number) => whole + (near - whole) * close;
          return { aim: mix(tall * 0.5, top * 0.8), far: mix(tall * 4.2, tall * 2.1), rise: mix(0.28, 0.16) };
        },
        dispose() {
          for (const object of [lifted, light]) object.removeFromParent();
          mesh.geometry.dispose();
          looks.dispose();
          light.dispose();
        },
      };
    },
  };
}
