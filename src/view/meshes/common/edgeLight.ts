// A figure's edges lit, or inked, by a light of their own (the hero's by the hour: human/heroRim.ts; the foes' at night:
// enemy/foeNight.ts): where the surface turns away from the eye, light added in a colour (`strength`), or what's there
// darkened (`ink`); none face on. And (`own`) the hour's colour cast taken out of the light they're lit by, that share
// of it (sky.ts uBalance): their own colours kept under a dusk's rose or a morning's gold. Its materials, dressed
// once, all follow it as it's set.

import * as THREE from 'three';
import { skyUniforms } from '../../render/sky';

export class EdgeLight {
  private readonly uniforms = { uEdgeLight: { value: 0 }, uEdgeInk: { value: 0 }, uEdgeColor: { value: new THREE.Color() }, uEdgeOwn: { value: 0 }, uBalance: skyUniforms.uBalance };

  // `falloff`: how far in from the silhouette it reaches (the higher, the thinner).
  constructor(private readonly falloff = 2.2) {}

  // `material` given the edge (after whatever it's patched with already: people's rim, a stealthy beast's fade).
  dress<M extends THREE.MeshStandardMaterial>(material: M): M {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = `uniform float uEdgeLight;\nuniform float uEdgeInk;\nuniform vec3 uEdgeColor;\nuniform float uEdgeOwn;\nuniform vec3 uBalance;\n${shader.fragmentShader}`.replace(
        '#include <opaque_fragment>',
        `float edgeLit = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${this.falloff.toFixed(2)});
      outgoingLight = outgoingLight * mix(vec3(1.0), uBalance, uEdgeOwn) * (1.0 - uEdgeInk * edgeLit) + uEdgeColor * edgeLit * uEdgeLight;
      #include <opaque_fragment>`,
      );
    };
    material.customProgramCacheKey = () => `${previousKey}|edge${this.falloff}`;
    return material;
  }

  set(strength: number, ink: number, color: THREE.Color, own = 0): void {
    this.uniforms.uEdgeLight.value = strength;
    this.uniforms.uEdgeOwn.value = own;
    this.uniforms.uEdgeInk.value = ink;
    this.uniforms.uEdgeColor.value.copy(color);
  }
}
