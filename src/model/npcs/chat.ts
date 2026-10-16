// A word with any villager (E by them, outdoors or in the same room): a greeting in their own manner (warm, gruff or a
// gossip, by who they are; by the hour: woken in bed, short; at work in the fields, shorter), and what the hero may ask:
// the news (a rumour of the nearest danger they've heard of still standing: a camp, a crypt, a cave, which way and how
// far, and how dangerous for the hero), work (the notice board, the inn, someone of theirs with a quest to give),
// the village itself; a coin pressed on them for their trouble (CHAT_TIP): something more exact; and farewell. Each
// answer said, the questions come back, the one asked gone.

import { bearing } from '../travellers/travellerTalk';
import { inMeters } from '../quests/quests';
import { campName, } from '../camps/campNames';
import { campLevel } from '../camps/camps';
import { hourAt, between } from '../clock';
import { villageName } from '../villages/villageNames';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';
import { oneOf } from '../../util/random';
import type { Talk } from '../story/story';
import type { Inside } from '../interiors/indoors';
import type { Camp } from '../camps/camps';
import type { Crypt } from '../crypts/crypts';
import type { Cave } from '../caves/caves';
import type { Entrance } from '../interiors/interiors';
import type { Hero } from '../types';
import type { NpcRole, Npc } from './npcs';

export const CHAT_REACH = 1.7; // tiles from a villager, for a word
export const CHAT_TIP = 5; // copper pressed on them for something more exact
const HEARD_OF = 260; // tiles: as far off as a villager's heard of danger

export interface ChatWorld {
  hero: Hero;
  seed: number;
  size: MapSize;
  minutes: number;
  inside: Inside | null;
  folk: readonly Npc[];
  camps: readonly Camp[];
  crypts: readonly Crypt[];
  caves: readonly Cave[];
  campLife: { empty(camp: Camp): boolean };
  clearedShare(entrance: Entrance): number;
  story: { talk(who: Npc): unknown; did?(id: string): boolean; saint?: { act: number; ending: string | null; witch: string | null }; people?: { village: object } | null };
}

// The villager the hero's by, for a word (outdoors, or in the same room; awake or not).
export function villagerInReach(world: Pick<ChatWorld, 'folk' | 'inside' | 'hero'>): Npc | null {
  const { hero, inside } = world;
  let [best, near]: [Npc | null, number] = [null, CHAT_REACH];
  for (const n of world.folk) {
    if (!OUT_AND_ABOUT.has(n.role) || n.led || n.where !== (inside?.entrance ?? null)) continue;
    const d = Math.hypot(n.x - hero.x, n.z - hero.z) - (n.stall ? ACROSS_STALL : 0);
    if (d < near) [best, near] = [n, d];
  }
  return best;
}
const ACROSS_STALL = 0.5; // tiles a stall's keeper is the nearer, across their counter (before anyone passing behind the hero)
// Who's spoken to out and about (or in their own house): villagers, the cathedral town's stall keepers (their trade:
// town/stallKeepers.ts) and its captain at his gate, the sister in her hospice (town/townCallings.ts).
const OUT_AND_ABOUT: ReadonlySet<NpcRole> = new Set(['villager', 'monger', 'pardoner', 'captain', 'sister']);

type Manner = 'warm' | 'gruff' | 'gossip';
const mannerOf = (npc: Npc): Manner => (['warm', 'gruff', 'gossip'] as const)[Math.floor(npc.salt * 3) % 3];

const GREET: Record<Manner, readonly string[]> = {
  warm: ['Well met, traveller! Not many new faces round here.', "Good day to you. You look like you've walked a long way.", "Hail. You've come a long way, by the state of your boots.", "Ah, a visitor. Welcome, welcome."],
  gruff: ["What d'you want?", 'Make it quick. Work to do.', "Hm. You're not from here.", "If you're selling something, I'm not buying."],
  gossip: ["Oh! You're the one everyone's talking about. Or you will be.", "Come here, come here. Have you heard?", "You've the look of someone with a story. I love a story.", "Don't tell anyone I said so, but you're the most interesting thing that's happened all week."],
};
const WOKEN: readonly string[] = ['Mmph... what? Is something on fire?', "It's the middle of the night. Go away.", "Who's there? ...Oh, it's you. What?", "Can't a body sleep in peace?"];
const AT_WORK: readonly string[] = ["Can't stop long, these rows won't weed themselves.", 'Mind the crop. What is it?', "Talk while I work, then. What's on your mind?"];
const BACK: Record<Manner, readonly string[]> = {
  warm: ['You again! Always a pleasure.', 'Back so soon? Good to see you.'],
  gruff: ['You again.', 'Still here?'],
  gossip: ["Back for more? I've heard all sorts since.", 'There you are! Sit, sit.'],
};

const ABOUT: Record<Manner, readonly string[]> = {
  warm: ["{village}'s a good place. Honest folk, decent ale, and the well's never run dry.", "We look after each other in {village}. Mostly."],
  gruff: ["{village}. Fields, mud, the inn. That's it.", "Nothing to see in {village}. Never was."],
  gossip: ["{village}? Oh, the things that go on behind these shutters. You wouldn't believe me.", "Everyone in {village} knows everyone's business. Mostly mine, since I tell them."],
};
const DANGER = ['Quiet hereabouts. Wolves at night, nothing worse.', 'Keep to the roads after dark, mind.', "It's rough country once you're past the fields.", "Folk who wander off the roads here don't always come back."];

// The story's news, as far as it's got (story/quests/firstQuests*.ts): the first village's line, told by its own folk
// (the latest of it they've seen), by their manner; and the second arc's, heard of everywhere (the pedlars carry it:
// travellers/pedlarNews.ts), by its act, the chained witch and how it ended.
const LINE: ReadonlyArray<[string, Record<Manner, string>]> = [
  ['theLongRoad', {
    warm: "The carter's gone. Drove off with the men in grey behind him and a saint in a silk bag. Waved to everybody. He's never waved in his life.",
    gruff: "Carter's gone south with the churchmen. Took a bone in a bag. A finger, the herbalist says, and laughs. First time I've heard her laugh.",
    gossip: "Have you heard? The bishop's new saint is a deacon's finger with a hole in it. They'll be kissing it in gold. I may wet myself.",
  }],
  ['campedInTheAshes', {
    warm: 'Men in grey on the hill, where the bandits were. Keep your voice down near the well, love.',
    gruff: "Churchmen camped in the bandits' ashes. Counting us. Let them count.",
    gossip: "The men in grey sleep under their cart. Under it! Like dogs. The miller's wife took them a pie and came back very quiet.",
  }],
  ['aBarrelForMaren', {
    warm: "We drank to Maren last night. By name, out loud. Thirty years too late, but we did it.",
    gruff: "Half the village drank to a witch last night. The other half watched from behind their shutters. I did both.",
    gossip: "The wake! Nobody sang, nobody fought, and old Hob nearly said something he oughtn't. Then the man on the door looked at him.",
  }],
  ['readToHer', {
    warm: "Father Aldous ordered the burning. It was in the reeve's book, read out in the square. My mother went to his masses every Sunday.",
    gruff: "Father Aldous. Buried under the altar like a lord. I threw a stone. Don't tell my wife.",
    gossip: "She was carrying the priest's child! Maren was! And he burned her for saying so. I always said he had wandering hands.",
  }],
  ['wordToTheInn', {
    warm: "The carter's wagon broke down on the trail, poor man. Somebody stopped for him, for once. You, was it?",
    gruff: "Carter's stuck on the trail with the inn's ale. Bandits'll have it by Sunday. And him.",
    gossip: "That carter's lost his wheel again. Third wagon this year. They found the last one in bits, you know. In bits!",
  }],
];
const WITCH: Record<string, readonly string[]> = {
  freed: ["A hedge-witch slipped her chain up the north road. Somebody kicked the staple clean out of the wall. Good luck to her.", "The greycoats are turning over every hen-house for a witch. Somebody let her loose. Wasn't me. Wish it was."],
  handed: ["Some stranger sold a hedge-witch to the greycoats for two silver. Two silver! I'd want five.", "They carted a witch south. A stranger handed her in, for two silver. Wonder if they sleep."],
};
const ACT: Record<number, readonly string[]> = {
  2: ['The greycoats are chaining hedge-witches up the north road. Whole villages watching, and nobody saying a word.'],
  3: ["Everybody's walking to Greyminster for the new saint. My aunt went with a bad leg. Came back with a bad leg and no money.", 'They say the saint in Greyminster heals anything. Anything you can pay for.'],
};
const ENDED: Record<string, readonly string[]> = {
  exposed: ["A bishop in the stocks! In Greyminster! My cousin threw a cabbage. He's never thrown straight in his life, and he hit him.", "They put the bishop in the stocks over a pig's knuckle. A saint made of pork. I've not stopped laughing."],
  kept: ['The miracles stopped in Greyminster, but the pilgrims still go. Faith is a stubborn mule.', "The saint's stopped healing. The bishop's started charging more. That's the church."],
};
function storyNews(world: ChatWorld, npc: Npc, manner: Manner, say: (lines: readonly string[]) => string): string[] {
  const { did, saint, people } = world.story;
  const ours = people && people.village === npc.village ? LINE.find(([id]) => did?.(id)) : undefined;
  const wide = !saint || saint.act < 2 ? null : saint.act >= 4 && saint.ending ? say(ENDED[saint.ending] ?? []) : saint.act === 2 && saint.witch && WITCH[saint.witch] ? say(WITCH[saint.witch]) : say(ACT[Math.min(saint.act, 3)] ?? []);
  return [...(ours ? [ours[1][manner]] : []), ...(wide ? [wide] : [])];
}

const NO_NEWS: readonly string[] = ["Nothing I've heard. Quiet as a grave, and long may it stay so.", "News? The miller's cow had twins. That's all the news there is."];
const WORK = {
  asker: "{who} was asking after help, last I heard. Have a word with them.",
  board: 'The notice board by the inn. Folk pin up what they need doing, and they pay.',
  inn: "The inn's always short of hands. Ask at the board inside about a shift.",
};
const THANKS: readonly string[] = ["Oh, you needn't... well, if you insist. Listen close, then.", 'Generous of you. Here, between us.', 'For a coin? I can do better than gossip.'];

// How hard the country is about the village (its foes' level, enemyLevels.ts), as a villager would put it.
const countryOf = (level: number): string =>
  level <= 2 ? "Quiet country, this. You'll not find worse than a wolf." : level <= 5 ? "Rough country, if you follow me." : level <= 10 ? 'Hard country. Folk here bury their own, and early.' : level <= 20 ? "Bad country. The dead outnumber us, and they're less trouble." : "Country the crows won't cross. I'd not be here, if I'd legs to leave.";

// Which way and how far, and how dangerous for the hero.
const told = (from: { x: number; z: number }, to: { x: number; z: number }, exact: boolean) => {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  return exact ? `${inMeters(d)} ${bearing(from, to)} of here` : d < 80 ? `not far ${bearing(from, to)}` : `off to the ${bearing(from, to)}`;
};
const dread = (level: number, hero: number) => (level >= hero + 3 ? "It'd be the death of you, I'd wager." : level <= hero - 3 ? "You'd make short work of them, by the look of you." : 'Could go either way, for one like you.');

// The nearest danger still standing they'd have heard of, as their rumour: words, and how dangerous.
function rumour(world: ChatWorld, npc: Npc, exact: boolean): string | null {
  const from = npc.village;
  const near: Array<{ d: number; text: string }> = [];
  const heard = (at: { x: number; z: number }, text: (where: string) => string, level: number) => {
    const d = Math.hypot(at.x - from.x, at.z - from.z);
    if (d <= HEARD_OF) near.push({ d, text: `${text(told(from, at, exact))}${exact ? ` Level ${level}, they say. ${dread(level, world.hero.level)}` : ''}` });
  };
  for (const camp of world.camps) if (!world.campLife.empty(camp)) heard(camp, (w) => `Bandits have a camp ${w}. ${capital(campName(camp, world.seed))}, they call it.`, campLevel(camp, world.size));
  for (const crypt of world.crypts) if (world.clearedShare(crypt.entrance) < 1) heard(crypt.middle, (w) => `There's ${crypt.name} ${w}. The dead don't rest easy there.`, crypt.level);
  for (const cave of world.caves) if (world.clearedShare(cave.entrance) < 1) heard(cave.mouth, (w) => `Something's made its home in ${cave.name}, ${w}. Nobody goes in.`, cave.level);
  near.sort((a, b) => a.d - b.d);
  const pick = near[exact ? 0 : Math.min(near.length - 1, Math.floor(npc.salt * 97) % 2)];
  return pick?.text ?? null;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const met = new WeakMap<Npc, number>(); // (talked with before: how many times)

// A word with `npc`: their greeting, and what the hero may ask.
export function chat(world: ChatWorld, npc: Npc, roll: () => number = Math.random): Talk {
  const manner = mannerOf(npc);
  const times = met.get(npc) ?? 0;
  met.set(npc, times + 1);
  const asleep = !!npc.seat?.lying && between(world.minutes, 22, 6);
  const say = (lines: readonly string[]) => oneOf(lines, roll());
  const village = villageName(npc.village, world.seed);
  const greet = asleep ? say(WOKEN) : npc.working ? say(AT_WORK) : times > 0 ? say(BACK[manner]) : say(GREET[manner]);
  const asked = new Set<string>();
  const talk = (lines: string[]): Talk => ({ speaker: npc.name, lines, answers: questions() });
  const questions = (): Talk['answers'] => {
    const ask = (key: string, label: string, answer: () => string[]) => (asked.has(key) ? [] : [{ label, pick: (): Talk => (asked.add(key), talk(answer())) }]);
    const tip = world.hero.money >= CHAT_TIP && !asked.has('tip') && !asleep;
    return [
      ...ask('news', 'What news?', () => {
        const told = storyNews(world, npc, manner, say);
        const heard = rumour(world, npc, false);
        return [...told, ...(heard ? [heard] : told.length ? [] : [say(NO_NEWS)])];
      }),
      ...ask('work', 'Any work going?', () => [workFor(world, npc)]),
      ...ask('place', `Tell me about ${village}`, () => [say(ABOUT[manner]).replace('{village}', village), hourAt(world.minutes) >= 19 || hourAt(world.minutes) < 6 ? say(DANGER) : `${countryOf(zoneLevel(spawnOf(world.size), npc.village))} ${say(DANGER)}`]),
      ...(tip ? [{ label: `Press a coin on them · ${CHAT_TIP} copper`, pick: (): Talk => {
        world.hero.money -= CHAT_TIP;
        asked.add('tip');
        return talk([say(THANKS), rumour(world, npc, true) ?? "Truth is, there's nothing out there worth the walk. Keep your coin."]);
      } }] : []),
      { label: 'Farewell', out: true, pick: () => {} },
    ];
  };
  return { speaker: npc.name, lines: [greet], answers: questions() };
}

// Where to look for work, as they'd tell it: someone of theirs with a quest to give, else the board, else the inn.
function workFor(world: ChatWorld, npc: Npc): string {
  const asker = world.folk.find((n) => n !== npc && n.village === npc.village && n.role === 'villager' && world.story.talk(n));
  if (asker) return WORK.asker.replace('{who}', asker.name);
  return npc.salt < 0.5 ? WORK.board : WORK.inn;
}
