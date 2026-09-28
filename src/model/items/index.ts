// The item catalog: every item in the game, by id.

import { FEET_ITEMS, HANDS_ITEMS, HEAD_ITEMS, LEGS_ITEMS, TORSO_ITEMS } from './armor';
import { MAIN_HAND_ITEMS, OFF_HAND_ITEMS } from './held';

export const ITEMS = { ...HEAD_ITEMS, ...TORSO_ITEMS, ...HANDS_ITEMS, ...LEGS_ITEMS, ...FEET_ITEMS, ...MAIN_HAND_ITEMS, ...OFF_HAND_ITEMS };
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type { Wearer } from './item';
