// The caves' beasts' told moves (enemies/toldMoves.ts: shown before they
// land), run by a cave's run (caveFoes.ts):
// - a spider spits a web (from a little way off): told, it flies at where the
//   hero stood; caught, they're webbed (walking slower);
// - a spider lunges (from close by): told, it leaps on, a short way; landing
//   on the hero, a hard bite, knocking them back;
// - a worm, underground, comes on under the hero; told (the ground heaving
//   under them), it bursts up there: caught, knocked off their feet;
// - the brood mother spits a volley (three webs, fanned) and charges (a rush
//   down a line, stopped at the rock; caught in it, bowled back along it).

import type { Told, ToldMove } from '../enemies/toldMoves';

export const WEB_TELL = 0.55;
export const WEB_SPEED = 6; // tiles a second, a spat web
export const WEB_RANGE = 8; // tiles it flies, at most
export const WEB_HIT = 0.26; // how near the hero it must pass to catch them
export const LUNGE_TELL = 0.45;
const LUNGE_RUSH = 0.22; // seconds the leap takes
const LUNGE_LENGTH = 2.4; // tiles at most
export const LUNGE_HIT = 0.55; // tiles from where it lands it bites
export const LUNGE_KNOCK = 0.7;
export const ERUPT_TELL = 1.0; // seconds the ground heaves before it bursts
export const ERUPT_RADIUS = 0.85; // tiles round where it bursts up it throws the hero
export const ERUPT_KNOCK = 0.6;
export const SURFACED = 4.5; // seconds a worm stays up, once burst up (to be fought), before digging down again
export const VOLLEY_TELL = 0.8;
export const VOLLEY_SPREAD = 0.45; // radians between its three webs
export const RUSH_TELL = 0.9;
const RUSH_TIME = 0.5;
const RUSH_LENGTH = 5;
export const RUSH_HALF = 0.45; // half the width of its strip
export const RUSH_KNOCK = 2;

// Where a leap (or rush) of `length` at most, over `time`, carries it `t` past its tell: on along the way it faced,
// stopped short of the rock (`blocked`: whether it'd be in it).
const along = (blocked: (x: number, z: number) => boolean, length: number, time: number) => (m: Told, t: number) => {
  const want = Math.min(1, t / time) * length;
  let gone = 0;
  while (gone + 0.1 <= want && !blocked(m.x + m.dx * (gone + 0.1), m.z + m.dz * (gone + 0.1))) gone += 0.1;
  return { x: m.x + m.dx * gone, z: m.z + m.dz * gone };
};

// A spider's spat web: lands (spat) at its tell's end, whatever the hero does; its flight is the run's (caveFoes.ts).
export const SPIT: ToldMove = { told: 'web', by: 'caveSpider', tell: WEB_TELL, after: 0.25, every: 4.5, first: 0.5, near: 5.5, far: 2.2, hits: () => true }; // (its opener, coming on)

// A spider's lunge: a short leap at the hero, its bite where it lands.
export const lungeMove = (blocked: (x: number, z: number) => boolean): ToldMove => ({
  told: 'lunge',
  by: 'caveSpider',
  tell: LUNGE_TELL,
  after: LUNGE_RUSH + 0.3,
  every: 5,
  first: 3,
  near: 2.6,
  far: 1.1,
  path: (m, t) => along(blocked, Math.min(LUNGE_LENGTH, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), LUNGE_RUSH)(m, t),
  hits: (m, hero) => {
    const at = along(blocked, Math.min(LUNGE_LENGTH, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), LUNGE_RUSH)(m, LUNGE_RUSH);
    return Math.hypot(hero.x - at.x, hero.z - at.z) < LUNGE_HIT;
  },
});

// A worm's eruption: told under where the hero stood as it began, it's there at the tell's end (up out of the ground:
// the run's to surface it), catching them if they're still on it. Never lost to a blow (it's underground).
export const ERUPT: ToldMove = {
  told: 'erupt',
  by: 'caveWorm',
  tell: ERUPT_TELL,
  after: 0.4,
  every: 7,
  first: 2.5,
  near: 3.2,
  staunch: true,
  path: (m) => ({ x: m.tx, z: m.tz }),
  hits: (m, hero) => Math.hypot(hero.x - m.tx, hero.z - m.tz) < ERUPT_RADIUS,
};

// The brood mother's volley: three webs, fanned at the hero (the run's to loose).
export const VOLLEY: ToldMove = { told: 'volley', by: 'broodMother', tell: VOLLEY_TELL, after: 0.4, every: 6, first: 3, near: 7, far: 2.5, staunch: true, hits: () => true };

// Her charge: a rush down a strip at the hero, stopped at the rock; caught in it, bowled back along it.
export const rushMove = (blocked: (x: number, z: number) => boolean): ToldMove => ({
  told: 'charge',
  by: 'broodMother',
  tell: RUSH_TELL,
  after: RUSH_TIME + 0.4,
  every: 8,
  first: 5,
  near: 6,
  far: 2.2,
  staunch: true,
  path: (m, t) => along(blocked, RUSH_LENGTH, RUSH_TIME)(m, t),
  hits: (m, hero) => {
    const [px, pz] = [hero.x - m.x, hero.z - m.z];
    const ahead = px * m.dx + pz * m.dz;
    const end = along(blocked, RUSH_LENGTH, RUSH_TIME)(m, RUSH_TIME);
    return ahead > 0 && ahead < Math.hypot(end.x - m.x, end.z - m.z) + RUSH_HALF && Math.abs(px * m.dz - pz * m.dx) < RUSH_HALF;
  },
});
