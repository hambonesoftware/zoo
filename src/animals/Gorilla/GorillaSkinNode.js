// src/animals/Gorilla/GorillaSkinNode.js

import * as THREE from 'three';
import { texture, uv, positionLocal, color, float } from '../../../libs/three.tsl.js';
import { MeshStandardNodeMaterial } from '../../../libs/three.webgpu.js';
import { gorillaSkinCanvasTexture } from './GorillaSkinTexture.js';

/**
 * GorillaSkinNode
 *
 * Node-based skin tuned for a knuckle-walking gorilla silhouette. Emphasizes
 * broad charcoal tones with a lighter chest and face, while keeping a soft
 * sheen so muscles read under studio lights.
 */
export function createGorillaSkinMaterial(options = {}) {
  const baseColorHex = options.bodyColor !== undefined ? options.bodyColor : 0x2f3034;
  const chestColorHex = options.chestColor !== undefined ? options.chestColor : 0x4b4c52;
  const faceColorHex = options.faceColor !== undefined ? options.faceColor : 0x565860;

  const material = new MeshStandardNodeMaterial();
  material.skinning = true;

  const baseCol = color(baseColorHex);
  const chestCol = color(chestColorHex);
  const faceCol = color(faceColorHex);

  // Texture detail from the canvas skin map
  const uvDetail = uv();
  const textureSample = texture(gorillaSkinCanvasTexture, uvDetail).rgb;
  const textureBoost = textureSample.mul(0.35).add(0.85);

  // Subtle underside lift so the silhouette reads in shadow
  const undersideMask = positionLocal.y.mul(-0.65).add(0.85);

  // Chest/face highlights using position masks
  const chestMask = positionLocal.y.mul(0.9).add(0.4).clamp(0.0, 1.0);
  const faceMask = positionLocal.z.mul(0.5).add(0.45).clamp(0.0, 1.0);

  const withChest = baseCol.mul(float(1.0).sub(chestMask)).add(chestCol.mul(chestMask));
  const withFace = withChest.mul(float(1.0).sub(faceMask)).add(faceCol.mul(faceMask));

  const finalColor = withFace.mul(textureBoost).mul(undersideMask);

  material.colorNode = finalColor;
  material.roughnessNode = float(0.62);
  material.metalnessNode = float(0.06);

  material.emissive = new THREE.Color(0x1a1a1a);
  material.emissiveIntensity = 0.28;

  return material;
}
