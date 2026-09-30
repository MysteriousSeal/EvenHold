// A group of animals going about together (a deer herd, a duck pack), each
// kind with its own paces and places. One frame: fleeing or calm, the
// leader's wandering and resting, the others keeping their places around it,
// and everyone's feeding (a deer grazing, a duck tipped up), `feeding` being
// seconds into it (or, below 0, till it starts).

import { fleeTarget, rollAt } from './moving';
import type { Wildlife } from './animal';

export interface GroupWays {
  fits(x: number, z: number): boolean; // room for one there
  go(animal: Wildlife, tx: number, tz: number, speed: number, dt: number): number; // toward (tx, tz); how far it went
  place(animal: Wildlife, i: number, leader: Wildlife): { x: number; z: number }; // where a follower keeps
  walk: number; // pace, calm
  flee: number; // and fleeing
  catchUp: number; // followers can go this much faster than the leader, to keep up
  slack: number; // a follower lets its place drift this far before going back to it
  settle: number; // and, once going, keeps on till this close
  wander: number; // tiles from home
  fleeRadius: number; // the hero this close sends them off
  calmRadius: number; // and this far lets them settle
  fleeDistance: number; // how far they run
  fleeNear: number; // near enough its flight spot, the leader picks another
  rest: [number, number]; // seconds resting once there: at least, plus up to
  feedTime: number; // seconds feeding
  feedChance: number; // of each one feeding while the leader rests
  feedLag: number; // up to this many seconds later than the leader
  salt: number; // for its rolls
  faceLeader?: boolean; // close to its place, a follower faces the way the leader does
}

export function stepGroup(group: Wildlife[], ways: GroupWays, hero: { x: number; z: number }, dt: number): void {
  const leader = group[0];
  const roll = (animal: Wildlife, n: number) => rollAt(animal, ways.salt + n);
  const near = Math.min(...group.map((a) => Math.hypot(a.x - hero.x, a.z - hero.z)));
  if (!leader.fleeing && near < ways.fleeRadius) {
    for (const animal of group) {
      animal.fleeing = true;
      animal.dabble = null;
    }
    leader.target = null;
  } else if (leader.fleeing && near > ways.calmRadius) {
    for (const animal of group) animal.fleeing = false;
    leader.target = null;
    leader.restFor = 1 + roll(leader, 0) * 2;
  }

  for (const animal of group) {
    if (animal.dabble === null) continue;
    animal.dabble += dt;
    if (animal.dabble >= ways.feedTime) animal.dabble = null;
  }

  // The leader.
  let moved = 0;
  if (leader.fleeing) {
    if (!leader.target || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < ways.fleeNear) leader.target = fleeTarget(leader, hero, ways.fleeDistance, ways.fits);
    if (leader.target) moved = ways.go(leader, leader.target.x, leader.target.z, ways.flee, dt);
    if (leader.target && moved === 0) leader.target = null; // cornered: look again next frame
  } else if (!leader.target) {
    leader.restFor -= dt;
    if (leader.restFor <= 0) {
      const x = leader.homeX + (roll(leader, 1) - 0.5) * 2 * ways.wander;
      const z = leader.homeZ + (roll(leader, 2) - 0.5) * 2 * ways.wander;
      if (ways.fits(x, z)) leader.target = { x, z };
      else leader.restFor = 0.3; // try somewhere else shortly
    }
  } else {
    moved = ways.go(leader, leader.target.x, leader.target.z, ways.walk, dt);
    if (moved === 0 || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < 0.05) {
      // Arrived (or something's in the way): rest, and maybe feed. The
      // others may feed too, each starting a moment later.
      leader.target = null;
      leader.restFor = ways.rest[0] + roll(leader, 3) * ways.rest[1];
      moved = 0; // that last step brought it to a stop
      group.forEach((animal, i) => {
        if (roll(animal, 4) < ways.feedChance) animal.dabble = i === 0 ? 0 : -roll(animal, 5) * ways.feedLag;
      });
    }
  }
  leader.speed = moved / dt;

  // The others, in order, each to its place: going once it has drifted
  // `slack` away, and on till right on it, so it doesn't stop and start every frame.
  const pace = (leader.fleeing ? ways.flee : ways.walk) * ways.catchUp;
  group.forEach((animal, i) => {
    if (i === 0) return;
    const spot = ways.place(animal, i, leader);
    const off = Math.hypot(spot.x - animal.x, spot.z - animal.z);
    animal.speed = (off > (animal.speed > 0 ? ways.settle : ways.slack) ? ways.go(animal, spot.x, spot.z, pace, dt) : 0) / dt;
    // (Rather than turning to every little correction, which could point it backwards.)
    if (ways.faceLeader && off < ways.slack * 1.5) animal.heading = leader.heading;
  });

  // Those on the move stop feeding (one still settling may yet start).
  for (const animal of group) if (animal.speed > 0.05 && animal.dabble !== null && animal.dabble >= 0) animal.dabble = null;
}
