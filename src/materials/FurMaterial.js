// src/materials/FurMaterial.js

import * as THREE from 'three';

/**
 * Creates and returns a MeshStandardMaterial configured for a fur/toon effect.
 * @param {number} color - The base color of the fur material (default white).
 * @returns {THREE.MeshStandardMaterial} The configured material.
 */
export function FurMaterial(color = 0xffffff) {
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true,
  });

  // Additional settings or shader modifications for fur can be added here

  return material;
}
