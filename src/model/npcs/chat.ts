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
import type { Npc } from './npcs';

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
  story: { talk(who: Npc): unknown };
}

// The villager the hero's by, for a word (outdoors, or in the same room; awake or not).
export function villagerInReach(world: Pick<ChatWorld, 'folk' | 'inside' | 'hero'>): Npc | null {
  const { hero, inside } = world;
  let [best, near]: [Npc | null, number] = [null, CHAT_REACH];
  for (const n of world.folk) {
    if (n.role !== 'villager' || n.led || n.where !== (inside?.entrance ?? null)) continue;
    const d = Math.hypot(n.x - hero.x, n.z - hero.z);
    if (d < near) [best, near] = [n, d];
  }
  return best;
}

type Manner = 'warm' | 'gruff' | 'gossip';
const mannerOf = (npc: Npc): Manner => (['warm', 'gruff', 'gossip'] as const)[Math.floor(npc.salt * 3) % 3];

const GREET: Record<Manner, readonly string[]> = {
  warm: ['Well met, traveller! Not many new faces round here.', "Good day to you. You look like you've walked a long way.", 'Hello there! Can I help you with something?', "Ah, a visitor. Welcome, welcome."],
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

const NO_NEWS: readonly string[] = ["Nothing I've heard. Quiet as a grave, and long may it stay so.", "News? The miller's cow had twins. That's all the news there is."];
const WORK = {
  asker: "{who} was asking after help, last I heard. Have a word with them.",
  board: 'The notice board by the inn. Folk pin up what they need doing, and they pay.',
  inn: "The inn's always short of hands. Ask at the board inside about a shift.",
};
const THANKS: readonly string[] = ["Oh, you needn't... well, if you insist. Listen close, then.", 'Generous of you. Here, between us.', 'For a coin? I can do better than gossip.'];

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
      ...ask('news', 'What news?', () => [rumour(world, npc, false) ?? say(NO_NEWS)]),
      ...ask('work', 'Any work going?', () => [workFor(world, npc)]),
      ...ask('place', `Tell me about ${village}`, () => [say(ABOUT[manner]).replace('{village}', village), hourAt(world.minutes) >= 19 || hourAt(world.minutes) < 6 ? say(DANGER) : `It's a level ${zoneLevel(spawnOf(world.size), npc.village)} sort of place, if you follow me. ${say(DANGER)}`]),
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
