// src/animals/Anteater/AnteaterSkinNode.js
// Lightweight material palette for the anteater so future node-based
// shading work has a consistent starting point.

import * as THREE from 'three';

export function createAnteaterSkinNode() {
  return {
    baseColor: new THREE.Color(0x6c5a45),
    stripeColor: new THREE.Color(0x2f2b29),
    snoutColor: new THREE.Color(0x4d4136),
    roughness: 0.8,
    metalness: 0.05
  };
}
