// Foes seen in the dark (the world's, outdoors): at night a faint moonlit edge round every foe (a grey wolf on dark
// ground, a bandit in his browns, a draugr), brighter the darker it is (rain on the night), and a beast's eyes catching
// the light, a glint of eyeshine (beastRig.ts); none by day, none down in a dungeon (lit its own).

import * as THREE from 'three';
import { sky } from '../../render/sky';
import { glowMaterial } from '../common/glow';
import { EdgeLight } from '../common/edgeLight';

export const FOE_NIGHT = {
  edge: 0.32, // the moonlit edge's strength at full night (of the light added at the silhouette)
  rain: 0.12, // more, in the rain's dark
  color: 0xb4c8ff,
  glint: 0.85, // the eyeshine's at full night
  glintColor: 0xe6f2a0,
};

// How strong the foes' edge and their eyes' glint are, under a sky (sky.ts' values).
export function foeNightAt(now: { night: number; rain: number; light: number }): { edge: number; glint: number } {
  const dark = Math.max(now.night, 1 - now.light);
  return { edge: dark * (FOE_NIGHT.edge + FOE_NIGHT.rain * now.rain), glint: dark * FOE_NIGHT.glint };
}

// A beast's eyeshine: light added over its eyes (drawn just in front of them), unlit, unfogged.
export function glintMaterial(): THREE.MeshBasicMaterial {
  return glowMaterial(FOE_NIGHT.glintColor, { opacity: 0, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
}

export class FoeNight {
  private readonly edge = new EdgeLight(2.4);
  private readonly color = new THREE.Color(FOE_NIGHT.color);

  constructor(
    lit: THREE.MeshStandardMaterial[], // the foes' own (dressed with the edge)
    private readonly glints: THREE.MeshBasicMaterial[],
  ) {
    for (const material of lit) this.edge.dress(material);
  }

  // Each frame: `outdoors`, the world's foes (else none of it).
  update(outdoors: boolean): void {
    const { edge, glint } = outdoors ? foeNightAt(sky) : { edge: 0, glint: 0 };
    this.edge.set(edge, 0, this.color);
    for (const material of this.glints) [(material.opacity = glint), (material.visible = glint > 0.01)];
  }
}
