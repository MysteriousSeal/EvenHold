// Rendering switches read from the URL, for measuring what costs frame time:
//
//   ?pr=2        render resolution multiplier (default 1; clamped to 0.5..3)
//   ?nopost      no post-processing at all (plain render, canvas antialiasing)
//   ?nobloom     skip the bloom pass
//   ?noshafts    skip the light-shaft pass
//   ?msaa=0|2|4  multisampling of the post-processing target (default 4)
//   ?uncapped    run the game loop as fast as possible instead of once per
//                display refresh; frames beyond the refresh rate are never
//                shown, but the fps readout then measures real headroom
//   ?hour=18 ?season=autumn ?weather=rain
//                the sky as forced, for a look at it (only how it looks: the
//                game's clock goes on as ever); weather: clear, overcast,
//                rain, fog, windy or snow
//
// Switches combine, e.g. ?seed=42&pr=2&nobloom.

import { SEASONS } from '../../model/clock';
import { WEATHER_KINDS, type SkyForcing } from '../../model/world/weather';

// Rendering at 1x (instead of the screen's 2x on Retina displays) draws a
// quarter of the pixels, and the voxel art stays crisp when upscaled
// pixelated.
const DEFAULT_PIXEL_RATIO = 1;
const DEFAULT_MSAA = 4;

export interface RenderOptions {
  sky: SkyForcing;
  pixelRatio: number;
  post: boolean;
  bloom: boolean;
  shafts: boolean;
  msaa: number;
  uncapped: boolean;
}

export function readRenderOptions(search: string = window.location.search): RenderOptions {
  const params = new URLSearchParams(search);
  const number = (name: string, fallback: number) => {
    const raw = params.get(name)?.trim();
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const msaa = number('msaa', DEFAULT_MSAA);
  const hour = number('hour', NaN);
  const season = SEASONS.find((s) => s === params.get('season'));
  const weather = WEATHER_KINDS.find((w) => w === params.get('weather'));
  return {
    sky: { ...(hour >= 0 && hour < 24 ? { hour } : {}), ...(season ? { season } : {}), ...(weather ? { weather } : {}) },
    pixelRatio: Math.min(3, Math.max(0.5, number('pr', DEFAULT_PIXEL_RATIO))),
    post: !params.has('nopost'),
    bloom: !params.has('nobloom'),
    shafts: !params.has('noshafts'),
    msaa: [0, 2, 4].includes(msaa) ? msaa : DEFAULT_MSAA,
    uncapped: params.has('uncapped'),
  };
}
