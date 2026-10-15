// What the reliquary's dead do past any foe's blows (told moves: enemies/toldMoves.ts), run by its run
// (reliquaryFoes.ts):
// - an Unquiet Brother prays: his arms raised (PRAYER_TELL), then the dead round him mended (PRAYER_MENDS of their
//   health; never the Deacon); struck while he prays, his prayer's lost. Cut him down first, or watch the saints get
//   up again and again;
// - a gilded saint smashes: its fists raised, a ring round it, then down, hard on whoever's still in it, knocked away;
// - the Gilded Deacon (DEACON_TURNS where his fight turns, a reliquary breaking off him at each): his slam from the
//   first; his sweep and his charge once the bone casket's broken off his back; his souls once the arm's gone; the
//   bones bursting up, and his rage, once the finger's fallen from its monstrance. A crypt lord's moves, all of them
//   (crypts/cryptLord.ts), as his.
import type { ToldMove } from '../enemies/toldMoves';
import { BARRAGE, ERUPTION, SLAM, SWEEP, chargeMove } from '../crypts/cryptLord';

export const PRAYER_TELL = 1.8; // seconds a Brother's prayer is told before it mends
export const PRAYER_REACH = 4.5; // tiles round him it mends the dead
export const PRAYER_MENDS = 0.25; // of each one's health
export const PRAYER: ToldMove = {
  told: 'prayer', by: 'unquietBrother', tell: PRAYER_TELL, after: 0.4, every: 6, first: 1.5, near: 9,
  hits: () => true, // (prayed through: whatever the hero does, it mends)
};

export const SMASH_TELL = 1.0;
export const SMASH_RADIUS = 1.25; // tiles round the saint its smash strikes
export const SMASH_KNOCK = 0.7;
export const SAINT_SMASH: ToldMove = {
  told: 'smash', by: 'gildedSaint', tell: SMASH_TELL, after: 0.5, every: 6.5, first: 2.5, near: 1.5, staunch: true,
  hits: (m, hero) => Math.hypot(hero.x - m.x, hero.z - m.z) < SMASH_RADIUS,
};

// The Deacon's turns, as shares of his health (enemies/bossPhases.ts): the bone casket off his back; the saint's arm
// off his own; the finger from its monstrance.
export const DEACON_TURNS = [0.75, 0.5, 0.25] as const;
export const DEACON_CALLS = 3; // the dead got up out of the bone casket as it breaks
export const DEACON_RAGE_COOLDOWN = 0.45; // seconds between his blows, at most, the finger fallen

// His moves: a crypt lord's, his.
const his = (move: ToldMove): ToldMove => ({ ...move, by: 'gildedDeacon' });
export const DEACON_SLAM = his(SLAM);
export const DEACON_SWEEP = his(SWEEP);
export const DEACON_ERUPTION = his(ERUPTION);
export const DEACON_BARRAGE = his(BARRAGE);
export const deaconCharge = (blocked: (x: number, z: number) => boolean): ToldMove => his(chargeMove(blocked));
// From which turn on each is his (how many reliquaries gone: 0 from the first).
export const DEACON_FROM = { slam: 0, sweep: 1, charge: 1, barrage: 2, eruption: 3 } as const;
