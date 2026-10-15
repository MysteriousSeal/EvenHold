// The dice on an inn's table (model/inn/diceHall.ts onTable): the cup and two dice at the table the hero's playing at
// (or where tonight's sharp sits waiting, the cup stood by them). Each cast, the dice tumble out across the table,
// bouncing and spinning a moment, and come to rest on their faces (diceVoxels.ts faceUp); the cup laid on its side
// after the throw.
import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { diceGeometries, faceUp } from './diceVoxels';

const TABLE_TOP = 0.44; // a tavern table's top (roomView.ts)
const TUMBLE = 0.65; // seconds the dice tumble (the window's too: controller/inn/dicePanel.ts)
const DIE_HALF = 0.035;
const YAWS = [0.3, -0.4].map((a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a));

export class DiceOnTable {
  private readonly group = new THREE.Group();
  private readonly dice: THREE.Mesh[];
  private readonly cup: THREE.Mesh;
  private seen = { casts: -1, game: -1 }; // the cast last thrown (by how many there were, and of which game)
  private tumbling = 0; // seconds of it left
  private spins: THREE.Vector3[] = [];

  constructor(material: THREE.Material) {
    const { die, cup } = diceGeometries();
    this.dice = [new THREE.Mesh(die, material), new THREE.Mesh(die, material)];
    this.cup = new THREE.Mesh(cup, material);
    for (const m of [...this.dice, this.cup]) (m.castShadow = true), this.group.add(m);
  }

  // Each frame, in the room's scene: shown at the table there's one at, else hidden.
  update(model: GameModel, scene: THREE.Object3D, dt: number): void {
    const on = model.dice.onTable(model.inside);
    this.group.visible = !!on;
    if (!on) return void (this.seen = { casts: -1, game: -1 });
    if (this.group.parent !== scene) scene.add(this.group);
    const { table, casts, game } = on;
    this.group.position.set(table.x, TABLE_TOP, table.z);
    // Toward the hero (sat at it, or not): the cup on the far side, the dice thrown toward them.
    const toward = Math.atan2(model.hero.x - table.x, model.hero.z - table.z);
    this.group.rotation.y = toward;
    const last = casts[casts.length - 1];
    if (casts.length !== this.seen.casts || game !== this.seen.game) {
      if (last && this.seen.casts >= 0) (this.tumbling = TUMBLE), (this.spins = this.dice.map(() => new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10)));
      this.seen = { casts: casts.length, game };
    }
    this.tumbling = Math.max(0, this.tumbling - dt);
    const t = 1 - this.tumbling / TUMBLE; // 0 thrown, 1 at rest
    this.dice.forEach((die, i) => {
      const side = i === 0 ? -0.06 : 0.06;
      const rest = new THREE.Vector3(side, DIE_HALF, 0.04 + i * 0.03);
      if (this.tumbling > 0) {
        const from = new THREE.Vector3(side * 0.4, 0.12, -0.16);
        die.position.lerpVectors(from, rest, t);
        die.position.y = DIE_HALF + Math.abs(Math.sin(t * Math.PI * 2.5)) * 0.08 * (1 - t);
        die.rotation.set(this.spins[i].x * (1 - t), this.spins[i].y * (1 - t), this.spins[i].z * (1 - t));
      } else {
        die.position.copy(rest);
        die.quaternion.setFromEuler(faceUp(last ? last[i] : i === 0 ? 5 : 3)).premultiply(YAWS[i]); // (not square to the table: thrown)
      }
    });
    // The cup: stood by the one across, waiting; thrown, on its side behind the dice.
    const thrown = casts.length > 0;
    this.cup.position.set(0.1, thrown ? 0.05 : 0, -0.17);
    this.cup.rotation.set(thrown ? Math.PI / 2 : 0, 0, thrown ? 0.4 : 0);
  }
}
