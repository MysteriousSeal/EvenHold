// What a transformation is, to be played (transformCinema.ts): what someone's turned into, by name (the model's:
// spells/chickens.ts and whatever comes after), with its own staging: how the one turned changes, part by part, as
// it goes (`stage`: `u` from 0, themselves, to 1, about to give way), what they've become (`target`, and how it
// settles once it's there), and a line for each beat of it. One a kind of thing turned into: a spell to come that
// turns people into something else adds its own here, and is played the same.
import type * as THREE from 'three';
import type { Actor } from './actor';
import { chickenStaging } from './chickenStaging';

export interface Staging {
  title: string; // the spell's, over it all
  lines: ReadonlyArray<[from: number, line: string]>; // what's said under it, from each point on (`{name}`: whoever's turned)
  becomes: string; // what they are, once turned ("A chicken")
  prepare(actor: Actor): unknown; // what's grown on them, made ready (given back to `stage` each frame)
  stage(actor: Actor, made: unknown, u: number, time: number): void;
  target(): { root: THREE.Object3D; height: number; settle(j: number, time: number): void }; // `j`: 0 just there, 1 settled
  feathers?: [from: number, to: number]; // when feathers fly off them, if any do
}

export type Into = 'chicken';
export const STAGINGS: Record<Into, Staging> = { chicken: chickenStaging };
