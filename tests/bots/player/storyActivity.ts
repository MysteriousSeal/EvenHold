// The story (the first line, then the second arc's: firstQuests.ts, saintQuests.ts): what a player who wants to see
// how it ends does about it. Whoever has the next of it to give, or a part of it to take in, sought out however far;
// a part under way, gone after where it leads (the tracker's arrow: storyGoals.ts), what it asks there done by the
// rest (a foe fought off, a shift worked, a camp raided). And a word with anyone (the errand too, here and near):
// each answer the first, but a choice (the witch: freed, sold, left) answered as the player would, by their traits.

import type { Who } from '../../../src/model/story/story';
import type { Carter } from '../../../src/model/story/carter';
import type { Npc } from '../../../src/model/npcs/npcs';
import type { Entrance } from '../../../src/model/interiors/interiors';
import type { Talk } from '../../../src/model/story/storyTypes';
import { idOf } from '../../../src/model/story/storyTypes';
import { STORY_QUESTS } from '../../../src/model/story/quests/catalog';
import { bumpsFurniture } from '../../../src/model/interiors/furniture';
import type { Step } from '../botSteps';
import type { Toolkit } from './player';
import type { Trait } from './persona';
import type { Activity, Target } from './activities';

const main = (scope: string | undefined) => scope === 'first' || scope === 'saint'; // (the story's own: not a village's errand)
// The same building (a door's object may be a copy: by where it is).
const sameDoor = (a: Entrance | null, b: Entrance | null) => (a && b ? a.x === b.x && a.z === b.z : a === b);
const whereOf = (who: Who) => ('where' in who && who.where ? who.where : who);

// How a choice's ways lean, by their words: which trait draws a player to each.
const LEANS: Array<[RegExp, Trait]> = [
  [/silver|coin|sell|paid|pay|price|reward|keep/i, 'greedy'],
  [/free|go free|let (her|him|them)|spare|mercy|help|untie|chain/i, 'social'],
  [/fight|kill|break|kick|burn|smash|take/i, 'bold'],
  [/leave|walk (on|away)|not my|go home|no part|nothing to do/i, 'cautious'],
];

// The answer a player gives: the first (taking a quest, thanks); a choice, by their traits (and the seed's dice).
function answerOf(p: Toolkit, talk: Talk): Talk['answers'][number] {
  const ways = talk.answers.filter((a) => !a.out);
  if (talk.quest?.state !== 'handIn' || ways.length < 2) return talk.answers[0];
  const t = p.persona.traits;
  const weights = ways.map((a) => 0.2 + LEANS.filter(([re]) => re.test(a.label)).reduce((sum, [, trait]) => sum + t[trait], 0));
  let roll = p.rng() * weights.reduce((a, b) => a + b, 0);
  const pick = ways.find((_, i) => (roll -= weights[i]) <= 0) ?? ways[0];
  p.chose(`${talk.quest.name}: "${pick.label}"`);
  return pick;
}

// Up to whoever it is and a word with them: each quest of theirs taken or handed in, in the same breath (each step
// checked: something came of the answer; the pay as promised).
export function speakWith(p: Toolkit, who: Carter | Npc): Step[] {
  const { story, hero } = p.model;
  const indoors = 'where' in who ? who.where : null;
  const word: Step = () => {
    if (Math.hypot(who.x - hero.x, who.z - hero.z) > 2.6 || ('where' in who && !sameDoor(who.where, p.model.inside?.entrance ?? null))) return 'fail'; // (walked off meanwhile: another time)
    let said = 0;
    for (; said < 3; said++) {
      const talk = story.talk(who);
      if (!talk?.quest) break; // (nothing more of theirs to take up)
      const [money, before] = [hero.money, JSON.stringify(story.save())];
      answerOf(p, talk).pick();
      if (JSON.stringify(story.save()) === before) return p.report('quest answer came to nothing', `${who.name}: ${talk.quest.name} (${talk.quest.state})`), 'fail';
      if (talk.quest.state === 'handIn') {
        if (hero.money < money + talk.quest.copper) p.report('quest paid wrong', `${talk.quest.name}: ${hero.money - money} for ${talk.quest.copper}`); // (a choice may pay more)
        p.stats.questsDone++;
      } else p.stats.questsTaken++;
    }
    return said > 0 ? 'ok' : 'fail';
  };
  // Up to them: a keeper stands behind a counter, where no one walks: to the first open spot a pace or two off
  // (across it), near enough for a word.
  const beside = () => {
    const inside = p.model.inside;
    const open = (x: number, z: number) => (inside ? x > 0 && z > 0 && x < inside.room.width - 1 && z < inside.room.depth - 1 && !bumpsFurniture(inside.furniture, x, z, 0.3) : !p.model.isBlocked(x, z, 0.3));
    const spot = [[1.6, 0], [0, 1.6], [-1.6, 0], [0, -1.6], [2.2, 0], [0, 2.2], [-2.2, 0], [0, -2.2]].map(([dx, dz]) => ({ x: who.x + dx, z: who.z + dz })).find((s) => open(s.x, s.z));
    return spot ?? who;
  };
  // Up to them and a word, followed if they've moved on meanwhile (re-aimed, a few tries; gone indoors elsewhere: given up).
  let leg: Step | null = null;
  let tries = 0;
  const reach: Step = (dt) => {
    const room = 'where' in who ? who.where : null;
    if (!sameDoor(room, p.model.inside?.entrance ?? null)) return 'fail'; // (gone in, or out: another time)
    if (Math.hypot(who.x - hero.x, who.z - hero.z) <= 1.8) return word(dt);
    leg ??= p.walk(beside, 0.5);
    if (leg(dt) === 'run') return 'run';
    leg = null;
    if (Math.hypot(who.x - hero.x, who.z - hero.z) <= 2.6) return word(dt);
    return ++tries > 4 ? 'fail' : 'run';
  };
  const here = p.model.inside?.entrance ?? null;
  const out = here && !sameDoor(here, indoors) ? p.leave() : []; // (in some other building just now: out of it first)
  const into = indoors && !sameDoor(here, indoors) ? p.enter(indoors) : [];
  return indoors ? [...out, ...into, reach, ...p.leave()] : [...out, reach];
}

// A long road in legs (the bots' own walking plans only so far through the land made round them): a leg of LEG
// tiles at a time towards it, each walked and the next aimed afresh, till it's within NEAR; a leg that can't be
// walked, a sidestep tried, and after FAILS of them, given up.
const LEG = 80;
const NEAR = 60;
const FAILS = 4;
export function travel(p: Toolkit, to: () => { x: number; z: number }): Step {
  let leg: Step | null = null;
  let fails = 0;
  return (dt) => {
    const { hero } = p.model;
    const at = to();
    const far = Math.hypot(at.x - hero.x, at.z - hero.z);
    if (far <= NEAR) return 'ok';
    if (!leg) {
      const turn = fails * 0.6 * (fails % 2 ? 1 : -1); // (straight on; then a little to either side)
      const a = Math.atan2(at.z - hero.z, at.x - hero.x) + turn;
      const go = Math.min(LEG, far);
      const aim = { x: hero.x + Math.cos(a) * go, z: hero.z + Math.sin(a) * go };
      leg = p.walk(() => aim, 4);
    }
    const now = leg(dt);
    if (now === 'run') return 'run';
    leg = null;
    if (now === 'fail' && ++fails >= FAILS) return 'fail';
    return 'run';
  };
}

export const STORY_ACTIVITY: Activity = {
  id: 'story',
  serves: { story: 1, growth: 0.3, curiosity: 0.2 },
  traits: { curious: 0.3, social: 0.2 },
  budget: 20 * 60, // (it may be a long road)
  options: (p) => {
    const { story } = p.model;
    const out: Target[] = [];
    for (const { who, mark } of story.asking) {
      if (mark === 'waiting') continue;
      const ours = mark === 'ready' ? story.taken.some((t) => t.ready && t.to === who && main(STORY_QUESTS[idOf(t.id)]?.scope)) : story.questsOf(who).some((q) => q.set && q.state === 'offered' && main(q.scope));
      if (ours) out.push({ label: `${who.name}, for the story`, at: whereOf(who), data: { who } });
    }
    for (const t of story.taken) {
      if (!main(STORY_QUESTS[idOf(t.id)]?.scope)) continue;
      if (t.ready && t.to && !out.some((o) => (o.data as { who?: unknown }).who === t.to)) out.unshift({ label: `${t.toName}, to hand in "${t.name}"`, at: t.door ?? whereOf(t.to), data: { who: t.to } }); // (however far: who it's handed in to)
      else if (t.goal) out.push({ label: t.ready ? `back towards ${t.toName}` : `where "${t.name}" leads`, at: t.within ?? t.goal, data: { goal: t.goal, within: t.within } });
    }
    return out.slice(0, 3);
  },
  steps: (p, t) => {
    const data = t.data as { who?: Carter | Npc; goal?: { x: number; z: number }; within?: Entrance | null };
    const way = travel(p, () => t.at ?? p.model.hero);
    if (data.who) return [way, ...speakWith(p, data.who)];
    const goal = data.goal!;
    let waited = 0;
    const stay = (seconds: number): Step => (dt) => ((waited += dt) >= seconds ? 'ok' : 'run'); // (a while there: what it asks there comes of being there)
    if (data.within) return [way, ...p.enter(data.within), stay(20), ...p.leave()]; // (or of the shift the player works)
    return [way, p.walk(() => goal, 2), stay(10)]; // (a place reached; a foe met is fought off on the way)
  },
};
