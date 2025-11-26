// src/animals/Anteater/AnteaterSkinTexture.js
// Generates a simple procedural material for the anteater mesh.

import * as THREE from 'three';
import { createAnteaterSkinNode } from './AnteaterSkinNode.js';

export function createAnteaterSkinMaterial(options = {}) {
  const palette = createAnteaterSkinNode();

  const material = new THREE.MeshStandardMaterial({
    color: options.baseColor || palette.baseColor,
    roughness: palette.roughness,
    metalness: palette.metalness,
    flatShading: true
  });

  // Add a subtle stripe band using vertex colors if requested.
  if (options.useStripe) {
    material.vertexColors = true;
  }

  return material;
}
