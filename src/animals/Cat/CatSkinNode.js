// src/animals/Cat/CatSkinNode.js

import * as THREE from 'three'; // still resolved by your importmap in index.html
import { texture, uv, positionLocal, color, float } from '../../../libs/three.tsl.js';
import { MeshStandardNodeMaterial } from '../../../libs/three.webgpu.js';
import { catSkinCanvasTexture } from './CatSkinTexture.js';

/**
 * CatSkinNode
 *
 * Visual goals (Phase 3):
 * - Warm feline palette with readable accents (belly + subtle striping).
 * - Low metalness, mid/high roughness for soft fur highlights.
 * - Vertical shading that lightens the underside so the silhouette reads in the
 *   dark studio corner.
 */
export function createCatSkinMaterial(options = {}) {
  const baseColorHex = options.bodyColor !== undefined ? options.bodyColor : 0xc08a57;
  const accentColorHex = options.accentColor !== undefined ? options.accentColor : 0x7a4d30;
  const bellyColorHex = options.bellyColor !== undefined ? options.bellyColor : 0xf0d9b5;

  const material = new MeshStandardNodeMaterial();
  material.skinning = true;

  const baseCol = color(baseColorHex);
  const accentCol = color(accentColorHex);
  const bellyCol = color(bellyColorHex);

  // ------------------------------------------------------------
  // 1) Texture detail (procedural fur canvas)
  // ------------------------------------------------------------
  const uvDetail = uv();
  const textureSample = texture(catSkinCanvasTexture, uvDetail);
  const textureBoost = textureSample.rgb.mul(0.45).add(0.75);

  // ------------------------------------------------------------
  // 2) Belly gradient (lighter underside)
  // ------------------------------------------------------------
  const bellyMask = positionLocal.y.mul(-0.9).add(0.45); // negative y => bigger mask
  const bellyBlend = baseCol.mul(float(1.0).sub(bellyMask)).add(bellyCol.mul(bellyMask));

  // ------------------------------------------------------------
  // 3) Accent striping along torso/tail using local X/Z
  // ------------------------------------------------------------
  const stripeField = positionLocal.z.mul(6.0).add(positionLocal.x.mul(3.0)).sin().abs();
  const stripeStrength = stripeField.mul(0.25);
  const accentBlend = bellyBlend
    .mul(float(1.0).sub(stripeStrength))
    .add(accentCol.mul(0.85).mul(stripeStrength));

  // ------------------------------------------------------------
  // 4) Spine shading (slightly darker along the back)
  // ------------------------------------------------------------
  const spineShade = float(1.0).sub(positionLocal.y.mul(0.12));

  const finalColor = accentBlend.mul(textureBoost).mul(spineShade);
  material.colorNode = finalColor;

  material.roughnessNode = float(0.68);
  material.metalnessNode = float(0.02);

  material.emissive = new THREE.Color(0x1a1a1a);
  material.emissiveIntensity = 0.25;

  return material;
}
