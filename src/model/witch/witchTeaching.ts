// What a hedge-witch teaches (npcs.ts: one in about a village in three, at home in her cottage), asked across her
// counter (E: a talk, as the herbalist's salve is, hero/pox.ts): the early charms (spells/charmLore.ts LEARNABLE), each
// for coin and once the hero's grown enough (their level), the mending one for a favour besides (a bat's wing, off the
// caves' vermin: she has a use for it). The rarer one (the Moon-turn) she won't: it's found in the dark (loot/scrolls.ts).
// The turnings she won't hear of. She greets the hero with a scrap of her own story; abed, she doesn't teach.
import type { Talk } from '../story/story';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import type { BagItem } from '../hero/bag';
import { takeFromBag } from '../hero/bag';
import { COPPER_PER_SILVER } from '../hero/money';
import { LOOT } from '../loot/loot';
import { grantCharm } from '../spells/charmLore';
import { SPELLS, knows, type SpellId } from '../spells/spells';
import { oneOf } from '../../util/random';
import { witchAbed } from './witchWork';

export interface Lesson {
  level: number; // the hero's, at the least
  copper: number;
  favour?: BagItem; // brought her, one, as well
}
export const LESSONS: Partial<Record<SpellId, Lesson>> = {
  hex: { level: 3, copper: 150 },
  mend: { level: 5, copper: 400, favour: 'batWing' },
};
export const TAUGHT = Object.keys(LESSONS) as SpellId[];

// "150 copper", "4 silver", "1 silver 50 copper".
const price = (copper: number): string => {
  const [s, c] = [Math.floor(copper / COPPER_PER_SILVER), copper % COPPER_PER_SILVER];
  return s ? `${s} silver${c ? ` ${c} copper` : ''}` : `${c} copper`;
};

// Her greetings: who she is, a scrap at a time.
const HELLO = [
  "Shut the door, you're letting the luck out. What do you want?",
  "They sent me out here when the cows went dry. Twenty years, and the cows are still dry. What d'you want?",
  "Sit if you can find a stool that isn't a cat. What is it?",
  "I knew you'd come today. The salt told me. It also told me you'd be taller.",
  "My mother taught me on a gallows hill, by the light of the man on it. I'll teach you indoors. For coin.",
  "The priest calls me a whore of the Devil. The Devil's never once paid. You, I expect, will.",
  "Don't touch the jar on the left. Or the right. Don't touch the jars.",
];
// Her lessons, given: a word as it's learned.
const TAUGHT_LINES: Record<string, string> = {
  hex: 'Three words. Say them like you mean the bastard harm, because you do. Grave dust helps. Spit helps more.',
  mend: "Thumb on the wound, and the verse under your breath. It'll sting them worse than the cut did. Good. That's it working.",
};
const SHUT = ["It's black as a bishop's arse out there and I'm in bed. Come back at dawn.", "Do you know what I do to folk who wake me? Neither do they, after. Dawn."];
const TURNINGS = "Turn a neighbour into a pig? I could. I won't, and I won't teach it. Do it once in a village and they'll know. They always know. They'll burn the next old woman they find, and it'll be me.";

// What she says when spoken to, and what the hero may ask of her (her lessons not yet had; a turning, which she won't
// teach). `roll`: 0..1, her greeting.
export function witchTalk(model: { hero: Hero; minutes: number }, witch: Pick<Npc, 'name'>, roll = Math.random()): Talk {
  const { hero } = model;
  const says = (line: string): Talk => ({ speaker: witch.name, lines: [line], answers: [{ label: 'Farewell.', out: true, pick: () => {} }, ...asks()] });
  if (witchAbed(model.minutes)) return { speaker: witch.name, lines: [oneOf(SHUT, roll)], answers: [] };
  const lesson = (id: SpellId) => {
    const { level, copper, favour } = LESSONS[id]!;
    return {
      label: `Teach me the ${SPELLS[id].name} (${price(copper)}${favour ? ` and a ${LOOT[favour as keyof typeof LOOT].name.toLowerCase()}` : ''}).`,
      pick: (): Talk => {
        if (hero.level < level) return says(`That one? You'd hex your own foot off. Come back at level ${level}, when you've a bit more blood on you.`);
        if (hero.money < copper) return says(`It's ${price(copper)}. You're ${price(copper - hero.money)} short. I don't teach on tick; the last one who owed me is a newt.`);
        if (favour && !(hero.bag[favour] ?? 0)) return says(`Coin's not all. Bring me a ${LOOT[favour as keyof typeof LOOT].name.toLowerCase()}: the caves are thick with bats. Don't ask what it's for.`);
        hero.money -= copper;
        if (favour) takeFromBag(hero.bag, favour);
        return says(`${TAUGHT_LINES[id]} ${grantCharm(hero, id)}`);
      },
    };
  };
  const asks = () => [...TAUGHT.filter((id) => !knows(hero, id)).map(lesson), { label: 'Teach me to turn someone into a beast.', pick: (): Talk => says(TURNINGS) }];
  const left = TAUGHT.filter((id) => !knows(hero, id));
  const offer = left.length ? `I can teach you ${left.map((id) => `the ${SPELLS[id].name} (level ${LESSONS[id]!.level})`).join(' and ')}.` : "You've had all I'll teach. The rest is written down in the dark, in crypts and caves, on the dead.";
  return { speaker: witch.name, lines: [oneOf(HELLO, roll), offer], answers: [{ label: 'Farewell.', out: true, pick: () => {} }, ...asks()] };
}
