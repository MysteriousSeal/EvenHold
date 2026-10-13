// The beasts people have been turned into (model/spells/turned.ts: for good; a hen, a horse, a cow, a bull), each
// drawn where it is by its kind's own rig; and those turned to stone, stood where they were (statue.ts). Those where the hero is (the world, a room, a dungeon: drawn bigger
// indoors, as all are); one just turned comes into sight in a puff of smoke (a hen: and feathers).
import * as THREE from 'three';
import type { Being } from '../../../model/spells/beings';
import type { Beast, Hen } from '../../../model/spells/turned';
import type { SmokePuffs } from '../common/smokePuffs';
import { ChickenRig } from './chickenRig';
import { CowRig } from './cowRig';
import { HorseRig } from './horseRig';
import { StatueRig, beingOf } from './statue';

type Rig = ChickenRig | HorseRig | CowRig | StatueRig;
// Each kind's rig, made for one of them (`standIn`: someone drawn as they stood, for a statue of them).
const RIGS: Record<Beast, (material: THREE.Material, beast: Hen, standIn: (being: Being) => THREE.Object3D) => Rig> = {
  chicken: (material) => new ChickenRig(material),
  horse: (material) => new HorseRig(material),
  cow: (material, beast) => new CowRig(material, beast.coat),
  bull: (material, beast) => new CowRig(material, beast.coat, true),
  statue: (_material, beast, standIn) => new StatueRig(standIn(beingOf(beast.stone!))),
};

export class TurnedViews {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private readonly rigs = new Map<Hen, Rig>();

  constructor(private readonly standIn: (being: Being) => THREE.Object3D) {}

  // Each frame: the hens where the hero is, drawn in `parent` at `scale`; `smoke`: for one just turned, as she's first seen.
  update(hens: readonly Hen[], parent: THREE.Object3D, scale: number, dt: number, smoke: SmokePuffs): void {
    const seen = new Set(hens);
    for (const [hen, rig] of this.rigs) if (!seen.has(hen)) [rig.dispose(), this.rigs.delete(hen)];
    for (const hen of hens) {
      let rig = this.rigs.get(hen);
      const made = !rig;
      if (!rig) this.rigs.set(hen, (rig = RIGS[hen.kind](this.material, hen, this.standIn)));
      if (rig.root.parent !== parent) parent.add(rig.root);
      rig.root.scale.setScalar(scale);
      rig.update(hen, made ? 0 : dt);
      if (hen.fresh) {
        hen.fresh = false;
        smoke.puff(parent, hen.x, hen.y, hen.z, scale);
        if (hen.kind === 'chicken') smoke.feathers(parent, hen.x, hen.y, hen.z, scale, 12);
      }
    }
  }
}
