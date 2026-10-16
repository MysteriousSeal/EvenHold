// The World tab's Weather rows (cheatPanel.ts): the weather now and the wind's strength, each click the next step,
// held till let go (model/world/weather.ts holdWeather); then the world's own weather comes back.
import { heldWeather, holdWeather, WEATHER_KINDS, type WeatherKind } from '../../model/world/weather';
import type { MenuAction } from '../../view/ui/menu';
import { ICONS as ICON } from './cheatIcons';

const KINDS: readonly (WeatherKind | undefined)[] = [undefined, ...WEATHER_KINDS]; // (undefined: as it comes)
const WINDS: readonly (number | undefined)[] = [undefined, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]; // (a still day 0, the windy weather's ~1, a gale 1.5)
const next = <T,>(steps: readonly T[], now: T): T => steps[(steps.indexOf(now) + 1) % steps.length];
const windName = (wind: number | undefined) => (wind === undefined ? 'as it blows' : `${Math.round(wind * 100)}%`);

export function weatherActions(): MenuAction[] {
  return [
    {
      icon: ICON.lake,
      title: 'Weather',
      detail: 'Each click the next: clear, overcast, rain, fog, windy, snow; held till let go',
      current: () => ({ value: heldWeather().kind ?? 'As it comes' }),
      run: () => {
        const kind = next(KINDS, heldWeather().kind);
        holdWeather({ ...heldWeather(), kind });
        return kind ? `The weather held: ${kind}.` : 'The weather as it comes.';
      },
    },
    {
      icon: ICON.world,
      title: 'Wind strength',
      detail: 'Each click harder: still to a gale (100%: the windy weather’s); held till let go',
      current: () => ({ value: windName(heldWeather().wind) }),
      run: () => {
        const wind = next(WINDS, heldWeather().wind);
        holdWeather({ ...heldWeather(), wind });
        return `The wind ${windName(wind)}.`;
      },
    },
    { icon: ICON.lake, title: 'Let the weather go', detail: "The world's own weather and wind again", run: () => (holdWeather({}), "The world's own weather again.") },
  ];
}
