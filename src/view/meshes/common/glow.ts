// A glow: light added over what's under it, never darkening it, see-through,
// never hiding what's behind (a ring on the floor, a beam, a mote of frost):
// how every glowing mark is drawn (loot's rings and beams, a crypt foe's
// told moves, frost on the hero).

import * as THREE from 'three';

export function glowMaterial(color = 0xffffff, more: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...more });
}
