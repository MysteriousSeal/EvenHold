// What the weather tells the land's growing things: how hard the wind blows (1: as it ever was, ~0.6 still, ~2 in a
// gale's gust) and which way (a unit vector on the ground, world x and z). Shared uniforms read by every material the
// wind sways (wind.ts): one value each, no draw more. The skies own them (view/render/sky.ts skyUniforms, on their
// branch, the same names): once theirs is in, this is theirs re-exported. The season's colour is the skies' too
// (render/stylize.ts turns the world's greens), never tinted here a second time.

import * as THREE from 'three';

export const natureUniforms = {
  uWindStrength: { value: 1 },
  uWindDir: { value: new THREE.Vector2(1, 0.6).normalize() },
};
