// The gold "!" of quests (questVoxels.ts): one mesh shared by every mark,
// unlit and drawn over everything; and the small ones hovering over the
// notice boards that have a quest the hero could take.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { noticeBoards } from '../../../model/quests/noticeBoards';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { ASK_GRID, BOARD_GRID, MARK_GRID, MARK_PALETTE, QUEST_VOXEL_SIZE, buildQuestMark, buildTurnInMark } from './questVoxels';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { boardNumber } from '../../../model/quests/quests';

const NEAR = 30; // tiles: boards further off aren't looked at
const BOARD_MARK_SCALE = 0.75; // small, over the board's roof
const ABOVE_BOARD = BOARD_GRID[1] * QUEST_VOXEL_SIZE + 0.12;

// A mark ("!" or "?") centered over where it's placed.
function markMesh(grid: VoxelGrid, size: [number, number, number]): THREE.Mesh {
  const origin = new THREE.Vector3((-size[0] * QUEST_VOXEL_SIZE) / 2, 0, (-size[2] * QUEST_VOXEL_SIZE) / 2);
  const geometry = greedyMesh(grid, MARK_PALETTE, QUEST_VOXEL_SIZE, origin);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, fog: false, transparent: true }));
  mesh.renderOrder = 10; // after the world (a transparent pass), so nothing draws over it: trees, roofs, the foe itself
  return mesh;
}

// The aura at a quest's marked foe's feet: a glowing square on the ground,
// its corners stepped in, a bright amber rim round a dimmer middle, added
// to what's under it so the ground shows through. `size` in voxels across.
const AURA_VOXEL = 0.04;
const auraShapes = new Map<number, THREE.BufferGeometry>(); // built once a size
export function questAura(size: number): THREE.Mesh {
  let geometry = auraShapes.get(size);
  if (!geometry) auraShapes.set(size, (geometry = auraGeometry(size)));
  const mesh = new THREE.Mesh(geometry, AURA_MATERIAL);
  mesh.scale.y = 0.25; // a thin film on the ground
  mesh.renderOrder = 5;
  return mesh;
}

function auraGeometry(size: number): THREE.BufferGeometry {
  const grid = createGrid([size, 1, size]);
  const last = size - 1;
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const edge = Math.min(x, z, last - x, last - z);
      const corner = Math.min(x, last - x) + Math.min(z, last - z);
      if (corner < 2) continue; // stepped corners
      setColor(grid, x, 0, z, edge === 0 || corner === 2 ? 1 : 2);
    }
  }
  const half = (size * AURA_VOXEL) / 2;
  return greedyMesh(grid, [0xffb028, 0x6a4008], AURA_VOXEL, new THREE.Vector3(-half, 0, -half));
}
const AURA_MATERIAL = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// The auras breathe together, slowly.
export function pulseAuras(time: number): void {
  AURA_MATERIAL.opacity = 0.55 + 0.35 * Math.sin(time * 2.4);
}

// The "!" over a board with work to take (an inn's notice board's too: meshes/inn/workMarks.ts).
export const offerMark = (): THREE.Mesh => markMesh(buildQuestMark(), MARK_GRID);

// A slow, smooth bob, a beat apart for each `phase`.
export const markBob = (time: number, phase: number) => Math.sin(time * 2.2 + phase) * QUEST_VOXEL_SIZE * 1.2;

// Over each notice board: a "?" when a quest taken from it is done (to hand
// in), else a "!" when it has a quest the hero could take; else nothing.
export class BoardMarks {
  private readonly marks: Array<{ offer: THREE.Mesh; turnIn: THREE.Mesh; y: number }> = [];

  private readonly offer = markMesh(buildQuestMark(), MARK_GRID);
  private readonly turnIn = markMesh(buildTurnInMark(), ASK_GRID);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly model: GameModel,
  ) {
    this.markNew();
  }

  // Marks for the boards not marked yet (all of them at first; a streamed world's, as its regions are made).
  private markNew(): void {
    const spots = noticeBoards(this.model);
    for (let i = this.marks.length; i < spots.length; i++) {
      const spot = spots[i];
      const y = this.model.villages[i].groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT + ABOVE_BOARD;
      const [a, b] = [this.offer.clone(), this.turnIn.clone()];
      for (const mark of [a, b]) {
        mark.scale.setScalar(BOARD_MARK_SCALE);
        mark.rotation.y = (spot.quarterTurns * Math.PI) / 2; // facing the square, as the board does
        mark.position.set(spot.x, y, spot.z);
        mark.visible = false;
        this.scene.add(mark);
      }
      this.marks.push({ offer: a, turnIn: b, y });
    }
  }

  update(heroX: number, heroZ: number, time: number): void {
    const { quests } = this.model;
    const spots = noticeBoards(this.model);
    if (spots.length > this.marks.length) this.markNew();
    for (const [i, { offer, turnIn, y }] of this.marks.entries()) {
      const near = Math.abs(spots[i].x - heroX) <= NEAR && Math.abs(spots[i].z - heroZ) <= NEAR;
      const board = boardNumber(this.model, i);
      const ready = near && quests.readyAt(board);
      turnIn.visible = ready;
      offer.visible = near && !ready && quests.available(board);
      offer.position.y = turnIn.position.y = y + markBob(time, i);
    }
  }
}
