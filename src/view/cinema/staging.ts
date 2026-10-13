// What a transformation is, to be played (transformCinema.ts): what someone's turned into, by name (the model's:
// spells/turned.ts and whatever comes after), with its own staging: how the one turned changes, part by part, as
// it goes (`stage`: `u` from 0, themselves, to 1, about to give way), what they've become (`target`, and how it
// settles once it's there), and a line for each beat of it. One a kind of thing turned into: a spell to come that
// turns people into something else adds its own here, and is played the same.
import * as THREE from 'three';
import { setDown, type Actor } from './actor';
import type { Cloud } from './morph/voxelMorph';
import { SPELLS, SPELL_IDS } from '../../model/spells/spells';
import { INTO, type Into } from '../../model/spells/turned';
import type { Tree } from '../../model/types';
import { catStagingOf } from './stagings/catStaging';
import { chickenStaging } from './stagings/chickenStaging';
import { cowStagingOf } from './stagings/cowStaging';
import { dollStagingOf } from './stagings/dollStaging';
import { donkeyStagingOf } from './stagings/donkeyStaging';
import { ghostStagingOf } from './stagings/ghostStaging';
import { goatStagingOf } from './stagings/goatStaging';
import { horseStaging } from './stagings/horseStaging';
import { paintingStagingOf } from './stagings/paintingStaging';
import { pigStagingOf } from './stagings/pigStaging';
import { ratStagingOf } from './stagings/ratStaging';
import { sheepStagingOf } from './stagings/sheepStaging';
import { statueStagingOf } from './stagings/statueStaging';
import { toadStagingOf } from './stagings/toadStaging';
import { treeStagingOf } from './stagings/treeStaging';

export interface Staging {
  title: string; // the spell's, over it all
  lines: ReadonlyArray<[from: number, line: string]>; // what's said under it, from each point on (`{name}`: whoever's turned)
  becomes: string; // what they are, once turned ("A chicken")
  // For what has neither parts nor voxels to it (a ghost, seen through), if it's staged at all (else it only dwindles):
  // what's grown on it, made ready (given back to `stage` each frame), and how it changes.
  prepare?(actor: Actor): unknown;
  stage?(actor: Actor, made: unknown, u: number, time: number): void;
  target(): { root: THREE.Object3D; height: number; settle(j: number, time: number): void }; // `j`: 0 just there, 1 settled
  feathers?: [from: number, to: number]; // when feathers fly off them, if any do
  // A staging all its own, in place of the rest (a change that's no turning into a beast: swapStaging.ts): made for the
  // figure, in the scene; played each frame till it gives way (`u`: 0 themselves, 1 giving way), then let go.
  // `view`: where it's seen from, if it says (`j`: once they've given way, 0 just then to 1 settled): the height looked at, from how far, and from how far above (of that; none: the usual).
  // Null: not one for that (the rest, then). It may say how long it runs, what's said of it, when feathers fly off them.
  direct?(figure: THREE.Object3D, scene: THREE.Scene, tall: number, actor: Actor): Directed | null;
  length?: number; // seconds it runs, if not the usual (transformCinema.ts LENGTH)
  // For anything not human-shaped, taken apart into its voxels and put together again (voxelMorph.ts): the voxels of
  // what they become, as it stands; and what's said of it, beat by beat.
  cloud?(): Cloud;
  looseLines?: ReadonlyArray<[from: number, line: string]>;
}

export interface Directed {
  update(u: number, time: number): void;
  dispose(): void;
  view?(u: number, j: number): { aim: number; far: number; rise?: number; x?: number; z?: number }; // (`x`, `z`: where's looked at, if not the middle)
  length?: number;
  lines?: ReadonlyArray<[from: number, line: string]>;
  feathers?: [from: number, to: number];
}

// What plays for each thing someone's turned into, made for the one turned: in the coat they'll have (`coat`), as the
// tree they are now (`tree`), or of them as they stood (`stood`: drawn afresh, for what's in their likeness).
export interface Turning {
  coat?: number;
  tree?: Pick<Tree, 'kind' | 'shape'>;
  stood: () => THREE.Object3D;
}
const MAKERS: Record<Into, (how: Turning) => Staging> = {
  chicken: () => chickenStaging,
  horse: () => horseStaging,
  cow: ({ coat }) => cowStagingOf(coat),
  bull: ({ coat }) => cowStagingOf(coat, true),
  statue: ({ stood }) => statueStagingOf(stood),
  tree: ({ tree }) => treeStagingOf(tree?.kind, tree?.shape),
  pig: ({ coat }) => pigStagingOf(coat),
  sheep: ({ coat }) => sheepStagingOf(coat),
  goat: ({ coat }) => goatStagingOf(coat),
  donkey: ({ coat }) => donkeyStagingOf(coat),
  toad: ({ coat }) => toadStagingOf(coat),
  rat: ({ coat }) => ratStagingOf(coat),
  cat: ({ coat }) => catStagingOf(coat),
  ghost: ({ stood }) => ghostStagingOf(stood),
  painting: ({ stood }) => paintingStagingOf(stood),
  doll: ({ stood }) => dollStagingOf(stood),
};
// Its charm's name over it (model/spells/spells.ts: a bull's is the cow's).
const charmOf = (into: Into): string | undefined => ((id) => id && SPELLS[id].name)(SPELL_IDS.find((id) => SPELLS[id].turns === (into === 'bull' ? 'cow' : into)));
export const stagingFor = (into: Into, how: Turning): Staging => ((staging) => ({ ...staging, title: charmOf(into) ?? staging.title }))(MAKERS[into]({ ...how, stood: () => setDown(how.stood()) }));

// Each kind's, as it comes (its first coat, an oak, no one's likeness).
export const STAGINGS = Object.fromEntries(INTO.map((into) => [into, stagingFor(into, { stood: () => new THREE.Group() })])) as Record<Into, Staging>;
