// What a quest under way sends the hero for, still there to be had (story.ts looks to it every couple of seconds,
// out of doors). The dead of the world stay dead (a ruin's ghosts once laid, a dungeon's guards once slain: the
// save's records), so a quest taken after couldn't be done. A quest to lay ghosts, or to bring what only ghosts
// carry: as many risen again in its ruin as it still wants (ruins/haunting.ts). One to bring what only a crypt's
// dead carry, or a cave's vermin, its dungeon cleared of every last one: its guards back at their posts (its boss
// stays slain), there the next time the hero goes down.
import type { Entrance } from '../interiors/interiors';
import { BOSS_POST } from '../dungeons/dungeonRecord';
import { dungeonAt } from '../dungeons/dungeons';
import { LOOT } from '../loot/loot';
import type { LootSource } from '../loot/lootEntry';
import { ghostsIn } from '../ruins/haunting';
import type { Ruin } from '../ruins/ruins';
import type { Enemy } from '../types';
import type { Setting } from './storyCast';
import { dungeonOf, type AlreadyHost } from './storyAlready';
import type { StoryQuest } from './storyQuests';

export interface RestockHost extends AlreadyHost {
  readonly enemies: readonly Enemy[];
  readonly ruins: readonly Ruin[];
  haunt?(ruin: Ruin, count: number): number; // so many more ghosts risen in a ruin: how many did
  cleared?(key: string): Set<number>;
  clearedShare?(entrance: Entrance): number;
}

const FOR_LOOT = 3; // ghosts kept walking a ruin while a quest wants what they carry
const GUARDS: Partial<Record<LootSource, 'ruin' | 'cave'>> = { undead: 'ruin', draugr: 'ruin', vermin: 'cave' }; // whose loot is a dungeon's guards'

// `wants`: each quest under way and not yet done, where it's set, and how much of what it asks is still to do.
export function restock(host: RestockHost, wants: ReadonlyArray<{ quest: StoryQuest; at: Setting | null; left: number }>): void {
  const ghosts = new Map<Ruin, number>(); // each ruin: the most of them any quest of it wants
  for (const { quest, at, left } of wants) {
    const needs = quest.needs;
    if (!at || !needs || left <= 0) continue;
    const from = needs.kind === 'bring' ? LOOT[needs.item]?.droppedBy ?? {} : {};
    const haunting = needs.kind === 'slay' && needs.foe === 'ghost' ? left : from.ghost ? FOR_LOOT : 0;
    const spot = at.place.ruin;
    const ruin = haunting && spot ? host.ruins.find((r) => r.x + r.w / 2 === spot.x && r.z + r.d / 2 === spot.z) : undefined;
    if (ruin) ghosts.set(ruin, Math.max(ghosts.get(ruin) ?? 0, haunting));
    // (What a dungeon's guards carry, and none of them left: back at their posts.)
    for (const source of Object.keys(from) as LootSource[]) {
      const lair = GUARDS[source];
      const way = lair && at.place[lair] && dungeonOf(host, lair, at.place[lair]!);
      if (!way || (host.clearedShare?.(way) ?? 0) < 1) continue;
      const slain = host.cleared?.(dungeonAt(way)!.key);
      for (const post of [...(slain ?? [])]) if (post < BOSS_POST) slain!.delete(post);
    }
  }
  for (const [ruin, most] of ghosts) host.haunt?.(ruin, most - ghostsIn(host.enemies, ruin));
}
