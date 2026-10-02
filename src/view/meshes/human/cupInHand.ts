// The cup in a humanoid's right hand (humanRig.ts): carried out before them
// (the barmaid bringing a drink, or clearing one away), or drunk from at the
// bar, sip after sip (a tankard, a glass of wine; or a pie, eaten bite by
// bite), the arm up to the lips and down to rest on the bar, until it's gone;
// or whatever food or drink the hero has out of their bag, sat on the ground.

import * as THREE from 'three';
import type { Drink } from '../../../model/npcs/npcs';
import type { ProvisionId } from '../../../model/loot/provisions';

// What's in hand: a drink asked for at the bar, or any food or drink from the bag.
export type InHand = Drink | ProvisionId;
import { greedyMesh } from '../voxel/greedyMesh';
import { PROVISION_MODELS, WINE_GLASS_MODEL } from '../loot/provisionVoxels';
import { HUMAN_VOXEL_SIZE } from './bodyVoxels';

const V = HUMAN_VOXEL_SIZE;
const SIPS_EVERY = 2.5; // seconds from one sip to the next
const DRINK_ARM = -2.3; // the right arm's swing, the tankard at the mouth (tipping further as it empties)
const TIP_MORE = 0.5; // how much further, the last sip
const REST_ARM = -0.9; // between sips: the tankard resting on the bar before them
const HOLD_ARM = -0.7; // the right arm's swing, carrying a tankard out before them
const TANKARD_SCALE = 0.55; // the ale's loot model, drawn to fit a hand

export class CupInHand {
  private tankard: THREE.Mesh | null = null; // the cup in hand, while drinking or carrying one
  private cups: Partial<Record<InHand, THREE.BufferGeometry>> = {}; // its shapes, made as needed
  private drinkFor = 0; // seconds of drinking left
  private drinkTotal = 1; // and in all
  private holding = false; // carrying it (not drinking)

  // `arm`: the joint it's held on, at `hand`; `mesh`: a mesh drawn as the rig's are.
  constructor(
    private readonly arm: THREE.Group,
    private readonly hand: THREE.Vector3,
    private readonly mesh: (geometry: THREE.BufferGeometry) => THREE.Mesh,
  ) {}

  // Carries a cup (the barmaid bringing a drink, or clearing it away), held
  // out a little: `cup` a tankard ('ale'), a glass ('wine') or a pie ('pie'); false, puts it away.
  hold(cup: false | InHand): void {
    if (!!cup === this.holding && (!cup || this.showing === cup)) return;
    this.holding = !!cup;
    if (cup) this.showTankard(cup);
    else if (this.tankard && this.drinkFor <= 0) this.tankard.visible = false;
  }

  // Drinks a tankard over `seconds` (an ale at the bar): sip after sip; or eats `what` (a pie), bite after bite.
  drink(seconds: number, what: InHand = 'ale'): void {
    this.showTankard(what);
    this.drinkFor = this.drinkTotal = seconds;
  }

  // Drinking as the model says (a villager at the bar): sipping while
  // `drinking` lasts, the tankard put away once it doesn't.
  sipping(drinking: { left: number; seconds: number; drink?: InHand } | null): void {
    if (!drinking) {
      if (this.drinkFor > 0) this.stopDrinking();
      return;
    }
    this.showTankard(drinking.drink ?? 'ale');
    [this.drinkFor, this.drinkTotal] = [drinking.left, drinking.seconds];
  }

  // Puts the tankard down, not finished (the hero got up).
  stopDrinking(): void {
    this.drinkFor = 0;
    if (this.tankard && !this.holding) this.tankard.visible = false;
  }

  private showing: InHand = 'ale'; // the cup in hand
  private showTankard(drink: InHand = 'ale'): void {
    if (!this.cups[drink]) {
      const model = drink === 'wine' ? WINE_GLASS_MODEL : drink === 'pie' ? PROVISION_MODELS.meatPie : PROVISION_MODELS[drink]; // (wine in a glass)
      const grid = model.build();
      const size = V * TANKARD_SCALE;
      this.cups[drink] = greedyMesh(grid, model.palette, size, new THREE.Vector3((-grid.size[0] * size) / 2, -size * 2, (-grid.size[2] * size) / 2));
    }
    if (!this.tankard) {
      this.tankard = this.mesh(this.cups[drink]!); // follows the rig's material
      this.tankard.position.copy(this.hand);
      this.arm.add(this.tankard);
    }
    this.tankard.geometry = this.cups[drink]!;
    this.showing = drink;
    this.tankard.visible = true;
  }

  // While drinking, sip after sip: the tankard up to the lips (tipping
  // further as it empties, a little bob as they drink), then down to rest
  // on the bar a moment; gone once it's empty.
  update(dt: number): void {
    if (!this.tankard) return;
    if (this.holding) {
      this.arm.rotation.x = HOLD_ARM; // held out before them
      return;
    }
    this.drinkFor -= dt;
    this.tankard.visible = this.drinkFor > 0;
    if (this.drinkFor <= 0) return;
    const t = this.drinkTotal - this.drinkFor;
    const emptied = t / this.drinkTotal;
    const phase = (t % SIPS_EVERY) / SIPS_EVERY; // up (to 0.15), sipping (to 0.55), down (to 0.7), resting
    const ease = (a: number) => a * a * (3 - 2 * a);
    const up = phase < 0.15 ? ease(phase / 0.15) : phase < 0.55 ? 1 : phase < 0.7 ? 1 - ease((phase - 0.55) / 0.15) : 0;
    const sipping = DRINK_ARM - TIP_MORE * emptied + (phase >= 0.15 && phase < 0.55 ? Math.sin(t * 9) * 0.06 : 0);
    const arm = REST_ARM + (sipping - REST_ARM) * up;
    const start = Math.min(1, t / 0.3); // from wherever the arm was, at first
    this.arm.rotation.x = this.arm.rotation.x * (1 - start) + arm * start;
  }
}
