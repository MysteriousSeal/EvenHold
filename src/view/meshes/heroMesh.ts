import * as THREE from 'three';

// About 0.45 units tall — roughly door height (0.4), so houses read as
// buildings the hero could walk into rather than dollhouses.
export function buildHero(): THREE.Group {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8823c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.18), bodyMaterial);
  body.position.y = 0.14;
  group.add(body);

  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e4c8 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), headMaterial);
  head.position.y = 0.36;
  group.add(head);

  return group;
}
