// The game's sound, through the browser's Web Audio: three buses (all of it, the effects, the ambience) at the volumes
// set (volumes.ts); each sound loaded the first time it's wanted, a take of it played at a pitch a little off its own
// so no two blows sound alike; the ambience's loops faded up and down to the levels asked. Silent till the first key
// or click (browsers start a page's sound only then), and while the tab's hidden. A file that won't load is silence.

import { LOOPS, SOUNDS, fileOf, type Bus, type LoopId, type SoundId } from './soundBank';
import { loadVolumes, saveVolumes, type Volumes } from './volumes';
import type { Cue } from './eventSounds';

const FADE = 0.6; // seconds a loop takes to fade most of the way to its level
const HIDDEN_FADE = 0.05;

// A sound file's bytes made into audio: null if it isn't there or won't decode (never thrown).
export async function loadBuffer(url: string, fetchBytes: (url: string) => Promise<Response>, decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>): Promise<AudioBuffer | null> {
  try {
    const res = await fetchBytes(url);
    if (!res.ok) return null;
    return await decode(await res.arrayBuffer());
  } catch {
    return null;
  }
}

interface Playing {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  level: number; // where it's fading to
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly loops = new Map<LoopId, Playing>();
  private hidden = false;
  volumes: Volumes;

  constructor(
    private readonly base = '/', // where public/ is served (vite's BASE_URL)
    private readonly makeContext: () => AudioContext | null = () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
    private readonly fetchBytes: (url: string) => Promise<Response> = (url) => fetch(url),
    private readonly random: () => number = Math.random,
  ) {
    this.volumes = loadVolumes();
  }

  // Sound begun, at a key or a click (and resumed, if the browser held it).
  unlock(): void {
    if (!this.ctx) {
      this.ctx = this.makeContext();
      if (!this.ctx) return;
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const bus of ['effects', 'ambience'] as const) {
        const gain = this.ctx.createGain();
        gain.connect(this.master);
        this.buses.set(bus, gain);
      }
      this.applyVolumes(0);
      for (const [id, playing] of this.loops) this.startLoop(id, playing); // (asked for before there was sound)
    }
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume().catch(() => {});
  }

  // The volumes changed (the pause menu's sliders): heard at once, and kept.
  setVolumes(volumes: Volumes): void {
    this.volumes = { ...volumes };
    saveVolumes(this.volumes);
    this.applyVolumes(HIDDEN_FADE);
  }

  // The tab hidden (silent, the sound held) or shown again.
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.applyVolumes(HIDDEN_FADE);
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }

  // A take of a sound, now (`gain`: over its own level); nothing before sound's begun, or if its file won't load.
  play(id: SoundId, gain = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.hidden) return;
    const spec = SOUNDS[id];
    const take = Math.floor(this.random() * spec.takes);
    const pitch = 1 + (this.random() * 2 - 1) * (spec.pitch ?? 0);
    void this.buffer(fileOf(id, take)).then((buffer) => {
      if (!buffer || this.ctx !== ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitch;
      const level = ctx.createGain();
      level.gain.value = spec.gain * gain;
      source.connect(level).connect(this.buses.get(spec.bus)!);
      source.start();
    });
  }

  playAll(cues: readonly Cue[]): void {
    for (const cue of cues) this.play(cue.id, cue.gain);
  }

  // A loop faded to `level` (0..1, over its own level): begun the first time it's asked above nothing.
  setLoop(id: LoopId, level: number): void {
    const playing = this.loops.get(id);
    if (playing) {
      if (Math.abs(playing.level - level) < 0.01) return;
      playing.level = level;
      if (this.ctx) playing.gain.gain.setTargetAtTime(SOUNDS[id].gain * level, this.ctx.currentTime, FADE / 3);
      return;
    }
    if (level <= 0) return;
    const fresh: Playing = { gain: null!, source: null, level };
    this.loops.set(id, fresh);
    if (this.ctx) this.startLoop(id, fresh);
  }

  // Every loop's level now (for a look at what's playing: the dev tools).
  get loopLevels(): Record<LoopId, number> {
    return Object.fromEntries(LOOPS.map((id) => [id, this.loops.get(id)?.level ?? 0])) as Record<LoopId, number>;
  }

  private startLoop(id: LoopId, playing: Playing): void {
    const ctx = this.ctx!;
    playing.gain = ctx.createGain();
    playing.gain.gain.value = 0;
    playing.gain.connect(this.buses.get(SOUNDS[id].bus)!);
    playing.gain.gain.setTargetAtTime(SOUNDS[id].gain * playing.level, ctx.currentTime, FADE / 3);
    void this.buffer(fileOf(id)).then((buffer) => {
      if (!buffer || this.ctx !== ctx) return;
      const source = ctx.createBufferSource();
      Object.assign(source, { buffer, loop: true });
      source.connect(playing.gain);
      source.start(0, this.random() * buffer.duration); // (from anywhere in it: two places' loops never in step)
      playing.source = source;
    });
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let loading = this.buffers.get(file);
    if (!loading) {
      const ctx = this.ctx!;
      loading = loadBuffer(`${this.base}${file}`, this.fetchBytes, (bytes) => ctx.decodeAudioData(bytes));
      this.buffers.set(file, loading);
    }
    return loading;
  }

  private applyVolumes(fade: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const set = (node: GainNode, v: number) => (fade > 0 ? node.gain.setTargetAtTime(v * v, ctx.currentTime, fade / 3) : (node.gain.value = v * v)); // (squared: a slider's middle sounds half as loud)
    set(this.master, this.hidden ? 0 : this.volumes.master);
    set(this.buses.get('effects')!, this.volumes.effects);
    set(this.buses.get('ambience')!, this.volumes.ambience);
  }
}
