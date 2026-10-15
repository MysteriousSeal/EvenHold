// The seasons on a broadleaf tree or bush's leaves (wind.ts `broadleaf`), by how far into each season it is
// (nature.ts uSeason): in spring blossom on some of the trees, pink and white, here and there among the leaves; in
// autumn each tree its own colour (world-design's oaks' amber, rust and red, the birches' gold), some turning sooner than
// others, and thinning; in winter bare, its leaves gone, voxel by voxel, to the trunk and the boughs. A leaf told from
// the bark by its colour (green over red and blue); each voxel and each tree its own roll, so they turn and fall apart.
// No geometry more: the leaves only recoloured, or dropped (discarded), in the shader.

import * as THREE from 'three';

const AUTUMN = [0xd98a3a, 0xc4692e, 0xb8432e, 0xe0c04a].map((hex) => new THREE.Color(hex));
const BLOSSOM = [0xf2c4d0, 0xf6eef0].map((hex) => new THREE.Color(hex));
const vec3 = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// Vertex: each tree's own roll (by where it stands) and where in it each face is (just inside its voxel).
export const LEAF_VERTEX_HEAD = 'varying float vLeafTree;\nvarying vec3 vLeafCell;';
export const LEAF_VERTEX = `
  vLeafTree = fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
  vLeafCell = position - objectNormal * 0.02;`;

export const LEAF_FRAGMENT_HEAD = `
uniform vec4 uSeason;
varying float vLeafTree;
varying vec3 vLeafCell;
float leafHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`;
export const LEAF_FRAGMENT = `
  if (diffuseColor.g > diffuseColor.r * 1.04 && diffuseColor.g > diffuseColor.b) {
    float leafRoll = leafHash(floor(vLeafCell / 0.04));
    // Turning: each tree in its own time; falling: half the turned leaves by the season's end, all in winter.
    float turned = clamp(uSeason.z * 1.8 - vLeafTree * 0.8, 0.0, 1.0);
    if (leafRoll < uSeason.w * 1.02 + turned * 0.45) discard;
    float luma = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) / 0.16;
    vec3 autumn = vLeafTree < 0.3 ? ${vec3(AUTUMN[0])} : vLeafTree < 0.55 ? ${vec3(AUTUMN[1])} : vLeafTree < 0.75 ? ${vec3(AUTUMN[2])} : ${vec3(AUTUMN[3])};
    diffuseColor.rgb = mix(diffuseColor.rgb, autumn * clamp(luma, 0.55, 1.25), turned * step(0.15, leafRoll + turned));
    // Blossom on about half the trees, on a voxel in five at its height.
    if (vLeafTree > 0.5 && leafRoll > 1.0 - uSeason.x * 0.22) diffuseColor.rgb = leafRoll > 0.95 ? ${vec3(BLOSSOM[1])} : ${vec3(BLOSSOM[0])};
  }`;
