// src/animals/Elephant/ElephantSkinNode.js

import * as THREE from 'three'; // still resolved by your importmap in index.html
import { texture, uv, positionLocal, color, float } from '../../../libs/three.tsl.js';
import { MeshStandardNodeMaterial } from '../../../libs/three.webgpu.js';
import { elephantSkinCanvasTexture } from './ElephantSkinTexture.js';

/**
 * ElephantSkinNode
 *
 * Builds a MeshStandardNodeMaterial that combines:
 *  - A low-frequency, position-based "wrinkle field" using TSL nodes
 *  - A medium/high-frequency CanvasTexture for pores + fine creases
 *
 * The goal is a fully procedural, tile-friendly elephant skin that still
 * feels organic when the mesh deforms and moves, but with a bright,
 * readable look suitable for a kids' game.
 */
export function createElephantSkinMaterial(options = {}) {
  // Brighter, slightly warmer default base colour so the animal reads clearly.
  const baseColorHex =
    options.bodyColor !== undefined ? options.bodyColor : 0x999b9f;

  const material = new MeshStandardNodeMaterial();
  material.skinning = true; // Enable skinning for the SkinnedMesh

  // When we are in low-poly mode, use flat shading so each face becomes
  // a visible facet rather than a smooth gradient.
  const lowPoly = options.lowPoly === true || options.flatShading === true;
  if (lowPoly) {
    material.flatShading = true;
    material.needsUpdate = true;
  }

  // ------------------------------------------------------------
  // 1) Low-frequency macro shading based on local position
  // ------------------------------------------------------------
  //
  // We use positionLocal from TSL so the wrinkles "stick" to the mesh
  // as it animates (vs. being view or world-space). We scale the
  // coordinates to control the frequency of the sine bands.
  const p = positionLocal.mul(0.22); // mild scaling

  // Vertical and horizontal banding to suggest big skin folds. The
  // sine/abs pattern yields a value in [0,1] for each axis. Frequencies
  // are tuned mostly for trunk + joints.
  const verticalBands = p.y.mul(3.0).sin().abs(); // [0,1]
  const horizontalBands = p.x.mul(2.0).sin().abs(); // [0,1]

  // Combine and normalize back into ~[0,1].
  const macroMask = verticalBands.add(horizontalBands).mul(0.5);

  // Base elephant color (slightly warm grey) modulated by macroMask.
  // Contrast is kept soft so we don't crush the darkest tones.
  const baseCol = color(baseColorHex);
  let macroColor = baseCol.mul(macroMask.mul(0.15).add(0.85));

  // ------------------------------------------------------------
  // 2) CanvasTexture detail for pores + tiny wrinkles
  // ------------------------------------------------------------
  //
  // The CanvasTexture gives us very fine-scale detail that is expensive
  // to synthesize in 3D, but cheap to store in a single 2D texture.
  const uvDetail = uv(); // 0–1 across the surface
  const canvasSample = texture(elephantSkinCanvasTexture, uvDetail);
  const canvasRGB = canvasSample.rgb;

  // Lift the canvas sample so dark regions never head to pure black.
  const canvasBoost = canvasRGB.mul(0.4).add(0.8);

  // ------------------------------------------------------------
  // 3) Very gentle underside darkening (AO-style)
  // ------------------------------------------------------------
  // Use the negative of the y-position to bias undersides slightly
  // brighter and the top slightly darker. The range stays around
  // 0.85–1.05 so it's more of a soft shaping than real AO.
  const undersideRaw = positionLocal.y.mul(-0.5); // negative y => positive
  const undersideFactor = undersideRaw.mul(0.1).add(0.95);

  // ------------------------------------------------------------
  // 4) Region colour variations using positional masks
  // ------------------------------------------------------------
  // All regional masks are intentionally soft and subtle so the
  // elephant still reads as one cohesive material.

  // Trunk: darken the trunk slightly. The trunk sits mostly forward
  // along the Z axis and below the head along the Y axis.
  const trunkMask = positionLocal.z.mul(0.5).add(0.35)
    .mul(positionLocal.y.mul(-0.25).add(0.75));
  const trunkColor = baseCol.mul(0.9);

  // Legs: lighten the legs slightly toward the toes. Negative Y
  // positions correspond to the lower parts of the limbs.
  const legMask = positionLocal.y.mul(-1.0).mul(0.35).add(0.65);
  const legColor = baseCol.mul(1.08);

  // Tusks: brighten tusks and reduce roughness. Tusks protrude forward
  // along positive Z and sit near the head. Use a mask based on Z.
  const tuskMask = positionLocal.z.mul(0.6).add(0.4);
  const tuskColor = baseCol.mul(1.8);

  // Toe ring: highlight the toe/hoof band near the base of each leg.
  const toeMask = positionLocal.y.mul(-2.0).add(1.4);
  const toeColor = baseCol.mul(1.25);

  // Ear interior: softly blend to a warm pink on inward-facing surfaces
  // near the head, keeping the exterior closer to the base grey.
  const earSideMask = positionLocal.x.abs().mul(0.7).add(0.15);
  const earFacingMask = positionLocal.z.mul(-1.0).mul(0.9).add(0.55);
  const earMask = earSideMask.mul(earFacingMask);
  const earColor = color(0xf2c8c6);

  // Blend the colours together using the masks. Start with macroColor
  // (wrinkled base) and progressively lerp toward the regional colours.
  // We rely on the masks' magnitudes being modest so these blends are
  // gentle rather than hard stripes.
  const mixTrunk = macroColor
    .mul(float(1.0).sub(trunkMask))
    .add(trunkColor.mul(trunkMask));
  const mixLeg = mixTrunk
    .mul(float(1.0).sub(legMask))
    .add(legColor.mul(legMask));
  const mixTusk = mixLeg
    .mul(float(1.0).sub(tuskMask))
    .add(tuskColor.mul(tuskMask));
  const mixToe = mixTusk
    .mul(float(1.0).sub(toeMask))
    .add(toeColor.mul(toeMask));
  const mixEar = mixToe
    .mul(float(1.0).sub(earMask))
    .add(earColor.mul(earMask));

  // Apply underside shaping and high-frequency canvas detail.
  const finalColor = mixEar.mul(canvasBoost).mul(undersideFactor);

  material.colorNode = finalColor;

  // Roughness: tusks should be smoother; we use the tusk mask to
  // interpolate between a base roughness and a lower value.
  const baseRough = float(0.9);
  const smoothRough = float(0.45);
  material.roughnessNode = baseRough
    .mul(float(1.0).sub(tuskMask))
    .add(smoothRough.mul(tuskMask));

  material.metalnessNode = float(0.02);

  // Tiny emissive to keep the elephant readable even in shadow. This is
  // a plain THREE.Color, not a node, so it's safe to set here.
  material.emissive = new THREE.Color(0x222222);
  material.emissiveIntensity = 0.35;

  return material;
}
