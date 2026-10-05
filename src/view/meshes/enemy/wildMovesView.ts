// The wild beasts' told moves shown on the ground before they land
// (model/enemies/wildMoves.ts), glowing (light added over the grass): a bear's
// slam a ring round it, brightening and pulsing faster as it comes; its charge
// a strip down its way; a lynx's pounce a short streak to where it'll land.

import * as THREE from 'three';
import type { WildMoves } from '../../../model/enemies/wildMoves';
import { CHARGE_HALF, CHARGE_TELL, POUNCE_TELL, SLAM_RADIUS, SLAM_TELL } from '../../../model/enemies/wildMoves';
import { glowMaterial } from '../common/glow';

const CHARGE_LONG = 4.5;

export class WildMovesView {
  private readonly ring = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
  private readonly strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0); // (along +X from its foot)
  private readonly marks: THREE.Mesh[] = [];
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {}

  update(moves: WildMoves, groundY: (x: number, z: number) => number, dt: number, outdoors: boolean): void {
    this.time += dt;
    let used = 0;
    const mark = (geometry: THREE.BufferGeometry, color: number, opacity: number, x: number, z: number) => {
      let m = this.marks[used];
      if (!m) {
        m = new THREE.Mesh(geometry, glowMaterial(color));
        this.scene.add(m);
        this.marks.push(m);
      }
      m.geometry = geometry;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = opacity;
      m.position.set(x, groundY(x, z) + 0.02, z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.visible = outdoors;
      used++;
      return m;
    };
    if (outdoors) {
      for (const m of moves.slams.moves) {
        if (m.t > SLAM_TELL) continue;
        const k = m.t / SLAM_TELL;
        const pulse = 0.6 + 0.4 * Math.sin(this.time * (8 + 14 * k));
        mark(this.ring, 0xff6a30, (0.2 + 0.6 * k) * pulse, m.x, m.z).scale.setScalar(SLAM_RADIUS);
      }
      for (const m of moves.charges.moves) {
        if (m.t > CHARGE_TELL) continue;
        const strip = mark(this.strip, 0xff3a20, 0.12 + 0.45 * (m.t / CHARGE_TELL), m.x, m.z);
        strip.rotation.y = Math.atan2(-m.dz, m.dx);
        strip.scale.set(CHARGE_LONG, 1, CHARGE_HALF * 2);
      }
      for (const m of moves.pounces.moves) {
        if (m.t > POUNCE_TELL) continue;
        const strip = mark(this.strip, 0xffa040, 0.1 + 0.4 * (m.t / POUNCE_TELL), m.x, m.z);
        strip.rotation.y = Math.atan2(-m.dz, m.dx);
        strip.scale.set(Math.min(4.2, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), 1, 0.5);
      }
    }
    for (let i = used; i < this.marks.length; i++) this.marks[i].visible = false;
  }
}
