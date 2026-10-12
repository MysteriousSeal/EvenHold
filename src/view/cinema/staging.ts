// What a transformation is, to be played (transformCinema.ts): what someone's turned into, by name (the model's:
// spells/chickens.ts and whatever comes after), with its own staging: how the one turned changes, part by part, as
// it goes (`stage`: `u` from 0, themselves, to 1, about to give way), what they've become (`target`, and how it
// settles once it's there), and a line for each beat of it. One a kind of thing turned into: a spell to come that
// turns people into something else adds its own here, and is played the same.
import type * as THREE from 'three';
import type { Actor } from './actor';
import type { Piece } from './partMorph';
import type { Cloud } from './voxelMorph';
import type { Into } from '../../model/spells/chickens';
import { chickenStaging } from './chickenStaging';
import { horseStaging } from './horseStaging';

export interface Staging {
  title: string; // the spell's, over it all
  lines: ReadonlyArray<[from: number, line: string]>; // what's said under it, from each point on (`{name}`: whoever's turned)
  becomes: string; // what they are, once turned ("A chicken")
  // For what has neither parts nor voxels to it (a ghost, seen through), if it's staged at all (else it only dwindles):
  // what's grown on it, made ready (given back to `stage` each frame), and how it changes.
  prepare?(actor: Actor): unknown;
  stage?(actor: Actor, made: unknown, u: number, time: number): void;
  target(): { root: THREE.Object3D; height: number; settle(j: number, time: number): void }; // `j`: 0 just there, 1 settled
  beastLines?: ReadonlyArray<[from: number, line: string]>; // what's said of a four-legged beast's, where it differs
  feathers?: [from: number, to: number]; // when feathers fly off them, if any do
  // For anything not human-shaped, taken apart into its voxels and put together again (voxelMorph.ts): the voxels of
  // what they become, as it stands; and what's said of it, beat by beat.
  cloud?(): Cloud;
  // For what has parts (someone human-shaped, a four-legged beast), each part morphing into a part of what it turns
  // into (partMorph.ts): its parts and theirs, that built `big` times its own size, coming `down` to it from then on.
  // Null: not one for that.
  pieces?(actor: Actor): { pieces: Piece[]; big: number; down: number } | null;
  looseLines?: ReadonlyArray<[from: number, line: string]>;
}

export const STAGINGS: Record<Into, Staging> = { chicken: chickenStaging, horse: horseStaging };
