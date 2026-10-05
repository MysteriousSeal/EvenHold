// The flames over bandit campfires near the hero, and on their gatehouses'
// torches (the fire effect in fire.ts), lit as camps come into range and put
// out when they're left.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { FireEffect } from '../common/fire';
import { CAMP_VOXEL_SIZE as V, GATE_TORCHES, TILE } from './campVoxels';
import type { CampPiece } from '../../../model/camps/camps';

const VIEW_RADIUS = 30;
const BED_HEIGHT = 0.08; // the campfire's logs, above the ground

export class CampFires {
  private readonly fires = new Map<string, FireEffect>();

  constructor(private readonly scene: THREE.Scene) {}

  update(model: GameModel, time: number): void {
    const { hero } = model;
    const seen = new Set<string>();
    for (const camp of model.camps) {
      if (Math.abs(camp.x - hero.x) > VIEW_RADIUS || Math.abs(camp.z - hero.z) > VIEW_RADIUS) continue;
      const pit = camp.pieces.find((p) => p.kind === 'fire');
      if (pit) this.light(`${pit.x},${pit.z}`, seen, time, () => new FireEffect(0.24, 0.17, 0.045, pit.x * 31 + pit.z), pit.x, model.heightMap[pit.x][pit.z] * TILE_HEIGHT + BED_HEIGHT, pit.z);
      const gate = camp.pieces.find((p) => p.kind === 'gate');
      if (gate) {
        GATE_TORCHES.forEach((at, i) => {
          const { x, y, z } = onPiece(gate, at);
          this.light(`${gate.x},${gate.z}:${i}`, seen, time, () => new FireEffect(0.05, 0.13, 0.03, gate.x * 7 + i), x, model.heightMap[gate.x][gate.z] * TILE_HEIGHT + y, z);
        });
      }
    }
    this.putOut(seen);
  }

  // The fire at `key` lit (made if it's new, at x, y, z), and burning on.
  private light(key: string, seen: Set<string>, time: number, make: () => FireEffect, x: number, y: number, z: number): void {
    seen.add(key);
    let fire = this.fires.get(key);
    if (!fire) {
      fire = make();
      fire.group.position.set(x, y, z);
      this.scene.add(fire.group);
      this.fires.set(key, fire);
    }
    fire.update(time);
  }

  private putOut(seen: Set<string>): void {
    for (const [key, fire] of this.fires) {
      if (seen.has(key)) continue;
      fire.dispose();
      this.fires.delete(key);
    }
  }
}

// Where a voxel (gx, gy, gz) of a piece's grid stands in the world (its middle), the piece turned as it's drawn.
function onPiece(piece: CampPiece, [gx, gy, gz]: readonly [number, number, number]): { x: number; y: number; z: number } {
  const [lx, lz] = [(gx + 0.5 - TILE / 2) * V, (gz + 0.5 - TILE / 2) * V];
  const a = (piece.quarterTurns * Math.PI) / 2;
  return { x: piece.x + lx * Math.cos(a) + lz * Math.sin(a), y: gy * V, z: piece.z - lx * Math.sin(a) + lz * Math.cos(a) };
}
