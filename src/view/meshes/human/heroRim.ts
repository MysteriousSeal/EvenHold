// The hero's own edge, outdoors, set by the hour (people's warm rim, humanParts.ts, under it), so they stand apart from
// whatever ground they're on: by day, under a high sun the land lit brighter than they are, their edges inked a little
// darker; in the low light (the first morning's mist, the golden hour, dusk), when the haze washes the land and a
// bare-skinned hero to the same ochre, a pale rim of light instead, and the hour's cast half taken out of the light
// they're lit by (their skin its own, not the land's ochre): lighter than the ground, and apart from it in hue; the
// moon's blue at night. On a white ground (lying snow, a winter's rime) inked the more, no rim of light there. The
// hero's alone: no one else in the world takes it.

import * as THREE from 'three';
import { sky, skyUniforms } from '../../render/sky';
import { EdgeLight } from '../common/edgeLight';

// Each light's rim: how strong (of the light added at the silhouette's very edge) and its colour.
export const HERO_RIM = {
  day: { strength: 0.04, color: 0xfff2dc, ink: 0.3 },
  low: { strength: 0.62, color: 0xfff4e8, own: 0.5 }, // (the haze's: dawn, the morning's mist, the golden hour, dusk)
  night: { strength: 0.42, color: 0x9ab4ff },
};
const WHITE_INK = 0.4; // how much more the edges darken on white ground, at most (no rim of light there)
const FALLOFF = 2.4; // (a little wider than people's: humanParts.ts' 2.6)

export interface HeroRimNow {
  strength: number;
  ink: number;
  own: number; // the share of the hour's colour cast taken out of their light (their own colours kept)
  color: THREE.Color;
}

// How the hero's rimmed under a sky (sky.ts' values, and the snow lying): `into` filled and returned.
export function heroRimAt(now: { golden: number; night: number; fog: number }, snow: number, frost: number, into: HeroRimNow = { strength: 0, ink: 0, own: 0, color: new THREE.Color() }): HeroRimNow {
  const low = Math.min(1, Math.max(now.golden * 1.6, now.fog * 2.5) * (1 - now.night));
  const { day, low: haze, night } = HERO_RIM;
  into.strength = day.strength + (haze.strength - day.strength) * low;
  into.color.setHex(day.color).lerp(new THREE.Color(haze.color), low);
  into.strength += (night.strength - into.strength) * now.night;
  into.color.lerp(new THREE.Color(night.color), now.night);
  into.own = haze.own * low;
  const white = Math.min(1, snow * 1.5 + frost * 3.4) * (1 - now.night);
  into.ink = day.ink * (1 - low) * (1 - now.night) + WHITE_INK * white;
  into.strength *= 1 - white;
  return into;
}

export class HeroRim {
  private readonly edge = new EdgeLight(FALLOFF);
  private readonly now: HeroRimNow = { strength: 0, ink: 0, own: 0, color: new THREE.Color() };

  // `material` (the hero's: people's, rimmed already) given the hero's edge too.
  dress<M extends THREE.MeshStandardMaterial>(material: M): M {
    return this.edge.dress(material);
  }

  // Each frame, from the sky (sky.ts); none indoors (rooms are lit their own).
  update(outdoors: boolean): void {
    heroRimAt(sky, skyUniforms.uSnow.value, skyUniforms.uFrost.value, this.now);
    this.edge.set(outdoors ? this.now.strength : 0, outdoors ? this.now.ink : 0, this.now.color, outdoors ? this.now.own : 0);
  }
}
