// src/animals/CatGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { CatBehavior } from './CatBehavior.js';

import { createCatSkinMaterial } from './CatSkinNode.js';

export class CatGenerator {
  static generate(skeleton, options = {}) {
    // Make sure all bone world matrices are current before sampling.
    skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

    // ------------------------------------------------------------
    // Variant processing
    //
    // A subtle size/age variant can be supplied via options.variantSeed.
    // This seed controls small variations in the proportions of the animal
    // such as leg length, tusk length/curvature and head size.  The
    // function below produces a reproducible pseudo‑random number in
    // [0,1] from an integer seed.  If no seed is provided the value is
    // 0.5, corresponding to the baseline proportions.  These factors
    // gently modulate the radii and lengths defined below.
    const seed = typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => {
      // simple deterministic PRNG based on sine; yields 0..1
      return Math.abs(Math.sin(s * 43758.5453)) % 1;
    };
    const variantFactor = random01(seed);
    // Map variantFactor into ranges for each feature.  These ranges are
    // chosen so that the resulting cats remain recognisably the same
    // stylised species while still exhibiting subtle differences.
    const legScale    = 1.0 + (variantFactor - 0.5) * 0.2;   // ±10%
    const tuskScale   = 1.0 + (variantFactor - 0.5) * 0.3;   // ±15%
    const headScale   = 1.0 + (0.5 - variantFactor) * 0.15;  // ±7.5%

    // === 1. TORSO (The Tank) ===
    // Radii indices map to: [Hips, Ribcage, NeckBase, HeadBase]
    const torsoGeometry = generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck', 'head'],
      // Slightly smooth the transitions between hips, ribcage and neck
      radii: [1.15 * headScale, 1.35, 1.15, 0.9 * headScale],
      // Increase the number of sides moderately for a rounder barrel
      sides: 28
    });

    // === 2. HEAD ===
    const headGeometry = generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: 0.95 * headScale, // Big dome scaled by variant
      sides: 22
    });

    // === 3. TRUNK (Prehensile) ===
    const trunkGeometry = generateTailGeometry(skeleton, {
      bones: ['trunk_base', 'trunk_mid1', 'trunk_mid2', 'trunk_tip'],
      // Increase sides for smoother curvature on the trunk
      sides: 24,
      baseRadius: 0.35,
      tipRadius: 0.1
    });

    // === 4. TUSKS (Start -> Tip) ===
    const leftTusk = generateTailGeometry(skeleton, {
      bones: ['tusk_left', 'tusk_left_tip'],
      sides: 16,
      baseRadius: 0.12,
      tipRadius: 0.02,
      lengthScale: tuskScale
    });

    const rightTusk = generateTailGeometry(skeleton, {
      bones: ['tusk_right', 'tusk_right_tip'],
      sides: 16,
      baseRadius: 0.12,
      tipRadius: 0.02,
      lengthScale: tuskScale
    });

    // === 5. EARS ===
    // We create a thin, sagging flap by using a limb generator with
    // increased segments and tapered radii.  The outer tip radius is
    // smaller than the base to suggest a heavy hanging sheet of skin.
    const leftEar = generateLimbGeometry(skeleton, {
      bones: ['ear_left', 'ear_left_tip'],
      radii: [0.65, 0.35],
      sides: 20
    });

    const rightEar = generateLimbGeometry(skeleton, {
      bones: ['ear_right', 'ear_right_tip'],
      radii: [0.65, 0.35],
      sides: 20
    });

    // === 6. TAIL ===
    const tailGeometry = generateTailGeometry(skeleton, {
      bones: ['tail_base', 'tail_mid', 'tail_tip'],
      sides: 14,
      baseRadius: 0.15,
      tipRadius: 0.05
    });

    // === 7. LEGS (Pillars) ===
    const legConfig = { sides: 20 };

    // To emphasise the toe/hoof band near the bottom of each leg we
    // introduce an additional radius entry just above the foot.  The
    // bottom radius flares slightly outward, and the preceding radius
    // tapers inward to create a subtle ring.  Leg length is modulated
    // by the legScale variant.
    const fl = generateLimbGeometry(skeleton, {
      bones: ['front_left_collarbone', 'front_left_upper', 'front_left_lower', 'front_left_foot'],
      radii: [0.5 * legScale, 0.45 * legScale, 0.4 * legScale, 0.38 * legScale, 0.43 * legScale],
      ...legConfig
    });

    const fr = generateLimbGeometry(skeleton, {
      bones: ['front_right_collarbone', 'front_right_upper', 'front_right_lower', 'front_right_foot'],
      radii: [0.5 * legScale, 0.45 * legScale, 0.4 * legScale, 0.38 * legScale, 0.43 * legScale],
      ...legConfig
    });

    const bl = generateLimbGeometry(skeleton, {
      bones: ['back_left_pelvis', 'back_left_upper', 'back_left_lower', 'back_left_foot'],
      radii: [0.55 * legScale, 0.5 * legScale, 0.42 * legScale, 0.38 * legScale, 0.44 * legScale],
      ...legConfig
    });

    const br = generateLimbGeometry(skeleton, {
      bones: ['back_right_pelvis', 'back_right_upper', 'back_right_lower', 'back_right_foot'],
      radii: [0.55 * legScale, 0.5 * legScale, 0.42 * legScale, 0.38 * legScale, 0.44 * legScale],
      ...legConfig
    });

    // === Merge ===
    const mergedGeometry = mergeGeometries(
      [
        torsoGeometry,
        headGeometry,
        trunkGeometry,
        leftTusk,
        rightTusk,
        leftEar,
        rightEar,
        tailGeometry,
        fl,
        fr,
        bl,
        br
      ],
      false
    );

        // === Material (Node-based cat skin) ===
    const material = createCatSkinMaterial({
      bodyColor: options.bodyColor
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new CatBehavior(skeleton, mesh);

    return { mesh, behavior };
  }
}
