// Whoever a charm may be cast at (casting.ts): a foe, a villager or keeper, someone on the road. Which of them one
// is, and the human body it has, if any (a villager's or a traveller's own; a bandit's; no beast's, none of the dead's).
import type { Humanoid } from '../human/humanoid';
import type { Npc } from '../npcs/npcs';
import type { Traveller } from '../travellers/travellers';
import type { Enemy } from '../types';

export type Being = Enemy | Npc | Traveller;
export const isFoe = (being: Being): being is Enemy => 'kind' in being;
export const isNpc = (being: Being): being is Npc => 'home' in being;
export const humanOf = (being: Being): Humanoid | null => (isFoe(being) ? (being.human ?? null) : being);
