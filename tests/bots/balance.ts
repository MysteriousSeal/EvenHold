// What a bot's game says about the balance (npm run bots writes it up,
// balanceReport.ts): how it levelled, every fight (what, how long, how much
// it hurt), every fall, every quest from taking it to handing it in, where
// its coin came from and went, and how many foes were about, minute by minute.
import type { GameModel } from '../../src/model/GameModel';
import { maxHpOf } from '../../src/model/hero/attributes';
import { xpToNext } from '../../src/model/hero/heroStats';
import { ITEMS, type ItemId } from '../../src/model/human/equipment';

export interface Fight {
  kind: string;
  foeLevel: number;
  heroLevel: number;
  seconds: number; // from first in reach to its fall (or giving up)
  hurt: number; // the hero's health lost meanwhile, as a share of theirs (0–1)
  won: boolean;
}

export interface Fall {
  t: number;
  heroLevel: number;
  by: string[]; // the foes about ("wolf 3")
}

export interface QuestRun {
  key: string;
  kind: string;
  foe: string;
  count: number;
  level: number;
  heroLevel: number; // at taking it
  taken: number; // game seconds
  done: number | null; // handed in
  outcome: 'done' | 'given up' | 'out of reach' | 'open';
  xp: number;
  copper: number;
}

export interface Minute {
  t: number; // game minutes
  level: number;
  xp: number; // all it's earned so far
  money: number;
  kills: number;
  deaths: number;
  questsDone: number;
  gear: number; // armour and stats worn, together
  foesNear: number; // alive within 40 tiles
  foesClose: number; // within 15
}

export interface BalanceData {
  minutes: Minute[];
  levelAt: number[]; // game seconds each level was reached (index: level)
  fights: Fight[];
  falls: Fall[];
  quests: QuestRun[];
  income: Record<string, number>; // copper by where it came from
  spent: Record<string, number>; // by what on
  xpFrom: Record<string, number>; // experience by where it came from
  foeKinds: Record<string, number>; // foe-seconds within 40 tiles, by kind (how much of each was about)
}

const gearOf = (model: GameModel) =>
  Object.values(model.hero.equipment).reduce((sum, id) => sum + (id ? (ITEMS[id as ItemId].armor ?? 0) + Object.values(ITEMS[id as ItemId].stats ?? {}).reduce((a, b) => a + b, 0) : 0), 0);

export class Balance {
  readonly data: BalanceData = { minutes: [], levelAt: [0, 0], fights: [], falls: [], quests: [], income: {}, spent: {}, xpFrom: {}, foeKinds: {} };
  private xpEarned = 0;
  private seen = 1; // the level last seen
  private t = 0; // game seconds

  constructor(private readonly model: GameModel) {}

  // Once a game second: the clock, levels reached, foes about; once a game minute, how it stands.
  sample(t: number, stats: { kills: number; deaths: number; questsDone: number }): void {
    this.t = t;
    const { hero } = this.model;
    while (this.seen < hero.level) this.data.levelAt[++this.seen] = Math.round(t);
    let [near, close] = [0, 0];
    for (const e of this.model.enemies) {
      if (e.state === 'dead') continue;
      const d = Math.max(Math.abs(e.x - hero.x), Math.abs(e.z - hero.z));
      if (d > 40) continue;
      near++;
      if (d <= 15) close++;
      this.data.foeKinds[e.kind] = (this.data.foeKinds[e.kind] ?? 0) + 1;
    }
    if (Math.floor(t) % 60 !== 0) return;
    this.data.minutes.push({ t: Math.round(t / 60), level: hero.level, xp: this.xpEarned, money: hero.money, gear: gearOf(this.model), foesNear: near, foesClose: close, ...stats });
  }

  // Experience gained (`from`: kills, quests), measured around what gave it.
  xp(from: string, before: { level: number; xp: number }): void {
    const { hero } = this.model;
    // (across a level up the bar starts again: counted from all it took to get there)
    const total = (level: number, xp: number) => Array.from({ length: level - 1 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0) + xp;
    const gained = total(hero.level, hero.xp) - total(before.level, before.xp);
    if (gained <= 0) return;
    this.xpEarned += gained;
    this.data.xpFrom[from] = (this.data.xpFrom[from] ?? 0) + gained;
  }

  // Coin in (positive) or out, by what for.
  coin(what: string, amount: number): void {
    if (amount > 0) this.data.income[what] = (this.data.income[what] ?? 0) + amount;
    else if (amount < 0) this.data.spent[what] = (this.data.spent[what] ?? 0) - amount;
  }

  fight(fight: Omit<Fight, 'heroLevel'>): void {
    this.data.fights.push({ ...fight, heroLevel: this.model.hero.level });
  }

  // A fall, and the foes that were about just before ("wolf 3").
  fell(by: string[]): void {
    this.data.falls.push({ t: Math.round(this.t), heroLevel: this.model.hero.level, by });
  }

  questTaken(quest: { key: string; kind: string; foe: string; count: number; level: number; xp: number; copper: number }): void {
    this.data.quests.push({ key: quest.key, kind: quest.kind, foe: quest.foe, count: quest.count, level: quest.level, heroLevel: this.model.hero.level, taken: Math.round(this.t), done: null, outcome: 'open', xp: quest.xp, copper: quest.copper });
  }

  questEnded(key: string, outcome: QuestRun['outcome']): void {
    const run = [...this.data.quests].reverse().find((q) => q.key === key && q.outcome === 'open');
    if (!run) return;
    run.outcome = outcome;
    if (outcome === 'done') run.done = Math.round(this.t);
  }

  // The hero's health now, as a share of theirs.
  health(): number {
    return this.model.hero.hp / maxHpOf(this.model.hero);
  }
}
