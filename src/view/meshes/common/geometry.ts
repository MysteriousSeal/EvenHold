// Small geometry helpers shared by the house, well and ground-cover
// builders. Every helper returns non-indexed geometry, since
// mergeGeometries needs all of its inputs to agree on that.

import * as THREE from 'three';

export function nonIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.index ? g.toNonIndexed() : g;
}

export function box(w: number, h: number, d: number, x: number, y: number, z: number, rotX = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX !== 0) g.rotateX(rotX);
  g.translate(x, y, z);
  return nonIndexed(g);
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Square-section beam between two arbitrary points.
export function beam(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  size: number,
): THREE.BufferGeometry {
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const g = new THREE.BoxGeometry(size, size, dir.length());
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Z_AXIS, dir.normalize()));
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return nonIndexed(g);
}

// Cylinder (optionally tapered) whose axis runs along Y by default, or along X / Z.
export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  x: number,
  y: number,
  z: number,
  axis: 'x' | 'y' | 'z' = 'y',
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return nonIndexed(g);
}

// Paints a geometry one solid color via a per-vertex color attribute, so
// many differently colored small details can share a single
// vertexColors material (and draw call).
export function tint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const color = new THREE.Color(hex); // converted to linear, matching material colors
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
