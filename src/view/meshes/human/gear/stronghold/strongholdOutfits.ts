// Who wears what in a bandit stronghold, by kind (the foes' kinds, said here as the model says them): each one's
// looks slot by slot (strongholdLooks.ts, strongholdBossLooks.ts), what's in each hand (strongholdHeld.ts), what
// hangs off them (strongholdHung.ts), and the colour they're told by; and a body dressed in all of it at once
// (dressStronghold: a HumanRig's own `dress` for the looks, then what's held and hung put on its joints, drawn in
// its material and counted among its meshes, so a hit's flash and a death's hiding reach them too).
import * as THREE from 'three';
import type { ArmorSlot, HeldSlot } from '../../../../../model/human/equipment';
import { greedyMesh } from '../../../voxel/greedyMesh';
import { BODIES, HELD_BY, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../../bodyVoxels';
import type { HumanRig } from '../../humanRig';
import type { CostumeLookId } from '../costumes';
import { STRONGHOLD_BOSS_LOOKS } from './strongholdBossLooks';
import { STRONGHOLD_HELD, type StrongholdHeldId } from './strongholdHeld';
import { STRONGHOLD_HUNG, hungAt, type StrongholdHungId } from './strongholdHung';
import { STRONGHOLD_TRASH_LOOKS, type StrongholdLook } from './strongholdLooks';

export const STRONGHOLD_KINDS = ['bruiser', 'crossbowman', 'firebrand', 'sawbones', 'runner', 'houndmaster', 'quartermaster', 'gaoler', 'captain', 'banditKing'] as const;
export type StrongholdKind = (typeof STRONGHOLD_KINDS)[number];

// Every stronghold look, by id (itemModels.ts finds a look's model and slot here, after the jobs' costumes).
export const STRONGHOLD_LOOKS: Record<CostumeLookId, StrongholdLook> = { ...STRONGHOLD_TRASH_LOOKS, ...STRONGHOLD_BOSS_LOOKS };

export interface StrongholdOutfit {
  accent: number; // the colour they're told by
  looks: Partial<Record<ArmorSlot, CostumeLookId>>;
  held: Partial<Record<HeldSlot, StrongholdHeldId>>;
  hung: StrongholdHungId[];
}
const outfit = (kind: StrongholdKind, accent: number, slots: ArmorSlot[], held: StrongholdOutfit['held'], hung: StrongholdHungId[] = []): StrongholdOutfit => ({
  accent,
  looks: Object.fromEntries(slots.map((slot) => [slot, `costume:stronghold:${kind}:${slot}`])),
  held,
  hung,
});

export const STRONGHOLD_OUTFITS: Record<StrongholdKind, StrongholdOutfit> = {
  bruiser: outfit('bruiser', 0xc09a40, ['head', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'maul' }),
  crossbowman: outfit('crossbowman', 0x5a7a3c, ['head', 'torso', 'legs', 'feet'], { mainHand: 'crossbow' }, ['quiver']),
  firebrand: outfit('firebrand', 0xe06a1c, ['head', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'firePot' }, ['firePots']),
  sawbones: outfit('sawbones', 0xece2cc, ['head', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'boneSaw' }, ['satchel']),
  runner: outfit('runner', 0x3a94c8, ['head', 'torso', 'legs', 'feet'], { mainHand: 'dirk' }, ['signalHorn']),
  houndmaster: outfit('houndmaster', 0x9c2a22, ['head', 'shoulders', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'whip' }, ['collars']),
  quartermaster: outfit('quartermaster', 0x34496e, ['head', 'torso', 'legs', 'feet'], { mainHand: 'linstock' }, ['keys', 'powderHorn']),
  gaoler: outfit('gaoler', 0x221d20, ['head', 'torso', 'legs', 'feet'], { mainHand: 'cleaver', offHand: 'hook' }, ['keys']),
  captain: outfit('captain', 0xc8302a, ['head', 'shoulders', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'sabre' }),
  banditKing: outfit('banditKing', 0xe6b84a, ['head', 'shoulders', 'torso', 'hands', 'legs', 'feet'], { mainHand: 'greatAxe' }, ['pelt']),
};

// Meshed once each for the page, as every item's is.
const geometries = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => geometries.get(key) ?? geometries.set(key, make()).get(key)!;
const heldGeometry = (id: StrongholdHeldId): THREE.BufferGeometry => {
  const { palette, held } = STRONGHOLD_HELD[id];
  return cached(`held:${id}`, () => greedyMesh(held.build(), palette, HELD_VOXEL_SIZE, new THREE.Vector3(...held.grip.map((g) => -g * HELD_VOXEL_SIZE))));
};

// Dresses `rig` as one of the stronghold's kinds: its looks, what it holds (each named 'held', as what's to be put
// down before it's staged alone is) and what hangs off it. Returns what was added past the looks (to take off
// again: remove each from its parent and from the rig's meshes). Once per rig.
export function dressStronghold(rig: HumanRig, kind: StrongholdKind): THREE.Mesh[] {
  const { looks, held, hung } = STRONGHOLD_OUTFITS[kind];
  rig.dress(looks);
  const body = BODIES[rig.look.build];
  const [V, material] = [HUMAN_VOXEL_SIZE, rig.meshes[0].material];
  const added: THREE.Mesh[] = [];
  for (const [slot, id] of Object.entries(held) as Array<[HeldSlot, StrongholdHeldId]>) {
    const mesh = Object.assign(new THREE.Mesh(heldGeometry(id), material), { name: 'held' });
    mesh.position.set(body.hand[0] * V, body.hand[1] * V, body.hand[2] * V);
    rig.joints[HELD_BY[slot]].add(mesh);
    added.push(mesh);
  }
  for (const id of hung) {
    const thing = STRONGHOLD_HUNG[id];
    const mesh = new THREE.Mesh(cached(`hung:${id}`, () => greedyMesh(thing.build(), thing.palette, V, new THREE.Vector3())), material);
    mesh.position.fromArray(hungAt(thing, body)).multiplyScalar(V);
    rig.joints.torso.add(mesh);
    added.push(mesh);
  }
  rig.meshes.push(...added);
  return added;
}
