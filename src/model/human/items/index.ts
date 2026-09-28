// The item catalog: every item in the game, by id.

import type { EquipSlot } from '../equipment';
import { FEET_ITEMS, HANDS_ITEMS, HEAD_ITEMS, LEGS_ITEMS, SHOULDERS_ITEMS, TORSO_ITEMS } from './armor';
import { NECK_ITEMS, RING_ITEMS } from './jewelry';
import { MAIN_HAND_ITEMS, OFF_HAND_ITEMS } from './held';
import type { ItemEntry } from './item';

const CATALOG = { ...HEAD_ITEMS, ...SHOULDERS_ITEMS, ...TORSO_ITEMS, ...HANDS_ITEMS, ...LEGS_ITEMS, ...FEET_ITEMS, ...NECK_ITEMS, ...RING_ITEMS, ...MAIN_HAND_ITEMS, ...OFF_HAND_ITEMS };

export type ItemId = keyof typeof CATALOG;
export interface Item extends ItemEntry {
  slot: EquipSlot;
}
export const ITEMS: Record<ItemId, Item> = CATALOG;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type { Wearer } from './item';
