// src/animals/Giraffe/GiraffeSkinNode.js

import * as THREE from 'three';
import {
  clamp,
  color,
  float,
  mx_noise_float,
  normalize,
  normalLocal,
  positionLocal,
  texture,
  uv,
  vec3
} from '../../../libs/three.tsl.js';
import { MeshStandardNodeMaterial } from '../../../libs/three.webgpu.js';
import { giraffeSkinCanvasTexture, giraffeSkinHeightTexture } from './GiraffeSkinTexture.js';

/**
 * GiraffeSkinNode
 *
 * Soft, matte material that blends a procedural giraffe spot texture with a
 * subtle belly lightening. Uses node materials to keep shading consistent with
 * other studio creatures.
 */
export function createGiraffeSkinMaterial(options = {}) {
  const baseColorHex = options.bodyColor !== undefined ? options.bodyColor : 0xc39b6a;
  const spotColorHex = options.spotColor !== undefined ? options.spotColor : 0x6c4c2f;
  const bellyColorHex = options.bellyColor !== undefined ? options.bellyColor : 0xf2dfc6;

  const material = new MeshStandardNodeMaterial();
  material.skinning = true;

  const baseCol = color(baseColorHex);
  const spotCol = color(spotColorHex);
  const bellyCol = color(bellyColorHex);

  const uvDetail = uv();
  const texSample = texture(giraffeSkinCanvasTexture, uvDetail).rgb;
  const textureBoost = texSample.mul(0.4).add(0.85);

  const heightSample = texture(giraffeSkinHeightTexture, uvDetail).r;
  const poreNoise = mx_noise_float(uvDetail.mul(32.0));
  const bumpField = heightSample.add(poreNoise.mul(0.25)).sub(0.5);

  // Gentle belly lightening to help readability from below
  const bellyMask = positionLocal.y.mul(-0.8).add(0.6).clamp(0.0, 1.0);
  const bellyBlend = baseCol.mul(float(1.0).sub(bellyMask)).add(bellyCol.mul(bellyMask));

  // Spot weighting using the texture to lean color toward spot tone
  const spotWeight = texSample.r.mul(0.35);
  const spotBlend = bellyBlend.mul(float(1.0).sub(spotWeight)).add(spotCol.mul(spotWeight));

  const finalColor = spotBlend.mul(textureBoost);

  material.colorNode = finalColor;
  const bentNormal = normalize(
    normalLocal.add(vec3(bumpField.mul(0.12), bumpField.mul(0.09), float(0.0)))
  );

  material.normalNode = bentNormal;

  const baseRoughness = float(0.82);
  const roughnessVariation = bumpField.mul(-0.18);
  material.roughnessNode = clamp(baseRoughness.add(roughnessVariation), 0.6, 0.95);
  material.metalnessNode = float(0.05);

  material.emissive = new THREE.Color(0x1a120d);
  material.emissiveIntensity = 0.24;

  return material;
}
