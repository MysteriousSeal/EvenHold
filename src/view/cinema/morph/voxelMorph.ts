// A figure taken apart into its voxels and put together again as another (a transformation of anything not
// human-shaped: transformCinema.ts): the figure's surface read off its meshes as a shell of cubes (`sampleFigure`:
// each face walked, the cube behind it kept, in its colour), each cube then sent to a place in the new shape
// (`VoxelMorph`: lowest to lowest, so feet go to feet and the crown to the comb), lifting off in a wave from the
// ground up, swung out and round, shrinking or swelling to the new voxels' size and taking their colour, and set
// down exactly where the new shape's voxels are, so what they've become can be put in its place unseen.
import * as THREE from 'three';
import { HUMAN_VOXEL_SIZE } from '../../meshes/human/bodyVoxels';
import type { VoxelGrid } from '../../meshes/voxel/greedyMesh';
import { smooth, steady } from '../easing';

export interface Cloud {
  at: THREE.Vector3[];
  color: THREE.Color[];
  size: number; // a voxel's side
}

// The cubes someone's read off as, here: each voxel of them split in two each way (some 60 to 70 to their height), so
// what lifts off them and what they change into moves in fine grains.
export const PERSON_CUBE = HUMAN_VOXEL_SIZE / 2;
const MOST = 2600; // cubes, at most (a coarser shell, past that)
const WAVE = 0.42; // of the whole, the last cube's start
const FLIGHT = 0.44; // of the whole, each cube's flight
const SHAPED_WAVE = 0.12; // of a morph, the last cube's start (from the ground up, the rest its way)

// The voxels of `parts` (each a grid in its palette, its voxel (0, 0, 0)'s corner at `origin`), at `size` a side.
export function cloudOf(parts: ReadonlyArray<{ grid: VoxelGrid; palette: number[]; origin: THREE.Vector3 }>, size: number): Cloud {
  const cloud: Cloud = { at: [], color: [], size };
  for (const { grid, palette, origin } of parts) {
    const [sx, sy, sz] = grid.size;
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          const cell = grid.cells[x + sx * (y + sy * z)];
          if (!cell) continue;
          cloud.at.push(new THREE.Vector3(origin.x + (x + 0.5) * size, origin.y + (y + 0.5) * size, origin.z + (z + 0.5) * size));
          cloud.color.push(new THREE.Color(palette[cell - 1]));
        }
      }
    }
  }
  return cloud;
}

// A figure's surface as a shell of cubes: about `rows` of them to its height (fewer, if that's too many). `voxel`
// (what it's built of voxels that size): read at that size, each mesh on its own grid (from its own corner), so
// every cube sits just where a voxel of it is, and the shell can be put in its place unseen.
export function sampleFigure(root: THREE.Object3D, height: number, rows = 26, voxel?: number): Cloud {
  root.updateMatrixWorld(true);
  const shown = (o: THREE.Object3D) => {
    for (let at: THREE.Object3D | null = o; at; at = at.parent) if (!at.visible) return false;
    return true;
  };
  for (let size = voxel ?? height / rows; ; size *= 1.25) {
    const cells = new Map<string, { at: THREE.Vector3; color: THREE.Color }>();
    const [a, b, c, n, p, ab, ac] = Array.from({ length: 7 }, () => new THREE.Vector3());
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!mesh.isMesh || Array.isArray(material) || !shown(mesh) || (material.transparent && !mesh.geometry.attributes.color) || !('color' in material)) return; // (no shade on the ground, no glow: what's seen through and has colours of its own, a ghost, is read)
      const { position, color } = mesh.geometry.attributes;
      const index = mesh.geometry.index;
      const corners = index ? index.count : position.count;
      if (voxel && !mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const corner = voxel ? mesh.geometry.boundingBox!.min : null; // (its own grid's)
      const placed = voxel ? IDENTITY : mesh.matrixWorld; // (its own grid: walked where it's built, each cube set in the world after)
      for (let i = 0; i + 2 < corners; i += 3) {
        const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
        a.fromBufferAttribute(position, ia).applyMatrix4(placed);
        b.fromBufferAttribute(position, ib).applyMatrix4(placed);
        c.fromBufferAttribute(position, ic).applyMatrix4(placed);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        n.crossVectors(ab, ac).normalize();
        const tint = color ? new THREE.Color().fromBufferAttribute(color, ia).multiply(material.color) : material.color.clone();
        // The face walked a cube's side at a time; the cube behind each point (half a side in from it) kept.
        const steps = Math.max(1, Math.ceil(Math.max(ab.length(), ac.length()) / size - 1e-4));
        for (let u = 0; u < steps; u++) {
          for (let v = 0; u + v < steps; v++) {
            p.copy(a).addScaledVector(ab, (u + 0.33) / steps).addScaledVector(ac, (v + 0.33) / steps).addScaledVector(n, -size * 0.5);
            if (corner) p.sub(corner);
            const [x, y, z] = [Math.floor(p.x / size), Math.floor(p.y / size), Math.floor(p.z / size)];
            const key = corner ? `${mesh.id}:${x},${y},${z}` : `${x},${y},${z}`;
            if (cells.has(key)) continue;
            const at = new THREE.Vector3((x + 0.5) * size, (y + 0.5) * size, (z + 0.5) * size);
            cells.set(key, { at: corner ? at.add(corner).applyMatrix4(mesh.matrixWorld) : at, color: tint });
          }
        }
      }
    });
    if (voxel || cells.size <= MOST) return { at: [...cells.values()].map((cell) => cell.at), color: [...cells.values()].map((cell) => cell.color), size };
  }
}

const IDENTITY = new THREE.Matrix4();
// A number from 0 to 1 that's `i`'s own, the same each time.
const own = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// For a morph of one shape into another: each cube of the old paired with the place in the new that answers to it
// (as far across, up and along its shape as the cube is in its own), and each place of the new left without one
// given the nearest cube's twin, so the new shape's whole; and each pair's turn, by how high it starts (0 the lowest).
function answering(from: Cloud, into: Cloud): [Array<[number, number]>, number[]] {
  const within = (cloud: Cloud) => {
    const box = new THREE.Box3().setFromPoints(cloud.at);
    const span = box.getSize(new THREE.Vector3()).addScalar(cloud.size); // (a cube's own width: a shape one cube thin still has a span)
    return cloud.at.map((at) => new THREE.Vector3((at.x - box.min.x + cloud.size / 2) / span.x, (at.y - box.min.y + cloud.size / 2) / span.y, (at.z - box.min.z + cloud.size / 2) / span.z));
  };
  const [a, b] = [within(from), within(into)];
  const nearest = (to: THREE.Vector3, among: THREE.Vector3[]) => {
    let [best, d] = [0, Infinity];
    for (let i = 0; i < among.length; i++) {
      const now = to.distanceToSquared(among[i]);
      if (now < d) [best, d] = [i, now];
    }
    return best;
  };
  const pairs: Array<[number, number]> = a.map((at, i) => [i, nearest(at, b)]);
  const filled = new Set(pairs.map((pair) => pair[1]));
  for (let j = 0; j < b.length; j++) if (!filled.has(j)) pairs.push([nearest(b[j], a), j]);
  return [pairs, pairs.map(([i]) => a[i].y)];
}

export class VoxelMorph {
  readonly mesh: THREE.InstancedMesh;
  private readonly sources: number[]; // each cube's place in the figure,
  private readonly to: number[]; // and in the new shape
  private readonly order: number[]; // and its turn to lift off, 0 the first to 1 the last
  private readonly reach: number;

  // `shaped`: a morph of the one shape into the other, nothing thrown about: each cube goes straight to the place in
  // the new shape that answers to its own in the old (as far across, up and along it), so a leg thins and shortens
  // into the new leg where it stands. Otherwise: taken apart and put together again, swung out and round on the way.
  constructor(
    private readonly from: Cloud,
    private readonly into: Cloud,
    private readonly shaped = false,
    private readonly wring = { twist: 0, ripple: 0 }, // a morph's: how far round its own length it's wrung on the way (radians, end to end), how much it swells and thins in ripples
  ) {
    if (shaped) {
      const [pairs, order] = answering(from, into);
      this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), pairs.length);
      this.mesh.frustumCulled = false;
      [this.sources, this.to, this.order, this.reach] = [pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1]), order, 0];
      new THREE.Box3().setFromPoints(from.at).getCenter(this.middle[0]);
      new THREE.Box3().setFromPoints(into.at).getCenter(this.middle[1]);
      this.update(0, 0);
      return;
    }
    const count = Math.max(from.at.length, into.at.length); // (every voxel of the new shape filled, whatever's left over shared out)
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), count);
    this.mesh.frustumCulled = false;
    // Lowest to lowest: both sorted by height (then round the middle), a cube sent to the place as far up the new
    // shape as it was up the old.
    const ranked = (cloud: Cloud) => cloud.at.map((_, i) => i).sort((i, j) => cloud.at[i].y - cloud.at[j].y || Math.atan2(cloud.at[i].x, cloud.at[i].z) - Math.atan2(cloud.at[j].x, cloud.at[j].z));
    const [low, lowTo] = [ranked(from), ranked(into)];
    this.sources = Array.from({ length: count }, (_, k) => low[Math.floor((k * low.length) / count)]);
    this.to = Array.from({ length: count }, (_, k) => lowTo[Math.floor((k * lowTo.length) / count)]);
    this.order = Array.from({ length: count }, (_, k) => k / count); // (from the ground up)
    const box = new THREE.Box3().setFromPoints(from.at);
    this.reach = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.7 + from.size * 4;
    this.update(0, 0);
  }

  private readonly middle = [new THREE.Vector3(), new THREE.Vector3()]; // the middle of the old shape, and of the new
  private readonly matrix = new THREE.Matrix4();
  private readonly spot = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly tint = new THREE.Color();

  // `u`: 0 the figure whole, 1 the new shape whole.
  update(u: number, time: number): void {
    const { from, into, mesh } = this;
    for (let k = 0; k < mesh.count; k++) {
      const [a, b] = [from.at[this.sources[k]], into.at[this.to[k]]];
      const start = this.shaped ? this.order[k] * SHAPED_WAVE : this.order[k] * WAVE + own(k, 1) * 0.08;
      const through = Math.max(0, Math.min(1, (u - start) / (this.shaped ? 1 - SHAPED_WAVE : FLIGHT)));
      const e = this.shaped ? steady(through) : smooth(through); // (a morph: steadily, only eased a little at either end)
      const aloft = this.shaped ? 0 : Math.sin(e * Math.PI); // 0 at rest either end, 1 mid-flight (a morph: never aloft)
      // Its way: from its place to its new one, swung out from the middle and round it, and up a little.
      const round = Math.atan2(a.x, a.z) + (0.6 + own(k, 2) * 1.6) * aloft + e * 0.9 * (own(k, 3) - 0.5);
      const out = this.reach * (0.35 + own(k, 4) * 0.65) * aloft;
      this.spot.lerpVectors(a, b, e);
      if (this.shaped && (this.wring.twist || this.wring.ripple)) {
        // Wrung: turned round its own length, the more the farther along it, and back as it sets; swelling and thinning in ripples that run up it.
        const along = this.order[k];
        const mid = Math.sin(e * Math.PI);
        const angle = this.wring.twist * mid * (along - 0.5) + this.wring.twist * 0.25 * mid * Math.sin(time * 6 + along * 4);
        const swell = 1 + this.wring.ripple * mid * Math.sin(along * 9 - time * 10);
        const [cx, cz] = [this.middle[0].x + (this.middle[1].x - this.middle[0].x) * e, this.middle[0].z + (this.middle[1].z - this.middle[0].z) * e];
        const [dx, dz] = [(this.spot.x - cx) * swell, (this.spot.z - cz) * swell];
        this.spot.x = cx + dx * Math.cos(angle) + dz * Math.sin(angle);
        this.spot.z = cz - dx * Math.sin(angle) + dz * Math.cos(angle);
      }
      this.spot.x += Math.sin(round) * out;
      this.spot.z += Math.cos(round) * out;
      this.spot.y += aloft * this.reach * (0.15 + own(k, 5) * 0.35) + (e > 0 && e < 1 ? Math.sin(time * 5 + k) * from.size * 0.3 * aloft : 0);
      this.axis.set(own(k, 6) - 0.5, own(k, 7) - 0.5, own(k, 8) - 0.5).normalize();
      this.turn.setFromAxisAngle(this.axis, this.shaped ? 0 : e * Math.PI * 2 * Math.round(1 + own(k, 9) * 2)); // (tumbling; square again as it lands)
      this.scale.setScalar((from.size + (into.size - from.size) * e) * (1 + 0.25 * aloft));
      mesh.setMatrixAt(k, this.matrix.compose(this.spot, this.turn, this.scale));
      this.tint.copy(from.color[this.sources[k]]).lerp(into.color[this.to[k]], this.shaped ? e : smooth(Math.max(0, Math.min(1, (e - 0.25) / 0.6)))); // (a morph: its colour with its shape)
      mesh.setColorAt(k, this.tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
