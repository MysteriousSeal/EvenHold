// The rooms off the hallway upstairs (model/interiors/upstairs.ts: roomsOff):
// their floors and walls in plain view, but what's in them (the beds, the
// nightstands and their candles' light, a wardrobe, a tub, a picture on its wall) unseen while their doors
// are shut (unless the hero's in there). Each room's furniture meshed apart from the rest of the floor,
// faded in as a door into it opens, and out again as it shuts. Over the
// door of the room let to the hero, a gold arrow pointing down, bobbing (LetMark).

import * as THREE from 'three';
import type { Furniture } from '../../model/interiors/furniture';
import type { Room } from '../../model/interiors/interiors';
import { roomsOff } from '../../model/interiors/upstairs';
import { letDoor } from '../../model/inn/roomLetting';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { VoxelModel } from '../ui/voxelIcon';

const FADE = 0.5; // seconds to fade in (or out)
const MARK_HEIGHT = 1.3; // the let room's arrow (its point), over its door
const MARK_VOXEL = 0.022;
const CAMERA_YAW = Math.PI / 4; // the fixed camera looks along -X-Z
const ON_THE_WALLS: ReadonlySet<string> = new Set(['hallWall', 'hallDoor', 'wallLantern']); // (the room's own: always seen)

// Which of the floor's furniture is in one of its rooms (to be meshed apart: RoomContents).
export function inRooms(furniture: readonly Furniture[], room: Room): Array<{ pieces: Furniture[]; doors: Furniture[]; tiles: Set<string> }> {
  return roomsOff(furniture, room).map(({ tiles, doors }) => {
    const mine = new Set(tiles.map(([x, z]) => `${x},${z}`));
    const pieces = furniture.filter((f) => !ON_THE_WALLS.has(f.kind) && mine.has(`${f.x},${f.z}`));
    return { pieces, doors, tiles: mine };
  });
}

// The mark over the door of the room let to the hero (model/inn/roomLetting.ts), standing up to face the camera:
// an arrow pointing down at it, its shaft and its head; gold, lit along its left, dark down its right.
const MARK_PALETTE = [0xffd35a, 0xfff0a8, 0xa0721e];
function downArrow(): VoxelModel {
  const grid = createGrid([13, 17, 3]);
  const [GOLD, LIGHT, DARK] = [1, 2, 3];
  fillBox(grid, 4, 7, 0, 8, 16, 2, GOLD); // the shaft
  fillBox(grid, 4, 7, 2, 4, 16, 2, LIGHT);
  fillBox(grid, 8, 7, 0, 8, 16, 0, DARK);
  fillBox(grid, 4, 16, 0, 8, 16, 2, LIGHT); // its top, catching the light
  for (let y = 0; y < 7; y++) {
    const [x0, x1] = [6 - y, 6 + y]; // the head, widening up from its point
    fillBox(grid, x0, y, 0, x1, y, 2, GOLD);
    fillBox(grid, x0, y, 2, x0, y, 2, LIGHT);
    fillBox(grid, x1, y, 0, x1, y, 0, DARK);
  }
  fillBox(grid, 0, 6, 0, 3, 6, 2, LIGHT); // the head's shoulders, lit
  fillBox(grid, 9, 6, 0, 12, 6, 2, LIGHT);
  return { grid, palette: MARK_PALETTE };
}

// An arrow floating, bobbing, over the let room's door while it's the hero's (unlocked); none else. Voxels of its own,
// centred on the door's opening, turned to face the camera, over the walls.
export class LetMark {
  private readonly mesh: THREE.Mesh | null = null;
  private readonly door: Furniture | null;

  constructor(scene: THREE.Scene, furniture: readonly Furniture[]) {
    this.door = letDoor(furniture);
    if (!this.door) return;
    const { grid, palette } = downArrow();
    const [sx, , sz] = grid.size;
    const geometry = greedyMesh(grid, palette, MARK_VOXEL, new THREE.Vector3((-sx / 2) * MARK_VOXEL, 0, (-sz / 2) * MARK_VOXEL));
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.renderOrder = 10;
    this.mesh.rotation.y = CAMERA_YAW; // (its face to the camera)
    const d = this.door;
    this.mesh.position.set(d.wall === 'left' ? d.x - 0.4 : d.x - 0.5 + d.w / 2, MARK_HEIGHT, d.wall === 'left' ? d.z - 0.5 + d.d / 2 : d.z - 0.4);
    scene.add(this.mesh);
  }

  update(time: number): void {
    if (!this.mesh || !this.door) return;
    this.mesh.visible = this.door.locked === false;
    this.mesh.position.y = MARK_HEIGHT + Math.abs(Math.sin(time * 2.6)) * 0.09; // (bouncing, pointing down at it)
  }

  dispose(): void {
    if (!this.mesh) return;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class RoomContents {
  private readonly rooms: Array<{ mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; pieces: Furniture[]; doors: Furniture[]; tiles: Set<string>; seen: number }> = [];

  // `mesh`: the given pieces meshed (as the floor's are); `material`: theirs, each room's its own copy (to fade).
  constructor(scene: THREE.Scene, rooms: ReturnType<typeof inRooms>, mesh: (pieces: Furniture[]) => THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
    for (const { pieces, doors, tiles } of rooms) {
      if (pieces.length === 0) continue;
      const own = material.clone();
      const m = new THREE.Mesh(mesh(pieces), own);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const room = { mesh: m, material: own, pieces, doors, tiles, seen: doors.some((d) => d.open) ? 1 : 0 };
      this.rooms.push(room);
      this.show(room);
    }
  }

  // How much of a piece shows (0..1): one in a room, as much as its room; else all of it (a candle's light, by it).
  seenOf(piece: Furniture): number {
    return this.rooms.find((r) => r.pieces.includes(piece))?.seen ?? 1;
  }

  // `hero`: where they are (in a room, its door shut behind them: it's seen all the same).
  update(dt: number, hero: { x: number; z: number }): void {
    const at = `${Math.round(hero.x)},${Math.round(hero.z)}`;
    for (const r of this.rooms) {
      const want = r.doors.some((d) => d.open) || r.tiles.has(at) ? 1 : 0;
      if (r.seen === want) continue;
      r.seen = want > r.seen ? Math.min(want, r.seen + dt / FADE) : Math.max(want, r.seen - dt / FADE);
      this.show(r);
    }
  }

  private show(r: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; seen: number }): void {
    r.mesh.visible = r.seen > 0;
    r.mesh.castShadow = r.seen === 1;
    r.material.transparent = r.seen < 1;
    r.material.depthWrite = r.seen === 1;
    r.material.opacity = r.seen;
    r.material.needsUpdate = true;
  }

  dispose(): void {
    for (const r of this.rooms) {
      r.mesh.removeFromParent();
      r.mesh.geometry.dispose();
      r.material.dispose();
    }
  }
}
