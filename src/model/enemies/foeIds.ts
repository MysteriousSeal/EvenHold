// Who's who among foes, by id: the world's own (made with it: a classic world's numbered from 0; a streamed world's
// by its region, from STREAMED_FOE_ID, each region its own block), those gathered for a quest (questBook.ts: from
// FIRST_MOB_ID), and those down in a dungeon (crypts', caves': their own blocks). Only the world's own are kept slain
// in a save and its record of the slain.

import { FIRST_MOB_ID } from '../quests/questBook';

export const STREAMED_FOE_ID = 2 ** 48; // (past any quest's: theirs reach 1e13 at most; all still exact integers)
export const REGION_FOES = 2 ** 20; // ids in each region's block

// The first id of the foes of a streamed world's region `index` (its place in the regions, row by row).
export const regionFoeId = (index: number): number => STREAMED_FOE_ID + index * REGION_FOES;

// Whether a foe is the world's own (not a quest's, nor a dungeon's).
export const isWorldFoe = (id: number): boolean => id < FIRST_MOB_ID || id >= STREAMED_FOE_ID;
