import * as THREE from 'three';

export function buildHero(): THREE.Group {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8823c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), bodyMaterial);
  body.position.y = 0.3;
  group.add(body);

  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e4c8 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), headMaterial);
  head.position.y = 0.75;
  group.add(head);

  return group;
}
