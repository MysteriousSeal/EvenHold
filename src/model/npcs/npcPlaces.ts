// Where villagers go (npcRoutine.ts plans when): a building's door tile, a
// spot in a field or on the square, a free bench seat, and settling in a
// room (a free seat, else somewhere to stand); what's taken; all from rolls
// of their routine, the same every time on a seed.

import { VILLAGE_OUTER_RADIUS } from '../constants';
import { hashUnit, oneOf } from '../../util/random';
import type { Point } from '../map/obstacles';
import type { Field } from '../types';
import type { Entrance } from '../interiors/interiors';
import { distanceTo, seatOf, type Furniture, type Seat } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import { villageBenches } from '../worldgen/benches';
import type { Npc, NpcStep } from './npcs';
import type { NpcWorld } from './npcRoutine';
import { roomFree } from './npcWalk';

const SIT_CHANCE = 0.75;
const BAR_PULL = 0.5; // at the inn, of making for a stool at the bar (rather than any seat)

// A roll for a villager at this point of their routine, the same every time on a seed.
export const roll = (npc: Npc, salt: number) => hashUnit(npc.id, npc.stop * 7 + salt, npc.salt);
export const between = (npc: Npc, [a, b]: [number, number], salt: number) => a + roll(npc, salt) * (b - a);

// The door's tile inside a building's room.
export function doorTile(seed: number, entrance: Entrance): Point {
  const { room } = layoutOf(seed, entrance);
  return { x: room.door, z: room.depth - 1 };
}

// A tile of wheat in a field (not its corner, heaped with bales), from the routine.
export function fieldSpot(npc: Npc, field: Field, k: number): Point {
  for (let tries = 0; tries < 8; tries++) {
    const x = field.x0 + Math.floor(roll(npc, 70 + k * 11 + tries) * field.width);
    const z = field.z0 + Math.floor(roll(npc, 90 + k * 11 + tries) * field.depth);
    if (x !== field.corner[0] || z !== field.corner[1]) return { x, z };
  }
  return { x: field.gate[0], z: field.gate[1] };
}

// Villagers at an inn, or on their way in.
export function patrons(npcs: readonly Npc[], inn: Entrance): number {
  return npcs.filter((o) => o.role === 'villager' && o.inn === inn && (o.where === inn || o.steps.some((s) => s.kind === 'enter' && s.entrance === inn))).length;
}

// Somewhere open on the village square (around the well), from the routine.
export function squareSpot(npc: Npc, world: NpcWorld, k: number): Point {
  const { village } = npc;
  for (let tries = 0; tries < 12; tries++) {
    const x = village.x + Math.floor(roll(npc, 20 + k * 13 + tries) * (VILLAGE_OUTER_RADIUS * 2 + 1)) - VILLAGE_OUTER_RADIUS;
    const z = village.z + Math.floor(roll(npc, 40 + k * 13 + tries) * (VILLAGE_OUTER_RADIUS * 2 + 1)) - VILLAGE_OUTER_RADIUS;
    if (world.isOpenTile(x, z)) return { x: x + (roll(npc, 60 + k) - 0.5) * 0.4, z: z + (roll(npc, 61 + k) - 0.5) * 0.4 };
  }
  return { x: npc.home.x, z: npc.home.z };
}

// A free seat on one of their village's benches, picked from the routine; else null.
export function benchSeat(npc: Npc, npcs: readonly Npc[], world: NpcWorld): Seat | null {
  const seats = villageBenches(world, npc.village)
    .flatMap((b) => b.seats)
    .filter((seat) => !claimed(seat.piece, npc, npcs, world, null)); // outdoors, wherever they are now
  return oneOf(seats, roll(npc, 18)) ?? null;
}

// Whether the hero's on a piece of furniture (or a bench seat), where `where` is.
export function heroOnPiece(world: NpcWorld, where: Entrance | null, piece: Furniture): boolean {
  return where ? world.inside?.entrance === where && world.inside.seated?.seat.piece === piece : world.outdoors.seated?.seat.piece === piece;
}

// Whether someone else is on a piece of furniture (in `where`: a room, or null outdoors), or on their way to it.
export function claimed(piece: Furniture, npc: Npc, npcs: readonly Npc[], world: NpcWorld, where = npc.where): boolean {
  if (heroOnPiece(world, where, piece)) return true;
  return npcs.some((o) => o !== npc && (o.seat?.piece === piece || o.steps.some((s) => s.kind === 'sit' && s.seat.piece === piece)));
}

// Settling in a room: a free seat (their own bed only at home) and the free
// tile beside it to sit down from, else a free tile to stand on.
export function settle(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seconds: number, at?: 'table' | 'bar'): NpcStep[] {
  const { room, furniture } = layoutOf(world.seed, npc.where!);
  const free = roomFree(world.seed, npc.where!);
  const tiles: Point[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth - 1; z++) if (free(x, z)) tiles.push({ x, z });
  const atInn = npc.where !== npc.home; // at the inn: always a seat, if there's one free
  if (atInn || roll(npc, 30) < SIT_CHANCE) {
    const seats = furniture
      .map((piece) => seatOf(piece))
      .filter((seat): seat is Seat => !!seat && (!seat.lying || npc.where === npc.home) && (!at || seat.piece.kind === (at === 'table' ? 'chair' : 'barStool')) && !claimed(seat.piece, npc, npcs, world)); // (`at`: a chair at a table only, or a stool at the bar)
    // At the inn, the bar draws them: often a free stool there first, then any seat.
    const stools = seats.filter((seat) => seat.piece.kind === 'barStool');
    const first = stools.length > 0 && roll(npc, 33) < BAR_PULL ? stools : seats;
    const start = Math.floor(roll(npc, 31) * first.length);
    const order = [...first.slice(start), ...first.slice(0, start), ...seats.filter((seat) => !first.includes(seat))];
    // The first of them with a free tile beside it to sit down from.
    for (const seat of order) {
      const from = tiles.filter((t) => distanceTo(seat.piece, t.x, t.z) <= 0.6).sort((a, b) => distanceTo(seat.piece, a.x, a.z) - distanceTo(seat.piece, b.x, b.z))[0];
      if (from) return [{ kind: 'go', to: from }, { kind: 'sit', seat, for: seconds }];
    }
  }
  // Nowhere to sit: standing, at the inn turned to the bar (waiting on a place there).
  const spot = oneOf(tiles, roll(npc, 32)) ?? doorTile(world.seed, npc.where!);
  const counter = atInn ? furniture.find((f) => f.kind === 'counter') : undefined;
  return [{ kind: 'go', to: spot, ...(counter && { faceToward: { x: counter.x, z: spot.z } }) }, { kind: 'wait', for: seconds }];
}
