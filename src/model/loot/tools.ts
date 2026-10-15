// Tools: things made to be used, not sold (skills/woodworking.ts makes them): a bedroll, unrolled anywhere outdoors
// to lie down on (hero/actionBar.ts: used off the bar; GameModel.lieDown), mending and resting the hero as a bed
// does, slower, with the foes still about. And a fishing rod, which pedlars sell (travellers/pedlarShop.ts): in the bag,
// E by a lake's shore casts it (skills/fishing.ts). And pickaxes: the smith's copper one, and the better ones forged at
// an anvil (skills/smithing: iron, steel, star-iron, each quicker: skills/mining.ts PICK_BONUS); in the bag, E by a
// veined rock strikes it, with the best of them carried.
import type { LootEntry } from './lootEntry';

export const TOOL_ITEMS = {
  bedroll: { name: 'Bedroll', value: 35, droppedBy: {} },
  fishingRod: { name: 'Fishing rod', value: 40, droppedBy: {} }, // (the angler's: sold by pedlars)
  copperPick: { name: 'Copper pickaxe', value: 40, droppedBy: {} }, // (the miner's: sold by the smith)
  ironPick: { name: 'Iron pickaxe', value: 60, droppedBy: {} },
  steelPick: { name: 'Steel pickaxe', value: 90, droppedBy: {} },
  starIronPick: { name: 'Star-iron pickaxe', value: 120, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type ToolId = keyof typeof TOOL_ITEMS;
export const isTool = (item: string): item is ToolId => item in TOOL_ITEMS;
