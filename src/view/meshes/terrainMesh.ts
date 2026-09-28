import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL, TILE_HEIGHT } from '../../model/constants';
import { TERRAIN_COLORS, WATER_COLOR } from '../constants';

interface TileGroup {
  tier: number;
  kind: 'water' | 'land';
  cells: Array<{ x: number; z: number }>;
}

function tileMaterial(group: TileGroup): THREE.MeshStandardMaterial {
  switch (group.kind) {
    case 'water':
      return new THREE.MeshStandardMaterial({ color: WATER_COLOR, flatShading: true, roughness: 0.35, metalness: 0.1 });
    case 'land':
      return new THREE.MeshStandardMaterial({ color: TERRAIN_COLORS[group.tier % TERRAIN_COLORS.length] });
  }
}

// Every lake cell renders at a fixed WATER_LEVEL height regardless of its
// actual bed tier (0 or 1), so the lake surface stays flat — using each
// cell's real tier here would carve a visible internal cliff between
// adjacent water cells of different depths.
//
// Tiles are grouped by (tier, kind) and each group is one InstancedMesh, so
// the draw call count stays at a handful no matter how large the map is.
// Paths and village squares aren't tile colors — they're thin overlays
// drawn on top by groundDecals.ts, so they can be narrower than a tile.
export function buildTerrain(scene: THREE.Scene, model: GameModel): void {
  const groups = new Map<string, TileGroup>();

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const isLake = model.lakeMap[x][z];
      const tier = isLake ? WATER_LEVEL : model.heightMap[x][z];
      const kind = isLake ? 'water' : 'land';
      const key = `${kind}:${tier}`;

      let group = groups.get(key);
      if (!group) {
        group = { tier, kind, cells: [] };
        groups.set(key, group);
      }
      group.cells.push({ x, z });
    }
  }

  const matrix = new THREE.Matrix4();
  for (const group of groups.values()) {
    // Column spans from one tier below ground level up to the tile's surface.
    const columnHeight = (group.tier + 1) * TILE_HEIGHT;
    const geometry = new THREE.BoxGeometry(1, columnHeight, 1);
    const mesh = new THREE.InstancedMesh(geometry, tileMaterial(group), group.cells.length);

    group.cells.forEach((cell, i) => {
      matrix.makeTranslation(cell.x, group.tier * TILE_HEIGHT - columnHeight / 2, cell.z);
      mesh.setMatrixAt(i, matrix);
    });

    scene.add(mesh);
  }
}
