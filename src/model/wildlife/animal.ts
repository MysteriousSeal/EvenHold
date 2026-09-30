// What every animal is (wildlife.ts runs them; ducks.ts, deer.ts and cats.ts each one kind).

import type { Seat } from '../interiors/furniture';

export type CatPose = 'sit' | 'groom' | 'nap' | 'loaf';
export type WildlifeKind = 'duck' | 'deer' | 'cat';
export type DuckVariant = 'drake' | 'hen' | 'duckling';
export type DeerVariant = 'stag' | 'doe' | 'fawn';
export type CatVariant = 'ginger' | 'tabby' | 'black' | 'white'; // its coat

export interface Wildlife {
  id: number;
  kind: WildlifeKind;
  variant: DuckVariant | DeerVariant | CatVariant;
  x: number;
  z: number;
  y: number;
  heading: number; // yaw toward where it last moved (atan2(dx, dz))
  homeX: number; // where it wanders around
  homeZ: number;
  pack: Wildlife[]; // everyone in its group, leader first (shared by all of them)
  mother: Wildlife | null; // a fawn's: it keeps by her
  target: { x: number; z: number } | null; // where the leader is heading
  restFor: number; // seconds before the leader picks a new target
  dabble: number | null; // seconds into feeding (a duck dabbling, a deer grazing), or null
  fleeing: boolean; // hurrying away from the hero
  speed: number; // how fast it moved last frame, for the wake
  // Cats (cats.ts): what it's doing when not walking (null walking), the
  // bench seat it's on or heading up to, and how far the hero was last frame.
  pose?: CatPose | null;
  perch?: Seat | null;
  heroWas?: number;
}

