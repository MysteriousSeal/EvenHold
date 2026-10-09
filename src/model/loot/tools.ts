// Tools: things made to be used, not sold (skills/woodworking.ts makes them): a bedroll, unrolled anywhere outdoors
// to lie down on (hero/actionBar.ts: used off the bar; GameModel.lieDown), mending and resting the hero as a bed
// does, slower, with the foes still about.
import type { LootEntry } from './lootEntry';

export const TOOL_ITEMS = {
  bedroll: { name: 'Bedroll', value: 35, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type ToolId = keyof typeof TOOL_ITEMS;
export const isTool = (item: string): item is ToolId => item in TOOL_ITEMS;
