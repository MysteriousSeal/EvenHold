// The camera kicked by a blow landing (controller/hitFeel.ts says how hard): thrown a few pixels the way the blow went,
// then back, a quick rebound or two dying away in a quarter of a second. One way, never a jitter (the floor's rumble
// is the jitter: GameView), so it's felt and never swims. A harder kick meanwhile takes over; a softer one's lost in it.
import * as THREE from 'three';

const DIES = 0.06; // seconds for it to fall to a third (e-fold)
const BOUNCE = 13; // rebounds a second
const DONE = 0.25; // seconds, and it's over

export class CameraKick {
  private readonly way = new THREE.Vector3();
  private amount = 0;
  private t = DONE;

  // A kick of `amount` world units, the way (dx, dz) along the ground (none: straight down the screen).
  kick(amount: number, dx: number, dz: number): void {
    if (amount <= 0 || amount < Math.abs(this.now())) return;
    const len = Math.hypot(dx, dz);
    this.way.set(len > 1e-6 ? dx / len : 0, len > 1e-6 ? 0 : -1, len > 1e-6 ? dz / len : 0);
    [this.amount, this.t] = [amount, 0];
  }

  // How far it's thrown now (added to the camera's place), then on by `dt` (its first frame at its full: the frame
  // held still on a blow shows it).
  offset(dt: number, into: THREE.Vector3): THREE.Vector3 {
    into.copy(this.way).multiplyScalar(this.now());
    this.t += dt;
    return into;
  }

  private now(): number {
    return this.t >= DONE ? 0 : this.amount * Math.exp(-this.t / DIES) * Math.cos(this.t * BOUNCE * Math.PI * 2);
  }
}
