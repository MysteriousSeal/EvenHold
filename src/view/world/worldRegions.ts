// A streamed world drawn region by region (model/world/liveWorld.ts: the regions made round the hero): each region
// the model's made drawn by the world's builders (worldBuilders.ts), handed the model as that region alone (its own
// lists and part of the map, the rest the model's own), its layers under its own tag (chunkStreamer.ts), its
// materials stylized and compiled before it's ever seen (off the frame, where the browser can); each the model's let
// go, dropped (its layers, its meshes, its materials). One region a frame, either way.

import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import type { ChunkStreamer } from './chunkStreamer';
import { WORLD_BUILDERS, type Animation } from './worldBuilders';

export class WorldRegions {
  private readonly drawn = new Map<number, Animation[]>();

  constructor(
    private readonly sink: ChunkStreamer,
    private readonly model: GameModel,
    private readonly prepare: (materials: THREE.Material[]) => void, // stylized and compiled, before they're seen
  ) {}

  // Whether every region made is drawn (the first, before play).
  get done(): boolean {
    return this.model.world.loaded().every((index) => this.drawn.has(index));
  }

  // Every region made drawn now (before play).
  drawAll(): void {
    while (!this.done) this.update();
  }

  // One region drawn that's made, else one dropped that's let go.
  update(): void {
    const loaded = this.model.world.loaded();
    const next = loaded.find((index) => !this.drawn.has(index));
    if (next !== undefined) return this.draw(next);
    const gone = [...this.drawn.keys()].find((index) => !loaded.includes(index));
    if (gone !== undefined) this.drop(gone);
  }

  animate(elapsedSeconds: number): void {
    for (const animations of this.drawn.values()) for (const animate of animations) animate(elapsedSeconds);
  }

  private draw(index: number): void {
    const contents = this.model.world.contents(index)!;
    // The model as this region alone: its lists, its part of the map; all else the model's own (tiles, ground).
    const region = Object.create(this.model, Object.fromEntries(Object.entries(contents).map(([k, v]) => [k, { value: v }]))) as GameModel;
    const sink = this.sink.tagged(index);
    const before = new Set(this.sink.materials());
    const animations = WORLD_BUILDERS.map((b) => b.build(sink, region)).filter((a): a is Animation => !!a);
    this.drawn.set(index, animations);
    this.prepare(this.sink.materials().filter((m) => !before.has(m)));
  }

  private drop(index: number): void {
    this.drawn.delete(index);
    for (const material of this.sink.drop(index)) material.dispose();
  }
}
