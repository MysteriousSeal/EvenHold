// The sound's settings in the pause menu (pauseMenu.ts): how loud all of it is, its effects, the places' ambience,
// each stepped ‹ › a tenth at a time (Enter: a tenth up, round to silent after full), heard and kept at once
// (view/audio/volumes.ts).

import type { Volumes } from '../view/audio/volumes';

export interface VolumeHooks {
  get(): Volumes;
  set(volumes: Volumes): void;
}

export const VOLUME_STEP = 0.1;
const NAMES: ReadonlyArray<[keyof Volumes, string]> = [['master', 'Volume'], ['effects', 'Effects'], ['ambience', 'Ambience']];

// A volume as shown: "80%", or "Off".
export const volumeWords = (v: number): string => (v <= 0 ? 'Off' : `${Math.round(v * 100)}%`);

// One volume stepped by a tenth (`round`: past full, back to silent), kept in 0..1 on the tenths.
export function stepVolume(volumes: Volumes, key: keyof Volumes, by: 1 | -1, round = false): Volumes {
  const tenths = Math.round(volumes[key] / VOLUME_STEP) + by;
  const v = round && tenths > 10 ? 0 : Math.min(10, Math.max(0, tenths)) * VOLUME_STEP;
  return { ...volumes, [key]: Math.round(v * 10) / 10 };
}

// The three steppers, made by the pause menu's own (`stepper`), each redrawing it when changed (`changed`).
export function volumeSteppers<T>(hooks: VolumeHooks, stepper: (name: string, value: () => string, step: (by: 1 | -1) => void, cycle: () => void) => T, changed: () => void): T[] {
  return NAMES.map(([key, name]) =>
    stepper(
      name,
      () => volumeWords(hooks.get()[key]),
      (by) => [hooks.set(stepVolume(hooks.get(), key, by)), changed()],
      () => [hooks.set(stepVolume(hooks.get(), key, 1, true)), changed()],
    ),
  );
}
