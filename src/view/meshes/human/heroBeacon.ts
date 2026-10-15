// Where the hero is, as a game begins: the gold brackets (as round a focused foe) at their feet, opening and closing
// a few times over the first seconds, then gone, so the eye finds them before the carter's wagon and its "!".

import type * as THREE from 'three';
import { focusMarker } from '../enemy/enemyViews';

const SHOWN = 6; // seconds
const PULSES = 4; // over them
const WIDEST = 2.2; // of the brackets' own size

export class HeroBeacon {
  private readonly mark = focusMarker();

  // `elapsed`: seconds since the game began; `home`: the scene the hero's in, `at` their feet, `size` theirs (a room's).
  update(elapsed: number, home: THREE.Object3D, at: { x: number; y: number; z: number }, size = 1): void {
    const on = elapsed < SHOWN;
    this.mark.visible = on;
    if (!on) return void this.mark.removeFromParent();
    if (this.mark.parent !== home) home.add(this.mark);
    const t = (elapsed / SHOWN) * PULSES;
    this.mark.scale.setScalar(size * (1.3 + (WIDEST - 1.3) * Math.abs(Math.sin(t * Math.PI)))); // (from round them, out, and back)
    this.mark.position.set(at.x, at.y + 0.014, at.z);
  }
}
