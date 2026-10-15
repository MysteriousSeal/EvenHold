// Tools: things made to be used, not sold (skills/woodworking.ts and smithing.ts make them): a bedroll, unrolled anywhere outdoors
// to lie down on (hero/actionBar.ts: used off the bar; GameModel.lieDown), mending and resting the hero as a bed
// does, slower, with the foes still about. And a fishing rod, which pedlars sell (travellers/pedlarShop.ts): in the bag,
// E by a lake's shore casts it (skills/fishing.ts).
import type { LootEntry } from './lootEntry';

export const TOOL_ITEMS = {
  bedroll: { name: 'Bedroll', value: 35, droppedBy: {} },
  fishingRod: { name: 'Fishing rod', value: 40, droppedBy: {} }, // (the angler's: sold by pedlars)
  // A miner's picks, forged by a smith (skills/smithing.ts): in the bag, the best carried used, each a strike quicker.
  copperPick: { name: 'Copper pickaxe', value: 12, droppedBy: {} },
  ironPick: { name: 'Iron pickaxe', value: 25, droppedBy: {} },
  steelPick: { name: 'Steel pickaxe', value: 40, droppedBy: {} },
  starIronPick: { name: 'Star-iron pickaxe', value: 60, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type ToolId = keyof typeof TOOL_ITEMS;
export const isTool = (item: string): item is ToolId => item in TOOL_ITEMS;
