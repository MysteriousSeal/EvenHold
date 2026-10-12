// The quests people give, and how they stand (storyQuests.ts: each written by hand). Someone with one to give has a
// "!" over their head; taken, whoever it's handed in to has a "?" (grey while there's still something to do, gold once
// it's ready); a word with either (E) opens the talk window (controller/story/talkPanel.ts), which shows what `talk`
// says: their lines, and the hero's answers. Taken ones show on the tracker and in the journal. Saved with the game.
import { gainXp, xpToNext } from '../hero/heroStats';
import type { Entrance } from '../interiors/interiors';
import { spawnOf, type MapSize } from '../map/grid';
import type { Npc } from '../npcs/npcs';
import type { Scenery } from '../scenery/scenery';
import type { GameEvent, Hero, Village } from '../types';
import { villageName } from '../villages/villageNames';
import { carterOf, type Carter } from '../wayside/carter';
import { STORY_QUESTS, STORY_QUEST_IDS, type StoryQuest, type StoryQuestId, type StoryRole, type Told } from './storyQuests';

export type StoryMark = 'offer' | 'waiting' | 'ready'; // "!", a grey "?", a gold "?"
export type Who = Carter | Npc;
export interface Talk {
  speaker: string;
  lines: string[];
  quest?: { name: string; task: string; copper: number; xp: number; state: 'offered' | 'handIn' }; // the quest it's about, shown under the lines
  answers: Array<{ label: string; primary?: boolean; pick(): void }>; // the hero's (none: just "Farewell")
}

const CARTER_REACH = 1.7; // tiles from the carter, for a word
const INN_NEAR = 8; // tiles from a village's middle its inn stands within

export interface StoryHost {
  readonly seed: number;
  readonly size: MapSize;
  readonly hero: Hero;
  readonly villages: readonly Village[];
  readonly entrances: readonly Entrance[];
  readonly npcs: readonly Npc[];
  readonly scenery: readonly Scenery[];
  readonly inside: unknown;
  readonly quests?: { trackRoom: boolean }; // the boards' quests: whether the screen takes one more tracked
  report(event: GameEvent): void;
}

interface Cast {
  carter: Carter;
  barmaid: Npc;
  village: Village;
  inn: Entrance;
}

export class Story {
  private state = new Map<StoryQuestId, 'taken' | 'done'>();
  private untracked = new Set<StoryQuestId>(); // those taken but kept off the screen's tracker (set in the journal)
  private cast: { key: string; cast: Cast | null } | null = null; // (found again only as the world about changes)

  constructor(private readonly host: StoryHost) {}

  // Who's who, once they're all on the maps (a streamed world's: near the start): the carter, the nearest village to
  // where the hero set out, its inn and its barmaid.
  get people(): Cast | null {
    const { host } = this;
    const key = `${host.villages.length}|${host.entrances.length}|${host.npcs.length}|${host.scenery.length}`;
    if (this.cast?.key === key) return this.cast.cast;
    const spawn = spawnOf(host.size);
    const near = <T extends { x: number; z: number }>(list: readonly T[], to: { x: number; z: number }) => list.reduce<T | null>((best, v) => (!best || Math.hypot(v.x - to.x, v.z - to.z) < Math.hypot(best.x - to.x, best.z - to.z) ? v : best), null);
    const carter = carterOf(host);
    const village = near(host.villages, spawn);
    const inn = village && near(host.entrances.filter((e) => e.type === 'inn' && Math.hypot(e.x - village.x, e.z - village.z) <= INN_NEAR), village);
    const barmaid = inn && host.npcs.find((n) => n.role === 'barkeep' && n.home === inn);
    const cast = carter && village && inn && barmaid ? { carter, village, inn, barmaid } : null;
    this.cast = { key, cast };
    return cast;
  }

  private who(role: StoryRole): Who | null {
    const cast = this.people;
    return cast ? (role === 'carter' ? cast.carter : cast.barmaid) : null;
  }

  private told(): Told | null {
    const cast = this.people;
    return cast ? { village: villageName(cast.village, this.host.seed), barmaid: cast.barmaid.name, carter: cast.carter.name } : null;
  }

  stateOf(id: StoryQuestId): 'offered' | 'taken' | 'done' {
    return this.state.get(id) ?? 'offered';
  }

  // What a quest pays in experience (a share of the first level's).
  xpOf(quest: StoryQuest): number {
    return Math.round(xpToNext(1) * quest.xpShare);
  }

  // Whether what a taken quest asks is done, bar handing it in (this first one: only the walk there).
  private ready(_quest: StoryQuest): boolean {
    return true;
  }

  // The mark over `who`'s head, if any: a quest of theirs to hand in before one to give.
  markOf(who: Who): StoryMark | null {
    let mark: StoryMark | null = null;
    for (const id of STORY_QUEST_IDS) {
      const quest = STORY_QUESTS[id];
      const state = this.stateOf(id);
      if (state === 'taken' && this.who(quest.receiver) === who) return this.ready(quest) ? 'ready' : 'waiting';
      if (state === 'offered' && this.who(quest.giver) === who) mark = 'offer';
    }
    return mark;
  }

  // The carter, near enough for a word (outdoors, by his wagon).
  get carterInReach(): Carter | null {
    const carter = this.host.inside ? null : this.people?.carter;
    return carter && Math.hypot(carter.x - this.host.hero.x, carter.z - this.host.hero.z) <= CARTER_REACH ? carter : null;
  }

  // What `who` has to say now, and what the hero may answer; null: nothing of the story's (their own trade, if any).
  talk(who: Who): Talk | null {
    const t = this.told();
    if (!t) return null;
    const speaker = who.name;
    for (const id of STORY_QUEST_IDS) {
      const quest = STORY_QUESTS[id];
      const state = this.stateOf(id);
      const about = (s: 'offered' | 'handIn') => ({ name: quest.name, task: quest.task(t), copper: quest.copper, xp: this.xpOf(quest), state: s });
      if (state === 'taken' && this.who(quest.receiver) === who && this.ready(quest)) {
        return { speaker, lines: quest.handIn(t), quest: about('handIn'), answers: [{ label: quest.thanks, primary: true, pick: () => this.handIn(id) }] };
      }
      if (this.who(quest.giver) !== who) continue;
      if (state === 'offered') {
        return { speaker, lines: quest.offer(t), quest: about('offered'), answers: [{ label: quest.accept, primary: true, pick: () => this.accept(id) }, { label: quest.decline, pick: () => {} }] };
      }
      return { speaker, lines: state === 'taken' ? quest.waiting(t) : quest.after(t), answers: [] };
    }
    return null;
  }

  // Those under way and tracked on screen: how many.
  get trackedCount(): number {
    return STORY_QUEST_IDS.filter((id) => this.isTracked(id)).length;
  }

  isTracked(id: StoryQuestId): boolean {
    return this.stateOf(id) === 'taken' && !this.untracked.has(id);
  }

  // Tracks a quest taken, or stops; returns whether it's as asked (not with the screen full).
  setTracked(id: StoryQuestId, on: boolean): boolean {
    if (this.stateOf(id) !== 'taken') return false;
    if (on && !this.isTracked(id) && this.host.quests && !this.host.quests.trackRoom) return false;
    on ? this.untracked.delete(id) : this.untracked.add(id);
    return true;
  }

  accept(id: StoryQuestId): boolean {
    if (this.stateOf(id) !== 'offered') return false;
    const room = this.host.quests?.trackRoom ?? true; // (tracked, if there's room)
    this.state.set(id, 'taken');
    room ? this.untracked.delete(id) : this.untracked.add(id);
    const { hero } = this.host;
    this.host.report({ kind: 'quest', text: `Quest taken: ${STORY_QUESTS[id].name}`, done: false, x: hero.x, y: hero.y, z: hero.z });
    return true;
  }

  // Let go: on offer again from whoever gave it (their "!" back over them), to be taken up afresh.
  abandon(id: StoryQuestId): boolean {
    if (this.stateOf(id) !== 'taken') return false;
    this.state.delete(id);
    this.untracked.delete(id);
    return true;
  }

  // Handed in: paid (coin, experience), and done for good.
  handIn(id: StoryQuestId): boolean {
    const quest = STORY_QUESTS[id];
    if (this.stateOf(id) !== 'taken' || !this.ready(quest)) return false;
    this.state.set(id, 'done');
    const { hero } = this.host;
    hero.money += quest.copper;
    gainXp(hero, this.xpOf(quest));
    this.host.report({ kind: 'coins', amount: quest.copper });
    this.host.report({ kind: 'quest', text: `${quest.name}: done`, done: true, x: hero.x, y: hero.y, z: hero.z });
    return true;
  }

  // Those under way, for the tracker and the journal: what's to do, who to, and where they are (their building's door).
  get taken(): Array<{ id: StoryQuestId; name: string; task: string; ready: boolean; tracked: boolean; to: Npc | Carter; from: Npc | Carter; door: Entrance | null }> {
    const t = this.told();
    const cast = this.people;
    if (!t || !cast) return [];
    return STORY_QUEST_IDS.filter((id) => this.stateOf(id) === 'taken').map((id) => {
      const quest = STORY_QUESTS[id];
      const to = this.who(quest.receiver)!;
      return { id, name: quest.name, task: quest.task(t), ready: this.ready(quest), tracked: this.isTracked(id), to, from: this.who(quest.giver)!, door: to === cast.barmaid ? cast.inn : null };
    });
  }

  // Those done, for the journal.
  get done(): StoryQuest[] {
    return STORY_QUEST_IDS.filter((id) => this.stateOf(id) === 'done').map((id) => STORY_QUESTS[id]);
  }

  save(): Record<string, 'taken' | 'untracked' | 'done'> {
    return Object.fromEntries([...this.state].map(([id, s]) => [id, s === 'taken' && this.untracked.has(id) ? 'untracked' : s])); // (untracked: taken, kept off the tracker)
  }

  load(data: Record<string, unknown> | undefined): void {
    const kept = Object.entries(data ?? {}).filter((e): e is [StoryQuestId, 'taken' | 'untracked' | 'done'] => e[0] in STORY_QUESTS && (e[1] === 'taken' || e[1] === 'untracked' || e[1] === 'done'));
    this.state = new Map(kept.map(([id, s]) => [id, s === 'done' ? 'done' : 'taken']));
    this.untracked = new Set(kept.filter(([, s]) => s === 'untracked').map(([id]) => id));
  }
}
