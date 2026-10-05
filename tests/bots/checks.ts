// What a bot's game must never show, checked once a game second: the hero
// sane (health, energy, coin, where they stand: never in a wall, a piece of
// furniture or a dungeon's rock), foes sane (dead at no health, gone once
// dead, never inside walls or rock, never wandering off for good),
// villagers and the inn's barmaids where they belong and never stuck for
// long, quests counting right, animals where they can be.
import type { GameModel } from '../../src/model/GameModel';
import { maxEnergyOf, maxHpOf } from '../../src/model/hero/attributes';
import { ENEMY_ACTIVE_RADIUS, ENEMY_CORPSE_TIME, ENEMY_STATS, HERO_RADIUS, INDOOR_SCALE } from '../../src/model/constants';
import { MAX_ACTIVE } from '../../src/model/quests/quests';
import { bumpsFurniture } from '../../src/model/interiors/furniture';
import { layoutOf } from '../../src/model/interiors/indoors';
import { swimmable } from '../../src/model/wildlife/ducks';

export interface Problem {
  kind: string; // what sort ("hero inside a wall", "foe never dies"…), to count by
  seed: number;
  t: number; // game seconds in
  detail: string;
}

type Report = (kind: string, detail: string) => void;
const finite = (...ns: number[]) => ns.every(Number.isFinite);
const at = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;

export class Checks {
  private readonly deadFor = new Map<number, number>(); // foes at no health: game seconds so
  private readonly stillFor = new Map<number, { x: number; z: number; t: number }>(); // villagers walking, and where they last got to
  private readonly away = new Map<number, number>(); // foes far from home: seconds so

  constructor(
    private readonly model: GameModel,
    private readonly report: Report,
  ) {}

  // One game second's checks (`dt`: seconds since the last).
  run(dt: number): void {
    this.hero();
    this.foes(dt);
    this.below();
    this.villagers(dt);
    this.quests();
    this.animals();
  }

  private hero(): void {
    const { hero, inside } = this.model;
    if (!finite(hero.x, hero.y, hero.z, hero.hp, hero.energy, hero.money)) return this.report('hero broken', `x ${hero.x} z ${hero.z} hp ${hero.hp} energy ${hero.energy} money ${hero.money}`);
    if (hero.hp < 0 || hero.hp > maxHpOf(hero) + 1e-6) this.report('hero health out of range', `${hero.hp} of ${maxHpOf(hero)}`);
    if (hero.energy < 0 || hero.energy > maxEnergyOf(hero) + 1e-6) this.report('hero energy out of range', `${hero.energy} of ${maxEnergyOf(hero)}`);
    if (hero.money < 0 || !Number.isInteger(hero.money)) this.report('hero money wrong', `${hero.money}`);
    if (hero.statPoints < 0) this.report('hero stat points below zero', `${hero.statPoints}`);
    for (const [item, n] of Object.entries(hero.bag)) if (!Number.isInteger(n) || n! <= 0) this.report('bag count wrong', `${item}: ${n}`);
    if (inside) {
      if (inside.seated) return;
      const r = HERO_RADIUS * INDOOR_SCALE;
      const { width, depth } = inside.room;
      if (hero.x < -0.5 || hero.z < -0.5 || hero.x > width - 0.5 || hero.z > depth - 0.5) this.report('hero outside the room', `${at(hero.x, hero.z)} in ${width}x${depth} (${inside.entrance.type}${inside.below ? ' upstairs' : ''})`);
      else if (bumpsFurniture(inside.furniture, hero.x, hero.z, r * 0.6)) this.report('hero inside furniture', `${at(hero.x, hero.z)} (${inside.entrance.type}${inside.below ? ' upstairs' : ''})`);
      else if (inside.walls?.(hero.x, hero.z, r * 0.6)) this.report('hero inside rock', `${at(hero.x, hero.z)} (down a ${inside.entrance.type})`);
    } else if (!this.model.outdoors.seated && !this.model.yard && this.model.isBlocked(hero.x, hero.z, HERO_RADIUS * 0.6)) {
      this.report('hero inside a wall', `${at(hero.x, hero.z)}`);
    }
  }

  private foes(dt: number): void {
    const { hero } = this.model;
    const near = (e: { x: number; z: number }) => Math.abs(e.x - hero.x) < 30 && Math.abs(e.z - hero.z) < 30;
    for (const e of this.model.enemies) {
      if (!finite(e.x, e.z, e.hp)) {
        this.report('foe broken', `${e.kind} #${e.id}: x ${e.x} z ${e.z} hp ${e.hp}`);
        continue;
      }
      if (e.hp <= 0 && e.state !== 'dead') this.report('foe at no health, not dead', `${e.kind} #${e.id} (${e.state})`);
      if (e.state === 'dead' && near(e)) {
        const t = (this.deadFor.get(e.id) ?? 0) + dt;
        this.deadFor.set(e.id, t);
        if (t > ENEMY_CORPSE_TIME + 3) {
          this.report('dead foe never gone', `${e.kind} #${e.id}, dead ${t.toFixed(0)} s`);
          this.deadFor.set(e.id, -1e9);
        }
      }
      if (e.state === 'dead' || !near(e)) continue;
      if (this.model.isBlocked(e.x, e.z, ENEMY_STATS[e.kind].radius * 0.6)) this.report('foe inside a wall', `${e.kind} #${e.id} at ${at(e.x, e.z)} (${e.state})`);
      const far = Math.hypot(e.x - e.homeX, e.z - e.homeZ) > ENEMY_STATS[e.kind].giveUp * 2 + 10;
      const t = far && e.state !== 'chase' ? (this.away.get(e.id) ?? 0) + dt : 0;
      this.away.set(e.id, t);
      if (t > 60) {
        this.report('foe lost far from home', `${e.kind} #${e.id} at ${at(e.x, e.z)}, home ${at(e.homeX, e.homeZ)}`);
        this.away.set(e.id, -1e9);
      }
    }
  }

  // Down a dungeon: its foes sane (dead at no health), never inside its rock.
  private below(): void {
    const run = this.model.dungeon;
    if (!run) return;
    const where = this.model.inside!.entrance.type;
    for (const e of run.foes) {
      if (!finite(e.x, e.z, e.hp)) {
        this.report('foe broken', `${e.kind} #${e.id} down a ${where}: x ${e.x} z ${e.z} hp ${e.hp}`);
        continue;
      }
      if (e.hp <= 0 && e.state !== 'dead') this.report('foe at no health, not dead', `${e.kind} #${e.id} down a ${where} (${e.state})`);
      if (e.state !== 'dead' && !run.free(e.x, e.z, ENEMY_STATS[e.kind].radius * 0.5)) this.report('foe inside rock', `${e.kind} #${e.id} at ${at(e.x, e.z)} down a ${where} (${e.state})`);
    }
  }

  private villagers(dt: number): void {
    const { hero, seed } = this.model;
    for (const n of this.model.npcs) {
      if (!finite(n.x, n.z)) {
        this.report('villager broken', `${n.name} (${n.role}): x ${n.x} z ${n.z}`);
        continue;
      }
      // The inn's barmaids never leave it.
      if ((n.role === 'barkeep' || n.role === 'server') && n.where !== n.home) this.report('barmaid out of her inn', `${n.name} (${n.role})`);
      // In the building the hero's in: in the room, never inside its furniture.
      if (n.where && n.where === this.model.inside?.entrance && !this.model.inside.below && !n.seat) {
        const { room, furniture } = layoutOf(seed, n.where);
        if (n.x < -0.6 || n.z < -0.6 || n.x > room.width - 0.4 || n.z > room.depth - 0.4) this.report('villager outside the room', `${n.name} (${n.role}) at ${at(n.x, n.z)} in ${room.width}x${room.depth}`);
        else if (bumpsFurniture(furniture, n.x, n.z, 0.05)) this.report('villager inside furniture', `${n.name} (${n.role}) at ${at(n.x, n.z)} (${n.where.type})`);
      }
      // Walking (their village near enough the hero for them to act, as npcRoutine.ts has it), and getting somewhere now and then.
      const heroOut = this.model.inside?.entrance ?? hero;
      const acting = Math.abs(n.village.x - heroOut.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(n.village.z - heroOut.z) <= ENEMY_ACTIVE_RADIUS && n.steps[0]?.kind === 'go';
      const last = this.stillFor.get(n.id);
      if (!acting) {
        this.stillFor.delete(n.id);
        continue;
      }
      if (!last || Math.hypot(n.x - last.x, n.z - last.z) > 0.5) this.stillFor.set(n.id, { x: n.x, z: n.z, t: 0 });
      else if ((last.t += dt) > 45) {
        this.report(n.role === 'villager' ? 'villager stuck' : 'staff stuck', `${n.name} (${n.role}) at ${at(n.x, n.z)} ${n.where ? `in the ${n.where.type}` : 'outdoors'}, going to ${JSON.stringify((n.steps[0] as { to?: unknown }).to)}`);
        last.t = -1e9;
      }
    }
  }

  private quests(): void {
    const { quests } = this.model;
    if (quests.taken.length > MAX_ACTIVE) this.report('too many quests taken', `${quests.taken.length}`);
    for (const t of quests.taken) {
      const progress = quests.progress(t);
      if (!Number.isInteger(progress) || progress < 0) this.report('quest progress wrong', `${t.quest.key}: ${progress}`);
      if (t.kills < 0) this.report('quest kills wrong', `${t.quest.key}: ${t.kills}`);
      if (quests.isCompleted(t.quest.key)) this.report('quest done and still taken', t.quest.key);
    }
  }

  private animals(): void {
    const { hero } = this.model;
    for (const w of this.model.wildlife) {
      if (!finite(w.x, w.z, w.y)) {
        this.report('animal broken', `${w.kind} #${w.id}`);
        continue;
      }
      if (Math.abs(w.x - hero.x) > 30 || Math.abs(w.z - hero.z) > 30) continue;
      if (w.kind === 'duck' && !swimmable(this.model, w.x, w.z)) this.report('duck out of the water', `#${w.id} at ${at(w.x, w.z)}`);
      if (w.kind === 'deer' && this.model.isBlocked(w.x, w.z, 0.08)) this.report('deer inside a wall', `#${w.id} at ${at(w.x, w.z)}`);
    }
  }
}
