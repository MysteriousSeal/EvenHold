// The map (M): the land the hero's walked, drawn as a parchment map (view/atlas/mapPaint.ts), the hero at its middle
// as it opens. Dragged, it moves; the wheel draws in and out; what's under the pointer named along its bottom (a
// village, a place, a pin). Under it, the key to its marks and the corner map's switch (view/hud/minimap.ts). The game
// waits while it's open.

import './mapWindow.css';
import type { GameModel } from '../../model/GameModel';
import { mapPins } from '../../model/atlas/mapPins';
import { nameAt, paintMap, type MapLook, type MapPaint } from '../../view/atlas/mapPaint';
import { createMenu, type Menu } from '../../view/ui/menu';
import { keyOf } from '../keyBindings';

const [LEAST, MOST] = [0.25, 6]; // pixels a tile, drawn out and in
const OPENED_AT = 1.5;
const [FIT_LEAST, FIT_MOST] = [0.5, 4]; // as it opens, drawn to fit all that's been seen: no farther out, nor closer in (past 4, a fresh hero's land a few blocks)
const FIT_MARGIN = 0.85; // of the window the land seen fills, fitted

export function createMapWindow(model: GameModel, hooks: { setPaused(paused: boolean): void; minimap: { on: boolean; toggle(): void } }): { menu: Menu } {
  const look: MapLook = { x: 0, z: 0, scale: OPENED_AT };
  const wrap = document.createElement('div');
  wrap.className = 'map-window';
  const canvas = document.createElement('canvas');
  canvas.className = 'map-canvas';
  const named = document.createElement('div');
  named.className = 'map-named';
  const foot = document.createElement('div');
  foot.className = 'map-foot';
  const key = document.createElement('div');
  key.className = 'map-key';
  key.innerHTML = '<i class="pin quest"></i>Quest <i class="pin bounty"></i>Bounty <i class="pin story"></i>Errand <i class="pin board"></i>Hand in · struck through: cleared';
  const middle = document.createElement('button');
  middle.className = 'map-button';
  middle.textContent = 'Find me';
  const corner = document.createElement('button');
  corner.className = 'map-button';
  const cornerText = () => (corner.textContent = `Corner map: ${hooks.minimap.on ? 'on' : 'off'}`);
  cornerText();
  foot.append(key, middle, corner);
  wrap.append(canvas, named, foot);

  let paint: MapPaint = { names: true, pins: [], places: [] };
  let frame = 0;
  const size = () => ({ width: canvas.clientWidth || 860, height: canvas.clientHeight || 560 });
  const draw = () => {
    const { width, height } = size();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio)) [canvas.width, canvas.height] = [Math.round(width * ratio), Math.round(height * ratio)];
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint = { names: look.scale >= 0.5, pins: mapPins(model), places: model.atlas.places() };
    paintMap(ctx, model, look, width, height, paint);
  };
  // Drawn while it's open (charts come in from the worker as it's looked at).
  const loop = () => {
    draw();
    frame = menu.isOpen ? requestAnimationFrame(loop) : 0;
  };
  const centre = () => {
    const at = model.inside?.entrance ?? model.hero;
    [look.x, look.z] = [at.x, at.z];
  };
  // Opened: all that's been seen fitted to the window (a fresh hero's few steps drawn close, a long road's whole length
  // drawn out), the hero at the middle if the land seen fits round them, else its middle.
  const fit = () => {
    centre();
    const seen = model.atlas.fog.bounds();
    if (!seen) return;
    const { width, height } = size();
    const span = (x0: number, x1: number, at: number) => 2 * Math.max(at - x0, x1 - at);
    const round = (x0: number, x1: number, at: number, room: number) => (span(x0, x1, at) <= room ? at : (x0 + x1) / 2);
    look.scale = Math.min(FIT_MOST, Math.max(FIT_LEAST, FIT_MARGIN * Math.min(width / span(seen.x0, seen.x1, look.x), height / span(seen.z0, seen.z1, look.z))));
    [look.x, look.z] = [round(seen.x0, seen.x1, look.x, width / look.scale), round(seen.z0, seen.z1, look.z, height / look.scale)];
  };
  middle.addEventListener('click', centre);
  corner.addEventListener('click', () => void [hooks.minimap.toggle(), cornerText()]);

  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      look.x -= (e.clientX - drag.x) / look.scale;
      look.z -= (e.clientY - drag.y) / look.scale;
      drag = { x: e.clientX, y: e.clientY };
    }
    const box = canvas.getBoundingClientRect();
    const { width, height } = size();
    named.textContent = nameAt(model, look, width, height, paint, e.clientX - box.left, e.clientY - box.top) ?? '';
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // (in toward the pointer: the tile under it stays under it)
    const box = canvas.getBoundingClientRect();
    const [px, py] = [e.clientX - box.left - box.width / 2, e.clientY - box.top - box.height / 2];
    const [tx, tz] = [look.x + px / look.scale, look.z + py / look.scale];
    look.scale = Math.min(MOST, Math.max(LEAST, look.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    [look.x, look.z] = [tx - px / look.scale, tz - py / look.scale];
  }, { passive: false });

  const menu = createMenu({
    title: 'Map',
    toggleKey: () => keyOf('map'),
    keyHints: false,
    onOpenChange: (open) => {
      hooks.setPaused(open);
      wrap.closest('.menu')?.classList.add('map-menu');
      if (open) [fit(), cornerText(), (named.textContent = '')];
      if (open && !frame) frame = requestAnimationFrame(loop);
    },
    tabs: [{ name: 'Map', header: () => wrap }],
  });
  return { menu };
}
