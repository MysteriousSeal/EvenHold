// Loot lying on the ground near the hero: each item's voxel model, turning
// slowly and bobbing a little above the grass, over a softly pulsing square
// of light in its quality's color, with a faint beam rising from it that
// shows from afar. Made as loot comes into range, dropped when it's picked
// up or left behind.

import * as THREE from 'three';
import type { GroundLoot } from '../../../model/loot/loot';
import { isLootItem, qualityOf, type BagItem, type Quality } from '../../../model/hero/bag';
import { ITEMS, type ItemId } from '../../../model/human/equipment';
import { humanFigure } from '../human/humanFigure';
import { ITEM_MODELS } from '../human/gear/itemModels';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';
import { LOOT_VOXEL_SIZE } from './lootModel';
import { LOOT_MODELS } from './lootModels';

const VIEW_RADIUS = 30;
const SPIN = 1.4; // radians per second
const HOVER = 0.1; // above the ground
const BOB = 0.02;
const QUALITY_COLOR: Record<Quality, number> = { junk: 0xd8d4cc, common: 0xfff1d6 };
const GEAR_VOXEL = 0.035; // gear on the ground, a little larger than worn
const RING_VOXEL = 0.04; // the world's grid
const RING_SIZE = 13; // voxels across
const BEAM_HEIGHT = 1.4;
const BEAM_WIDTH = 0.06;

// Additive light that never hides what's behind it.
const glow = (color: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true });

// A square frame of voxels, flat on the ground, a voxel thick.
function ringGeometry(): THREE.BufferGeometry {
  const n = RING_SIZE;
  const grid = createGrid([n, 1, n]);
  fillBox(grid, 0, 0, 0, n - 1, 0, n - 1, (x, _y, z) => (x === 0 || z === 0 || x === n - 1 || z === n - 1 ? 1 : 0));
  return greedyMesh(grid, [0xffffff], RING_VOXEL, new THREE.Vector3((-n * RING_VOXEL) / 2, 0, (-n * RING_VOXEL) / 2)).scale(1, 0.25, 1);
}

// A thin square column of light, bright at the bottom and fading out up top.
function beamGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(BEAM_WIDTH, BEAM_HEIGHT, BEAM_WIDTH).translate(0, BEAM_HEIGHT / 2, 0);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const fade = 1 - position.getY(i) / BEAM_HEIGHT;
    colors.set([1, 1, 1, fade * fade], i * 4);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return geometry;
}

export class LootViews {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  private readonly geometries = new Map<BagItem, THREE.BufferGeometry>();
  private readonly shown = new Map<number, { group: THREE.Group; item: THREE.Mesh }>();
  private readonly ring = ringGeometry();
  private readonly beam = beamGeometry();
  private readonly ringLight = new Map<Quality, THREE.MeshBasicMaterial>();
  private readonly beamLight = new Map<Quality, THREE.MeshBasicMaterial>();
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {}

  get materials(): THREE.Material[] {
    return [this.material];
  }

  update(loot: readonly GroundLoot[], heroX: number, heroZ: number, dt: number): void {
    this.time += dt;
    const pulse = 0.5 + Math.sin(this.time * 2.6) * 0.5;
    for (const light of this.ringLight.values()) light.opacity = 0.35 + pulse * 0.3;
    for (const light of this.beamLight.values()) light.opacity = 0.22 + pulse * 0.1;
    const seen = new Set<number>();
    for (const item of loot) {
      if (Math.abs(item.x - heroX) > VIEW_RADIUS || Math.abs(item.z - heroZ) > VIEW_RADIUS) continue;
      seen.add(item.id);
      let shown = this.shown.get(item.id);
      if (!shown) {
        shown = this.show(item);
        this.shown.set(item.id, shown);
      }
      const phase = this.time + item.id * 0.7;
      shown.group.position.set(item.x, item.y, item.z);
      shown.item.position.y = HOVER + Math.sin(phase * 2.2) * BOB;
      shown.item.rotation.y = phase * SPIN;
    }
    for (const [id, shown] of this.shown) {
      if (seen.has(id)) continue;
      shown.group.removeFromParent();
      this.shown.delete(id);
    }
  }

  private show(loot: GroundLoot): { group: THREE.Group; item: THREE.Mesh } {
    const quality = qualityOf(loot.item);
    const light = (lights: Map<Quality, THREE.MeshBasicMaterial>) => {
      let material = lights.get(quality);
      if (!material) {
        material = glow(QUALITY_COLOR[quality]);
        lights.set(quality, material);
      }
      return material;
    };
    const group = new THREE.Group();
    const item = new THREE.Mesh(this.geometry(loot.item), this.material);
    const ring = new THREE.Mesh(this.ring, light(this.ringLight));
    ring.position.y = 0.006; // just above the grass
    const beam = new THREE.Mesh(this.beam, light(this.beamLight));
    group.add(ring, beam, item);
    this.scene.add(group);
    return { group, item };
  }

  // Each item's mesh, centered on its middle so it spins in place, resting on
  // y = 0: junk from its model, gear as it looks worn or held (or its jewel).
  private geometry(item: BagItem): THREE.BufferGeometry {
    let geometry = this.geometries.get(item);
    if (!geometry) {
      if (isLootItem(item)) {
        const model = LOOT_MODELS[item];
        geometry = greedyMesh(model.build(), model.palette, LOOT_VOXEL_SIZE, new THREE.Vector3());
      } else {
        const gear = ITEM_MODELS[item as ItemId];
        const figure = gear.jewel ? { grid: gear.jewel.build(), palette: gear.palette } : humanFigure(null, { [ITEMS[item as ItemId].slot]: item });
        geometry = greedyMesh(figure.grid, figure.palette, GEAR_VOXEL, new THREE.Vector3());
      }
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      this.geometries.set(item, geometry);
    }
    return geometry;
  }
}
