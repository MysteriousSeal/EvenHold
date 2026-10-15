// @vitest-environment happy-dom
// The game's sound (view/audio/): what's heard of each thing the model tells (and that every sound's files are there),
// a file that won't load heard as silence (never an error), the volumes kept between plays, and the places' ambience.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { soundsFor } from '../src/view/audio/eventSounds';
import { SOUNDS, fileOf, type SoundId } from '../src/view/audio/soundBank';
import { Sound, loadBuffer } from '../src/view/audio/sound';
import { USUAL_VOLUMES, loadVolumes, saveVolumes } from '../src/view/audio/volumes';
import { groundOf, loopLevels } from '../src/view/audio/ambience';
import type { GameEvent } from '../src/model/types';
import { stepVolume, volumeSteppers, volumeWords } from '../src/controller/soundSettings';

const ids = (event: GameEvent) => soundsFor(event).map((c) => c.id);
const at = { x: 1, y: 0, z: 2 };

describe('what the model tells, heard', () => {
  it('a blow: its whoosh; landing on flesh, or ringing off armour and bone; a critical one harder; on the hero, a hurt', () => {
    expect(ids({ kind: 'swing' })).toEqual(['swing']);
    expect(ids({ kind: 'swing', roll: true })).toEqual(['roll']);
    expect(ids({ kind: 'hit', on: 'wolf', amount: 2, ...at })).toEqual(['hitFlesh']);
    expect(ids({ kind: 'hit', on: 'skeleton', amount: 2, ...at })).toEqual(['hitArmour']);
    expect(ids({ kind: 'hit', on: 'bandit', amount: 2, crit: true, ...at })).toEqual(['crit', 'hitFlesh']);
    expect(ids({ kind: 'hit', on: 'hero', amount: 2, ...at })).toEqual(['hurt']);
  });

  it('the guard: a parry rings, a block knocks, a broken guard crashes; a roll through it, nothing more', () => {
    expect(ids({ kind: 'guard', outcome: 'parried', ...at })).toEqual(['parry']);
    expect(ids({ kind: 'guard', outcome: 'blocked', ...at })).toEqual(['block']);
    expect(ids({ kind: 'guard', outcome: 'broken', ...at })).toEqual(['broken']);
    expect(ids({ kind: 'guard', outcome: 'rolled', ...at })).toEqual([]);
    expect(ids({ kind: 'slain', on: 'wolf', ...at })).toEqual(['slain']);
    expect(ids({ kind: 'fallen' })).toEqual(['fallen']);
  });

  it('coin, a skill risen, a level gained, a quest done, something not to be had', () => {
    expect(ids({ kind: 'coins', amount: 3 })).toEqual(['coin']);
    expect(ids({ kind: 'skillUp', skill: 'Mining', level: 2 })).toEqual(['skillUp']);
    expect(ids({ kind: 'levelUp', level: 2, points: 1 })).toEqual(['levelUp']);
    expect(ids({ kind: 'quest', text: '3/3', done: true, ...at })).toEqual(['quest']);
    expect(ids({ kind: 'quest', text: '1/3', done: false, ...at })).toEqual([]);
    expect(ids({ kind: 'poor', text: 'Your bag is full' })).toEqual(['error']);
  });

  it('work: each tool its stroke; a line cast, a fish landed or lost', () => {
    expect((['axe', 'pick', 'hammer', 'bench'] as const).map((tool) => ids({ kind: 'stroke', tool })[0])).toEqual(['chop', 'mine', 'anvil', 'bench']);
    expect(ids({ kind: 'castLine' })).toEqual(['castLine']);
    expect(ids({ kind: 'fished', item: 'trout' as never, x: 0, z: 0 })).toEqual(['catch']);
    expect(ids({ kind: 'fished', item: null, x: 0, z: 0 })).toEqual(['lost']);
  });

  it('what is only seen: nothing', () => {
    expect(ids({ kind: 'village', name: 'Ash', level: 1 })).toEqual([]);
    expect(ids({ kind: 'say', speaker: { x: 0, z: 0 }, where: null, text: 'Ho' })).toEqual([]);
  });

  it('every sound has each of its files', () => {
    for (const id of Object.keys(SOUNDS) as SoundId[]) for (let take = 0; take < Math.max(1, SOUNDS[id].takes); take++) expect(existsSync(`public/${fileOf(id, take)}`), fileOf(id, take)).toBe(true);
  });
});

// A stand-in for the browser's AudioContext: what's started, counted.
function fakeContext() {
  const started: number[] = [];
  const param = () => ({ value: 1, setTargetAtTime() {} });
  const node = () => ({ gain: param(), connect: (n: unknown) => n });
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: node,
    createBufferSource: () => ({ ...node(), buffer: null, playbackRate: param(), start: () => void started.push(1) }),
    decodeAudioData: async (bytes: ArrayBuffer) => ({ duration: bytes.byteLength }),
    resume: async () => {},
    suspend: async () => {},
  };
  return { ctx: ctx as unknown as AudioContext, started };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a sound file that will not load', () => {
  it('is silence: not there, the fetch failing, or not audio', async () => {
    const decode = async () => ({}) as AudioBuffer;
    expect(await loadBuffer('x.mp3', async () => new Response('', { status: 404 }), decode)).toBeNull();
    expect(await loadBuffer('x.mp3', () => Promise.reject(new Error('offline')), decode)).toBeNull();
    expect(await loadBuffer('x.mp3', async () => new Response('junk'), () => Promise.reject(new Error('not audio')))).toBeNull();
  });

  it('played: nothing heard, nothing thrown; one that loads, heard', async () => {
    const { ctx, started } = fakeContext();
    const sound = new Sound('/', () => ctx, async (url) => (url.includes('swing') ? new Response('', { status: 404 }) : new Response('abc')));
    sound.play('swing'); // (before sound's begun: nothing)
    sound.unlock();
    expect(() => sound.play('swing')).not.toThrow();
    await settle();
    expect(started).toHaveLength(0);
    sound.play('coin');
    await settle();
    expect(started).toHaveLength(1);
  });
});

describe('the volumes', () => {
  const store = () => {
    const kept = new Map<string, string>();
    return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), kept };
  };

  it('are kept, and read back as set', () => {
    const s = store();
    saveVolumes({ master: 0.5, effects: 0.25, ambience: 0 }, s);
    expect(loadVolumes(s)).toEqual({ master: 0.5, effects: 0.25, ambience: 0 });
  });

  it('none kept, unreadable, out of range or storage blocked: the usual, each checked on its own', () => {
    expect(loadVolumes(store())).toEqual(USUAL_VOLUMES);
    const s = store();
    s.setItem('evenhold.volumes', '{not json');
    expect(loadVolumes(s)).toEqual(USUAL_VOLUMES);
    s.setItem('evenhold.volumes', JSON.stringify({ master: 3, effects: 'loud', ambience: -1 }));
    expect(loadVolumes(s)).toEqual({ master: 1, effects: USUAL_VOLUMES.effects, ambience: 0 });
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadVolumes(blocked)).toEqual(USUAL_VOLUMES);
    expect(() => saveVolumes(USUAL_VOLUMES, blocked)).not.toThrow();
  });

  it('set in the game, kept for the next play (the browser\'s storage)', () => {
    new Sound('/', () => null).setVolumes({ master: 0.3, effects: 0.6, ambience: 0.9 });
    expect(new Sound('/', () => null).volumes).toEqual({ master: 0.3, effects: 0.6, ambience: 0.9 });
    localStorage.clear();
  });
});

describe('the ambience', () => {
  const outdoors = { outdoors: true, night: 0, rain: 0, wind: 0.3, season: 'summer' as const };
  const idle = { making: null } as never;
  const room = (type: string, floor = 'planks', below?: object) => ({ entrance: { type }, room: { floor }, below }) as never;

  it('outdoors: birds by day, crickets by night (none in winter), the rain and wind as hard as they are', () => {
    expect(loopLevels({ inside: null, cooking: idle }, outdoors, 0)).toMatchObject({ birds: 1, crickets: 0, rain: 0, inn: 0 });
    expect(loopLevels({ inside: null, cooking: idle }, { ...outdoors, night: 1 }, 0)).toMatchObject({ birds: 0, crickets: 1 });
    expect(loopLevels({ inside: null, cooking: idle }, { ...outdoors, night: 1, season: 'winter' }, 0).crickets).toBe(0);
    const storm = loopLevels({ inside: null, cooking: idle }, { ...outdoors, rain: 1, wind: 1.5 }, 0);
    expect(storm.rain).toBe(1);
    expect(storm.wind).toBe(1);
  });

  it("indoors: an inn's talk and hearth (upstairs, fainter), a smithy's forge, the rain muffled; a pot on the fire", () => {
    const rain = { ...outdoors, rain: 1 };
    expect(loopLevels({ inside: room('inn'), cooking: idle }, rain, 0)).toMatchObject({ inn: 1, lute: 1, hearth: 1, birds: 0, rain: 0.3 });
    expect(loopLevels({ inside: room('inn', 'planks', {}), cooking: idle }, rain, 0).inn).toBeLessThan(1);
    expect(loopLevels({ inside: room('smithy'), cooking: idle }, rain, 0)).toMatchObject({ forge: 1, inn: 0, lute: 0 });
    expect(loopLevels({ inside: null, cooking: { making: {} } as never }, outdoors, 0).sizzle).toBe(1);
  });

  it('steps by the ground: floorboards, flags, a village plaza, the road, grass, snow', () => {
    const tiles = (surface: string) => ({ surface: () => surface }) as never;
    const hero = { x: 0, z: 0 } as never;
    expect(groundOf({ hero, inside: room('inn', 'tavern'), tiles: tiles('natural') }, 0)).toBe('stepWood');
    expect(groundOf({ hero, inside: room('crypt', 'flagstones'), tiles: tiles('natural') }, 0)).toBe('stepStone');
    expect(groundOf({ hero, inside: null, tiles: tiles('plaza') }, 0)).toBe('stepStone');
    expect(groundOf({ hero, inside: null, tiles: tiles('path') }, 0)).toBe('stepDirt');
    expect(groundOf({ hero, inside: null, tiles: tiles('natural') }, 0)).toBe('stepGrass');
    expect(groundOf({ hero, inside: null, tiles: tiles('natural') }, 0.8)).toBe('stepSnow');
  });
});

describe('the volume settings (the pause menu)', () => {
  it('step a tenth at a time, held to 0..100%; Enter goes round to Off past full', () => {
    const v = { master: 0.8, effects: 1, ambience: 0 };
    expect(stepVolume(v, 'master', 1).master).toBe(0.9);
    expect(stepVolume(v, 'effects', 1).effects).toBe(1);
    expect(stepVolume(v, 'ambience', -1).ambience).toBe(0);
    expect(stepVolume(v, 'effects', 1, true).effects).toBe(0);
    expect([volumeWords(0.8), volumeWords(0)]).toEqual(['80%', 'Off']);
  });

  it('one stepper each, changing the sound (and so kept) and redrawn', () => {
    let kept = { ...USUAL_VOLUMES };
    let redrawn = 0;
    const rows = volumeSteppers({ get: () => kept, set: (v) => void (kept = v) }, (name, value, step, cycle) => ({ name, value, step, cycle }), () => redrawn++);
    expect(rows.map((r) => [r.name, r.value()])).toEqual([['Volume', '80%'], ['Effects', '100%'], ['Ambience', '70%']]);
    rows[2].step(-1);
    rows[0].cycle();
    expect(kept).toEqual({ master: 0.9, effects: 1, ambience: 0.6 });
    expect(redrawn).toBe(2);
  });
});
