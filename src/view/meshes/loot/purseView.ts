// The purse dropped in the hero's last fall (model/hero/purse.ts), where it lies: a fat leather pouch slumped on its
// side, its drawstring loose, coins spilt from its mouth, bobbing and glowing as coins on the ground do; over it, a
// tall shaft of pale gold light, faint and breathing, to be seen from far off and walked back to. Shown only where it
// lies (outdoors, or on the floor of the dungeon it was dropped in).

import * as THREE from 'three';
import type { Purse } from '../../../model/hero/purse';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const VOXEL = 0.035;
const BOB = 0.02;
const BEAM = { height: 6, width: 0.22 }; // the shaft of light over it (tiles)
// Leather, palette first: shadow, mid, light; the drawstring; then gold (dark, mid, light).
const PALETTE = [0x3e2414, 0x6e4426, 0x9a6a3e, 0xd8c08a, 0xb8841e, 0xe8b83a, 0xffe07a];
const [SHADOW, MID, LIGHT, CORD, GOLD_DARK, GOLD, GOLD_LIGHT] = [1, 2, 3, 4, 5, 6, 7];

// The pouch: a stepped, squashed ball of leather (nothing round: a voxel's corners cut), its shadow side dark, its
// top lit; a gathered neck with the drawstring round it, its two ends trailing; spilt coins fanned from the mouth.
function purseGeometry(): THREE.BufferGeometry {
  const grid = createGrid([12, 9, 12]);
  for (let x = 0; x < 9; x++) for (let y = 0; y < 7; y++) for (let z = 1; z < 9; z++) {
    const [dx, dy, dz] = [x - 4, y - 3, z - 4.5];
    if (dx * dx / 18 + dy * dy / 10 + dz * dz / 18 > 1) continue; // (a squat ball, stepped)
    setColor(grid, x, y, z, y >= 5 || (y === 4 && dx < 1) ? LIGHT : dz > 2 || y <= 1 ? SHADOW : (x + z) % 5 === 0 ? SHADOW : MID); // (a crease here and there)
  }
  for (let y = 4; y < 8; y++) for (const [x, z] of [[3, 4], [4, 4], [3, 5], [4, 5]]) setColor(grid, x, y, z, y === 7 ? MID : LIGHT); // the gathered neck
  for (const [x, z] of [[2, 4], [5, 4], [2, 5], [5, 5], [3, 3], [4, 3], [3, 6], [4, 6]]) setColor(grid, x, 6, z, CORD); // the drawstring round it
  for (const [x, y, z] of [[6, 5, 4], [7, 4, 4], [8, 3, 5], [8, 2, 5]]) setColor(grid, x, y, z, CORD); // its ends, trailing
  // Coins spilt from its mouth, flat on the ground in a fan, one on its edge.
  for (const [x, z, c] of [[9, 6, GOLD], [10, 8, GOLD_LIGHT], [8, 9, GOLD], [10, 5, GOLD_DARK], [6, 10, GOLD_LIGHT], [9, 10, GOLD], [11, 7, GOLD]]) setColor(grid, x, 0, z, c);
  for (let y = 0; y < 3; y++) setColor(grid, 7, y, 9, y === 2 ? GOLD_LIGHT : GOLD);
  return greedyMesh(grid, PALETTE, VOXEL, new THREE.Vector3(-5 * VOXEL, 0, -6 * VOXEL));
}

// A shaft of light, bright at its foot and fading upward, soft at its edges, as an alpha mask.
function beamMask(): THREE.DataTexture {
  const [w, h] = [8, 32];
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = Math.round(255 * (1 - y / h) ** 1.6 * (1 - Math.abs(x - (w - 1) / 2) / (w / 2)));
    data.set([a, a, a, 255], (y * w + x) * 4);
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.needsUpdate = true;
  return texture;
}

export class PurseView {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, emissive: 0x3a2408 });
  private readonly group = new THREE.Group();
  private readonly pouch = new THREE.Mesh(purseGeometry(), this.material);
  private readonly light = new THREE.MeshBasicMaterial({ color: 0xffd870, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, alphaMap: beamMask(), side: THREE.DoubleSide });
  private time = 0;

  // `scale`: how big it's drawn (down a dungeon, as big as the hero is there).
  constructor(scene: THREE.Scene, scale = 1) {
    // Two crossed planes, so the shaft reads the same from any side.
    const beam = new THREE.PlaneGeometry(BEAM.width, BEAM.height).translate(0, BEAM.height / 2, 0);
    for (const turn of [0, Math.PI / 2]) {
      const plane = new THREE.Mesh(beam, this.light);
      plane.rotation.y = turn;
      this.group.add(plane);
    }
    this.group.add(this.pouch);
    this.group.scale.setScalar(scale);
    this.group.visible = false;
    scene.add(this.group);
  }

  // `here`: the dungeon the hero's in, by its key (null: outdoors); `groundY`: the ground's height there.
  update(purse: Purse | null, here: string | null, groundY: (x: number, z: number) => number, dt: number): void {
    this.time += dt;
    this.group.visible = !!purse && purse.under === here;
    if (!purse || !this.group.visible) return;
    this.group.position.set(purse.x, groundY(purse.x, purse.z), purse.z);
    this.pouch.position.y = 0.02 + Math.sin(this.time * 2.4) * BOB;
    this.pouch.rotation.y = this.time * 0.6;
    this.light.opacity = 0.32 + Math.sin(this.time * 1.8) * 0.12; // (breathing)
  }
}
