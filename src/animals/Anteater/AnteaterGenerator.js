// src/animals/Anteater/AnteaterGenerator.js
// Builds a simple stylized anteater mesh and hooks up behavior scaffolding.

import * as THREE from 'three';
import { AnteaterBehavior } from './AnteaterBehavior.js';
import { createAnteaterSkinMaterial } from './AnteaterSkinTexture.js';

export class AnteaterGenerator {
  static generate(options = {}) {
    const group = new THREE.Group();
    const material = createAnteaterSkinMaterial(options.material || {});

    // Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 12, 18), material);
    body.position.set(0, 0.5, 0);
    group.add(body);

    // Head and snout
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), material.clone());
    head.position.set(0.55, 0.65, 0);
    head.material.color = material.color.clone().multiplyScalar(0.9);
    group.add(head);

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 10), material.clone());
    snout.rotation.z = Math.PI / 2;
    snout.position.set(0.85, 0.62, 0);
    snout.material.color = material.color.clone().multiplyScalar(0.8);
    group.add(snout);

    // Tail
    const tailGeometry = new THREE.ConeGeometry(0.18, 0.7, 12);
    const tail = new THREE.Mesh(tailGeometry, material.clone());
    tail.position.set(-0.6, 0.55, 0);
    tail.rotation.z = -Math.PI / 6;
    group.add(tail);

    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8);
    const legPositions = [
      [-0.2, 0.2, 0.15],
      [0.2, 0.2, 0.15],
      [-0.2, 0.2, -0.15],
      [0.2, 0.2, -0.15]
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeometry, material.clone());
      leg.position.set(x, y, z);
      group.add(leg);
    });

    // Subtle stripe along the body
    const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.8, 8, 12), material.clone());
    stripe.position.set(-0.05, 0.6, 0);
    stripe.scale.set(1, 0.7, 0.65);
    stripe.material.color.set(0x2f2b29);
    group.add(stripe);

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const behavior = new AnteaterBehavior(options.behavior || {});
    return { mesh: group, behavior };
  }
}
