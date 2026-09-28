// Small geometry helpers shared by the house and well builders. Every
// helper returns non-indexed geometry, since mergeGeometries needs all of
// its inputs to agree on that.

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

// Upright cylinder (optionally tapered), or lying along X when `alongX` is set.
export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  x: number,
  y: number,
  z: number,
  alongX = false,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  if (alongX) g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return nonIndexed(g);
}
