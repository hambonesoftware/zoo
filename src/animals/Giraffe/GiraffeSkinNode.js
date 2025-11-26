// src/animals/Giraffe/GiraffeSkinNode.js

import * as THREE from 'three';
import { createGiraffeSkinTexture } from './GiraffeSkinTexture.js';

export function createGiraffeSkinMaterial(options = {}) {
  const texture = createGiraffeSkinTexture(options.textureOptions);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: options.bodyColor !== undefined ? options.bodyColor : 0xe1c293,
    roughness: 0.78,
    metalness: 0.04,
    skinning: true
  });

  material.normalScale = new THREE.Vector2(0.4, 0.4);
  material.emissive = new THREE.Color(0x1c1c1c);
  material.emissiveIntensity = 0.15;
  return material;
}
