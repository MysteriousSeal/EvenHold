// One duck on the water, animated from its model state each frame:
// - it floats with its underside below the surface, bobbing and rocking
//   gently, turning smoothly toward where it paddles;
// - its head nods as it paddles, and it leaves a wake on the water: a
//   ripple at its breast, two lines of foam along its sides that stretch
//   out the faster it goes, and a ripple across its tail when it hurries.
//   The wake swells and fades smoothly (never blinks with each frame's
//   speed) and floats just clear of the water so it never flickers against it;
// - to feed (dabble), it tips headfirst until only its tail sticks up, then
//   rights itself.

import * as THREE from 'three';
import type { DuckVariant, Wildlife } from '../../../model/wildlife/wildlife';
import { DABBLE_TIME } from '../../../model/wildlife/ducks';
import { AnimalRig, partMesher } from './animalRig';
import { BODY_GRID, DUCK_VOXEL_SIZE, HEAD_GRID, SUBMERGED, buildDuckBody, buildDuckHead, duckPalette } from './duckVoxels';

const V = DUCK_VOXEL_SIZE;
const TURN_RATE = 8;
const TIP = 1.9; // radians tipped forward at the bottom of a dabble
const TIP_EASE = 0.3; // seconds to tip over, and to come back up
const WAKE_FULL_SPEED = 1.2; // world units per second at which the wake is strongest
const WAKE_EASE = 3; // how fast the wake swells and fades (per second)
const WAKE_LIFT = 0.005; // above the water, so it never shares the surface's plane
const PADDLE_NOD = 16; // head-nod radians per world unit paddled

export interface DuckLook {
  material: THREE.Material;
  parts: Record<DuckVariant, { body: THREE.BufferGeometry; head: THREE.BufferGeometry }>;
  foam: THREE.BufferGeometry; // a unit box, scaled into each line of foam
}

// Meshed parts and the material shared by every duck on screen.
export function createDuckLook(): DuckLook {
  const mesh = partMesher(V);
  const parts = {} as DuckLook['parts'];
  for (const variant of ['drake', 'hen', 'duckling'] as const) {
    const palette = duckPalette(variant);
    const [bx, , bz] = BODY_GRID[variant];
    const hx = HEAD_GRID[variant][0];
    const sunk = variant === 'duckling' ? SUBMERGED.duckling : SUBMERGED.adult;
    parts[variant] = {
      body: mesh(buildDuckBody(variant), palette, [bx / 2, sunk, bz / 2]), // pivot at the waterline, mid-body
      head: mesh(buildDuckHead(variant), palette, [hx / 2, 0, 1.5]), // pivot at the base of the neck (the head's middle row)
    };
  }
  return {
    material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    parts,
    foam: new THREE.BoxGeometry(1, 1, 1),
  };
}

// Where the neck sits on each body, in voxels from the body's pivot.
const NECK: Record<DuckVariant, [number, number, number]> = { drake: [0, 2.5, 2.5], hen: [0, 2.5, 2.5], duckling: [0, 2, 1] };

export class DuckRig extends AnimalRig {
  private readonly body = new THREE.Group(); // tips over to dabble
  private readonly head = new THREE.Group();
  private readonly wake = new THREE.Group();
  private readonly foam = new THREE.MeshBasicMaterial({ color: 0xeefaf2, transparent: true, opacity: 0, depthWrite: false });
  private readonly ripple = new THREE.MeshBasicMaterial({ color: 0xeefaf2, transparent: true, opacity: 0, depthWrite: false });
  private readonly sides: THREE.Mesh[] = [];
  private readonly stern: THREE.Mesh;
  private readonly size: [number, number, number]; // the body's voxels
  private wakeStrength = 0; // eased 0..1
  private paddled = 0;

  constructor(duck: Wildlife, look: DuckLook) {
    super(duck.id * 1.37); // so neighbours don't bob in step
    const variant = duck.variant as DuckVariant;
    const { body, head } = look.parts[variant];
    this.body.add(new THREE.Mesh(body, look.material));
    const neck = NECK[variant];
    this.head.position.set(neck[0] * V, neck[1] * V, neck[2] * V);
    this.head.add(new THREE.Mesh(head, look.material));
    this.body.add(this.head);
    // The wake, in voxel-sized strips: a bow ripple, side lines, a stern ripple.
    this.size = BODY_GRID[variant];
    const [w, , l] = this.size;
    const strip = (material: THREE.Material, x: number, z: number, width: number, depth: number) => {
      const mesh = new THREE.Mesh(look.foam, material);
      mesh.position.set(x * V, 0, z * V);
      mesh.scale.set(width * V, V * 0.2, depth * V);
      this.wake.add(mesh);
      return mesh;
    };
    strip(this.foam, 0, l / 2 + 0.5, w - 1, 1);
    for (const side of [-1, 1]) this.sides.push(strip(this.foam, side * (w / 2 + 0.5), 0, 1, 1));
    this.stern = strip(this.ripple, 0, 0, w + 3, 1);
    this.wake.position.y = WAKE_LIFT;
    this.wake.visible = false;
    this.root.add(this.body, this.wake);
  }

  update(duck: Wildlife, dt: number): void {
    this.follow(duck, dt, TURN_RATE);

    // Bob and rock on the water.
    this.body.position.y = Math.sin(this.time * 2.4) * 0.004;
    this.body.rotation.z = Math.sin(this.time * 1.7) * 0.05;

    // Tip up to feed: ease over, hold, ease back.
    const d = duck.dabble;
    const tip = d === null || d < 0 ? 0 : Math.min(1, d / TIP_EASE, (DABBLE_TIME - d) / TIP_EASE);
    this.body.rotation.x = TIP * tip * tip * (3 - 2 * tip);

    // Paddling: a nodding head and a wake, both easing with the pace.
    const target = Math.min(1, duck.speed / WAKE_FULL_SPEED);
    this.wakeStrength += (target - this.wakeStrength) * Math.min(1, WAKE_EASE * dt);
    const s = this.wakeStrength;
    this.paddled += duck.speed * dt;
    this.head.rotation.x = Math.sin(this.paddled * PADDLE_NOD) * 0.12 * Math.min(1, s * 4);
    this.wake.visible = s > 0.02;
    if (!this.wake.visible) return;
    // Side lines grow from 2 to 8 voxels long, starting beside the tail end.
    const [, , l] = this.size;
    const length = 2 + 6 * s;
    const start = -(l / 2 - 1);
    for (const side of this.sides) {
      side.scale.z = length * V;
      side.position.z = (start - length / 2) * V;
    }
    this.stern.position.z = (start - length - 0.5) * V;
    this.foam.opacity = s * 0.7;
    this.ripple.opacity = Math.max(0, s - 0.3) * 0.6; // only when it hurries
  }

  override dispose(): void {
    super.dispose();
    this.foam.dispose();
    this.ripple.dispose();
  }
}
