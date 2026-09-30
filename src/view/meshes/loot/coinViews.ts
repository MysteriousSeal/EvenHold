// Coins lying on the ground near the hero: a little pile, two stacks and
// loose coins (pileGeometry), glowing, turning slowly as it bobs, over a
// softly pulsing square of golden light on the ground, so it's seen from
// afar and scooped up on the way past. Made as coins come into range,
// dropped when they're picked up or left behind.

import * as THREE from 'three';
import type { GroundCoins } from '../../../model/hero/money';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';
import { Nearby } from '../common/nearby';

const VOXEL = 0.03;
const BOB = 0.02;
const SPIN = 1.2; // radians per second
const RING = 0.36; // the square of light under it, across
// A gold ramp, palette first: shadow, dark, mid, light, and a glint.
const PALETTE = [0x7a4e10, 0xb8841e, 0xe8b83a, 0xffe07a, 0xfff6d0];
const [SHADOW, DARK, MID, LIGHT, GLINT] = [1, 2, 3, 4, 5];

// A pile of coins that reads as money at a glance: two towers of stacked
// coins (a tall one and a short one) and two loose coins lying flat. Each
// coin is a stepped disc (4 across, corners cut: nothing round), one voxel
// thick; a tower wobbles a voxel from coin to coin, its coins banded dark
// and mid down its side so each one shows, the top one lit, with a glint.
function pileGeometry(): THREE.BufferGeometry {
  const grid = createGrid([9, 6, 9]);
  const coin = (x: number, y: number, z: number, color: (cx: number, cz: number) => number) => {
    for (let cx = 0; cx < 4; cx++) {
      for (let cz = 0; cz < 4; cz++) {
        const corner = (cx === 0 || cx === 3) && (cz === 0 || cz === 3);
        if (!corner) setColor(grid, x + cx, y, z + cz, color(cx, cz));
      }
    }
  };
  const tower = (x: number, z: number, height: number) => {
    for (let y = 0; y < height; y++) {
      const top = y === height - 1;
      const wobble = y % 2; // a voxel over every other coin
      coin(x + wobble, y, z, (cx, cz) => (top ? (cx === 1 && cz === 1 ? GLINT : LIGHT) : y === 0 ? SHADOW : y % 2 === 0 ? MID : DARK));
    }
  };
  coin(4, 0, 5, (cx, cz) => (cx === 1 && cz === 2 ? GLINT : cx + cz >= 4 ? MID : LIGHT)); // loose coins, flat
  coin(0, 0, 5, (cx, cz) => (cx + cz >= 4 ? DARK : MID));
  tower(0, 0, 6); // the tall stack
  tower(4, 1, 3); // the short one
  return greedyMesh(grid, PALETTE, VOXEL, new THREE.Vector3(-4.5 * VOXEL, 0, -4.5 * VOXEL));
}

// A square frame, bright at its edge and clear inside, as an alpha mask.
function ringMask(): THREE.DataTexture {
  const n = 16;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const edge = Math.min(x, y, n - 1 - x, n - 1 - y);
      const a = edge < 2 ? 255 : edge < 4 ? 90 : 20;
      data.set([a, a, a, 255], (y * n + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, n, n);
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export class CoinViews {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, emissive: 0x6a4a10 });
  private readonly geometry = pileGeometry();
  // The ring of light: a square frame, additive so it never hides what's under it.
  private readonly ring = new THREE.PlaneGeometry(RING, RING).rotateX(-Math.PI / 2);
  private readonly light = new THREE.MeshBasicMaterial({
    color: 0xffc840,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    alphaMap: ringMask(),
  });
  private readonly shown = new Nearby<GroundCoins, THREE.Group>(
    () => {
      const group = new THREE.Group();
      const glow = new THREE.Mesh(this.ring, this.light);
      glow.position.y = 0.006; // just above the ground
      group.add(glow, new THREE.Mesh(this.geometry, this.material));
      this.scene.add(group);
      return group;
    },
    (group) => group.removeFromParent(),
  );
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {}

  update(coins: readonly GroundCoins[], heroX: number, heroZ: number, dt: number): void {
    this.time += dt;
    this.light.opacity = 0.45 + Math.sin(this.time * 2.6) * 0.2;
    this.shown.update(coins, heroX, heroZ, (pile, group) => {
      group.position.set(pile.x, pile.y, pile.z);
      const coins = group.children[1];
      coins.position.y = 0.03 + Math.sin(this.time * 2.4 + pile.id) * BOB;
      coins.rotation.y = this.time * SPIN + pile.id; // turning slowly
    });
  }
}
