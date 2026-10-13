// A stronghold's foes' moves in its scene (model/strongholds/strongholdMoves.ts:
// what its stage has to show, whoever's they are), drawn as the other
// dungeons' are (glowing marks on the floor, light added over the flagstones:
// meshes/common/glowMarks.ts):
// - what's told before it lands (`marks`): a ring round a spot (a smash, a
//   sweep, a pot's circle, a keg's fuse, a brazier going over), its rim
//   pulsing faster and its middle filling as it comes; a strip down a way (a
//   lash, a cleaver, a lunge, a hook's chain, a crossbow's line: thin),
//   brightening; each in its tone's colour (a blow red, fire orange, a shot's
//   line pale, a hook's steel);
// - what's just burst (`bursts`): a ring flashing out and gone;
// - ground burning (`fires`): a patch of embers, flickering, fading as it
//   dies down;
// - what's in flight (`shots`): a bolt (a bowman's arrow, shortened), flying
//   level, pointing its way; a fire pot, a clay ball with its wick alight,
//   tumbling up its arc and down.
// StrongholdLife (strongholdView.ts) makes one, updates it each frame with
// its run's moves, and disposes of it.

import * as THREE from 'three';
import { INDOOR_SCALE } from '../../model/constants';
import type { StrongholdMark, StrongholdMoves } from '../../model/strongholds/strongholdMoves';
import { glowMaterial } from '../meshes/common/glow';
import { GlowMarks } from '../meshes/common/glowMarks';
import { arrowGeometry } from '../meshes/enemy/undeadRig';
import { personMaterial } from '../meshes/human/humanParts';

const TONES: Record<StrongholdMark['tone'], number> = { blow: 0xff3a20, fire: 0xff8a30, shot: 0xffe6b0, hook: 0xb8c4d8 };
const FLOOR = 0.014; // just over the flagstones
const BOLT_HEIGHT = 0.3 * INDOOR_SCALE; // about a crossbowman's chest
const POT_HEIGHT = [0.3 * INDOOR_SCALE, 1.3] as const; // from the hand, and how much higher at the top of its arc
const BURST = 0.45; // seconds a burst flashes (the stage keeps it that long)
const EMBERS = 0xff6a1c;

export class StrongholdMovesView {
  private readonly ring = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
  private readonly disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private readonly strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0); // (along +X from its foot)
  private readonly marks: GlowMarks;
  private readonly bolt = arrowGeometry();
  private readonly boltMaterial = personMaterial();
  private readonly pot = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private readonly potMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.9, emissive: 0xff7a20, emissiveIntensity: 0.6 });
  private readonly wick = new THREE.BoxGeometry(0.07, 0.07, 0.07).translate(0, 0.11, 0);
  private readonly wickMaterial = glowMaterial(0xffc060);
  private readonly flying: Array<{ bolt: THREE.Mesh; pot: THREE.Group }> = []; // a pool, as many shown as fly
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.marks = new GlowMarks(scene);
  }

  update(moves: StrongholdMoves | null, dt: number): void {
    this.time += dt;
    this.marks.begin();
    const mark = (geometry: THREE.BufferGeometry, color: number, opacity: number, x: number, z: number, y = FLOOR) => this.marks.mark(geometry, color, Math.max(0, Math.min(1, opacity)), x, y, z);
    // Burning ground under everything else: embers, flickering, each patch its own; dying down in its last second.
    for (const fire of moves?.fires ?? []) {
      const flick = 0.75 + 0.25 * Math.sin(this.time * 11 + fire.x * 3.1 + fire.z * 1.7);
      const live = Math.min(1, fire.left);
      mark(this.disc, EMBERS, 0.3 * flick * live, fire.x, fire.z, FLOOR - 0.004).scale.setScalar(fire.r);
      mark(this.disc, 0xffb040, 0.22 * (1.5 - flick) * live, fire.x, fire.z, FLOOR - 0.002).scale.setScalar(fire.r * 0.6);
      mark(this.ring, EMBERS, 0.5 * live, fire.x, fire.z).scale.setScalar(fire.r);
    }
    for (const m of moves?.marks ?? []) {
      const color = TONES[m.tone];
      if (m.shape === 'ring') {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * (8 + 16 * m.k)); // (faster as it comes)
        mark(this.ring, color, (0.3 + 0.6 * m.k) * pulse, m.x, m.z).scale.setScalar(m.r);
        mark(this.disc, color, 0.06 + 0.26 * m.k, m.x, m.z).scale.setScalar(m.r * (0.35 + 0.65 * m.k)); // (filling to its rim)
      } else {
        const strip = mark(this.strip, color, m.tone === 'shot' ? 0.25 + 0.6 * m.k : 0.1 + 0.45 * m.k, m.x, m.z);
        strip.rotation.y = Math.atan2(-m.dz, m.dx);
        strip.scale.set(Math.max(0.01, m.long), 1, m.half * 2);
      }
    }
    for (const b of moves?.bursts ?? []) {
      const p = Math.min(1, b.age / BURST);
      mark(this.ring, 0xffd890, 1 - p, b.x, b.z, FLOOR + 0.004).scale.setScalar(b.r * (0.7 + 0.5 * p));
      mark(this.disc, 0xffa040, 0.5 * (1 - p) ** 2, b.x, b.z, FLOOR + 0.002).scale.setScalar(b.r);
    }
    this.marks.end();
    // What's in flight.
    const shots = moves?.shots ?? [];
    while (this.flying.length < shots.length) {
      const bolt = new THREE.Mesh(this.bolt, this.boltMaterial);
      bolt.scale.set(INDOOR_SCALE, INDOOR_SCALE, INDOOR_SCALE * 0.7); // (a bolt: shorter than an arrow)
      const pot = new THREE.Group();
      pot.add(new THREE.Mesh(this.pot, this.potMaterial), new THREE.Mesh(this.wick, this.wickMaterial));
      this.scene.add(bolt, pot);
      this.flying.push({ bolt, pot });
    }
    this.flying.forEach(({ bolt, pot }, i) => {
      const shot = shots[i];
      bolt.visible = !!shot && shot.kind !== 'pot';
      pot.visible = !!shot && shot.kind === 'pot';
      if (!shot) return;
      if (shot.kind === 'pot') {
        pot.position.set(shot.x, POT_HEIGHT[0] * (1 - shot.flown) + POT_HEIGHT[1] * (shot.high ?? 0), shot.z);
        pot.rotation.set(shot.flown * 9, shot.flown * 6, 0); // (tumbling)
      } else {
        bolt.position.set(shot.x, BOLT_HEIGHT, shot.z);
        bolt.rotation.set(0, Math.atan2(shot.dx, shot.dz), 0); // (pointing the way it flies)
      }
    });
  }

  dispose(): void {
    this.marks.dispose();
    for (const { bolt, pot } of this.flying) [bolt.removeFromParent(), pot.removeFromParent()];
    for (const made of [this.ring, this.disc, this.strip, this.bolt, this.pot, this.wick, this.boltMaterial, this.potMaterial, this.wickMaterial]) made.dispose();
  }
}
