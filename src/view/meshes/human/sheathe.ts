// Weapons put away (in the inn: model/interiors/indoors.ts, armsSheathed): off
// the hands and onto the body, hung from the torso's joint. A blade, an axe,
// a club at the left hip, hanging point down and a little back; the long
// ones (a battle axe, a war hammer, a spear, a staff) slung across the back,
// head up over the right shoulder; a shield on the back, its face out; a
// parrying dagger at the right hip. What's not a weapon (a torch, a book)
// stays in hand.

import * as THREE from 'three';
import type { ItemId } from '../../../model/human/equipment';
import type { MAIN_HAND_ITEMS, OFF_HAND_ITEMS } from '../../../model/human/items/held';
import { BODIES, HUMAN_VOXEL_SIZE } from './bodyVoxels';
import type { Build } from '../../../model/human/humanoid';

type Stow = 'leftHip' | 'rightHip' | 'back' | 'shield';
// Every held thing's place put away ('hand': not a weapon, kept in hand). Every one named: one added must be given its place.
export const STOWED: Record<keyof typeof MAIN_HAND_ITEMS | keyof typeof OFF_HAND_ITEMS, Stow | 'hand'> = {
  armingSword: 'leftHip',
  shortSword: 'leftHip',
  woodenSword: 'leftHip',
  dagger: 'leftHip',
  hatchet: 'leftHip',
  fellingAxe: 'back',
  broadAxe: 'back',
  club: 'leftHip',
  mace: 'leftHip',
  bandedCudgel: 'leftHip',
  battleAxe: 'back',
  warHammer: 'back',
  spear: 'back',
  quarterstaff: 'back',
  plankShield: 'shield',
  buckler: 'shield',
  heaterShield: 'shield',
  towerShield: 'shield',
  pavise: 'shield',
  crestShield: 'shield',
  bronzeTarge: 'shield',
  parryingDagger: 'rightHip',
  torch: 'hand',
  tome: 'hand',
};

const V = HUMAN_VOXEL_SIZE;
const CLEAR = 1; // voxels clear of the body (what's worn over it)
const BELT = 3; // voxels over the hips, where what's at the hip hangs from
const GROUND = 6; // voxels under the hips, as low as it may hang (the legs, 7, less a voxel off the floor)
const turn = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'ZYX'));

// Where `item` (meshed round its grip, lying along +Z) goes put away on a body of `build`, on its torso's joint, as
// they're `posed`: its place and turn; or null (kept in hand). Sat, what's at the hip swung back behind them (clear of
// the seat, and the thighs); lying, all of it laid at the left side, along the body (not under them, nor down
// into the bed).
export function stowedAt(item: ItemId, geometry: THREE.BufferGeometry, build: Build, posed: 'stand' | 'sit' | 'lie' = 'stand'): { position: THREE.Vector3; quaternion: THREE.Quaternion } | null {
  const stowed = STOWED[item as keyof typeof STOWED];
  if (!stowed || stowed === 'hand') return null;
  const how: Stow = posed === 'lie' && (stowed === 'back' || stowed === 'shield') ? 'leftHip' : stowed;
  const sat = posed === 'sit' && (how === 'leftHip' || how === 'rightHip');
  const [w, h, d] = BODIES[build].grid.torso;
  geometry.computeBoundingBox();
  const turned = (q: THREE.Quaternion) => geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  // At the hip stood: point down, swept back as far as it must be to clear the ground (a long blade further).
  const hanging = () => {
    for (let back = 0.3; ; back += 0.1) {
      const q = turn(Math.PI / 2 + back, 0, 0);
      const b = turned(q);
      if (BELT * V - (b.max.y - b.min.y) >= -GROUND * V || back >= 1.4) return q;
    }
  };
  const quaternion =
    how === 'back' ? turn(-Math.PI / 2, 0, -0.6) // (up, leaning over the right shoulder)
    : how === 'shield' ? turn(0, Math.PI, 0) // (its face out behind)
    : sat ? turn(Math.PI - 0.12, 0, 0) // (point back, just down)
    : posed === 'lie' ? turn(Math.PI / 2, 0, 0) // (along the body, toward the feet: angled back, it'd be down into the bed)
    : hanging();
  const box = turned(quaternion);
  const centre = box.getCenter(new THREE.Vector3());
  const side = (w / 2 + CLEAR) * V;
  const back = -(d / 2 + CLEAR) * V;
  const position =
    how === 'leftHip' ? new THREE.Vector3(side - box.min.x, BELT * V - box.max.y, sat ? (d / 2) * V - box.max.z : -centre.z) // (sat: its hilt at the hip's front, the rest behind; lying, level with the body's middle)
    : how === 'rightHip' ? new THREE.Vector3(-side - box.max.x, BELT * V - box.max.y, sat ? (d / 2) * V - box.max.z : -centre.z)
    : new THREE.Vector3(-centre.x, Math.max((h / 2) * V - centre.y, -GROUND * V - box.min.y), back - box.max.z); // (against the back; a long one lifted, its foot clear of the ground)
  return { position, quaternion };
}
