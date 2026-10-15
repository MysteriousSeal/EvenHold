// A word with the witch-finders (patrols.ts): their leader's questions, by what they've heard of the hero
// (heat.ts `known`), and the hero's answers, each with its consequence:
//  - a lie: passes by a chance that falls as the heat rises (LIE); caught in it, they mean to take the hero;
//  - a bribe ("for the poor box"): dearer the more they've heard; they go on, and the word's a little quieter;
//  - a run: they're after the hero to seize them (outrun them, and the word of it goes round);
//  - a fight: they're foes, and the word of it goes round the more;
//  - going quietly (once they mean to take them): the stocks (arrest.ts), the fine as it stands.
// Heard nothing of them: a nod, and they go on.
import { villageName } from '../villages/villageNames';
import type { Talk } from '../story/storyTypes';
import type { GameModel } from '../GameModel';
import type { Traveller } from '../travellers/travellers';
import { SEIZE, WANTED } from './heat';
import { arrestFor, arrestTalk } from './arrest';
import type { Party } from './patrols';
import { say } from '../npcs/speech';

const BRIBE = 15; // copper a point of heat, and BRIBE_LEVEL a level of the hero's
const BRIBE_LEVEL = 6;
const CAUGHT_BRIBE = 2; // the bribe, once they mean to take the hero
const CALMED = 1; // heat off where they are, a bribe taken

// The chance a lie passes, at a heat.
export const lieChance = (heat: number): number => Math.max(0.1, Math.min(0.95, 1.05 - 0.17 * heat));
// A bribe, at a heat and the hero's level.
export const bribeFor = (heat: number, level: number, caught = false): number => Math.round((BRIBE * Math.max(1, heat) + BRIBE_LEVEL * level) * (caught ? CAUGHT_BRIBE : 1));
const odds = (p: number): string => (p >= 0.8 ? 'likely' : p >= 0.55 ? 'a fair chance' : p >= 0.35 ? 'chancy' : 'hardly');

const NODS = ['Bless you, traveller. Keep from the old craft.', 'The Saint keeps the road. Mostly.', 'Nothing to see. Unless you saw a witch.', 'Move along. Pray a little.'];

// What a word with `t` comes to: a party's questions, or (heard nothing, or none of a party) a nod in passing (null).
export function questioning(model: GameModel, t: Traveller): Talk | null {
  const party = [...model.roads.patrols.parties.values()].find((p) => p.members.includes(t)) ?? null;
  const heat = model.heat.known(t);
  if (!party || heat === 0) {
    say(t, NODS[Math.floor(model.minutes / 7) % NODS.length]);
    if (party) model.roads.patrols.letGo(party);
    return null;
  }
  party.coming = true; // (stood for the word, till it's had)
  for (const m of party.members) m.off ??= { x: m.x, z: m.z };
  model.roads.patrols.stopped = party;
  return heat >= SEIZE ? caught(model, party, heat, true) : asked(model, party, heat);
}

function asked(model: GameModel, party: Party, heat: number): Talk {
  const { hero } = model;
  const [leader] = party.members;
  const village = model.heat.nearest(leader);
  const where = village ? villageName(village, model.seed) : 'the villages';
  const lie = lieChance(heat);
  const bribe = bribeFor(heat, hero.level);
  const lines = heat >= WANTED
    ? ["Hold there. In the bishop's name.", `They say in ${where} a stranger turned a decent man into livestock. They say a lot in ${where}. Turn out your pack.`]
    : ['A word, friend. Any charms about you? Feathers, grave dust, little bones?', `There's talk of the old craft round ${where}. Only talk, I'm sure.`];
  return {
    speaker: leader.name,
    lines,
    answers: [
      { label: `Lie: "Not I, sir. A plain traveller." (${odds(lie)})`, primary: true, pick: () => (model.random() < lie ? passed(model, party) : caught(model, party, heat, false)) },
      ...(hero.money >= bribe ? [{ label: `"For the poor box": slip them ${bribe} copper`, pick: () => bribed(model, party, bribe) }] : []),
      { label: 'Run for it', pick: () => void ran(model, party) },
      { label: 'Fight them', out: true, pick: () => void fought(model, party) },
    ],
  };
}

// Caught in a lie, or wanted on sight: they mean to take the hero.
function caught(model: GameModel, party: Party, heat: number, onSight: boolean): Talk {
  const { hero } = model;
  const [leader] = party.members;
  const bribe = bribeFor(heat, hero.level, true);
  const arrest = arrestFor(model);
  return {
    speaker: leader.name,
    lines: onSight
      ? ["That's the one. Take hold of them.", `You're for the stocks. A day of it, and ${arrest.fine} copper. Thank the bishop it isn't the stake.`]
      : ['Liar. It is all over your face.', `You'll come with us. A day in the stocks, and ${arrest.fine} copper to the poor box.`],
    answers: [
      { label: 'Go quietly', primary: true, pick: () => (model.roads.patrols.letGo(party), arrestTalk(model, arrest, leader.name, 'quietly')) },
      ...(hero.money >= bribe ? [{ label: `"A bigger gift for the poor box": ${bribe} copper`, pick: () => bribed(model, party, bribe) }] : []),
      { label: 'Run for it', pick: () => void ran(model, party) },
      { label: 'Fight them', out: true, pick: () => void fought(model, party) },
    ],
  };
}

function passed(model: GameModel, party: Party): Talk {
  model.roads.patrols.letGo(party);
  return { speaker: party.members[0].name, lines: ['Hm. On your way, then. And keep your hands where the Saint can see them.'], answers: [] };
}

function bribed(model: GameModel, party: Party, copper: number): Talk {
  model.hero.money -= copper;
  model.heat.calm(party.members[0], CALMED);
  model.roads.patrols.letGo(party);
  return { speaker: party.members[0].name, lines: ['The poor will bless you. So will I, tonight, at the inn. Go on.'], answers: [] };
}

function ran(model: GameModel, party: Party): void {
  say(party.members[0], 'After them! Alive, mind!');
  model.roads.patrols.hunt(party, 'seize');
}

function fought(model: GameModel, party: Party): void {
  say(party.members[0], 'Witch! To arms!');
  model.heat.raise(party.members[0], 2, "drew on the bishop's men");
  model.roads.patrols.hunt(party, 'fight');
}
