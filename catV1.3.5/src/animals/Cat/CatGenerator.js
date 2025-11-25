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
    // such as leg length, tail length/curvature and head size.  The
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
    const tailScale   = 1.0 + (variantFactor - 0.5) * 0.15;  // ±7.5%
    const headScale   = 1.0 + (0.5 - variantFactor) * 0.1;   // ±5%

    // === 1. TORSO (sleek feline form) ===
    // Radii indices map to: [Hips, Ribcage, NeckBase, HeadBase]
    const torsoGeometry = generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck', 'head'],
      radii: [0.38, 0.44, 0.33, 0.26 * headScale],
      sides: 10
    });

    // === 2. NECK ===
    const neckGeometry = generateNeckGeometry(skeleton, {
      bones: ['spine_neck', 'head'],
      radii: [0.26, 0.2 * headScale],
      sides: 8
    });

    // === 3. HEAD ===
    const headGeometry = generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: 0.22 * headScale,
      sides: 14
    });

    // === 4. EARS ===
    const leftEar = generateLimbGeometry(skeleton, {
      bones: ['ear_left', 'ear_left_tip'],
      radii: [0.12, 0.07],
      sides: 10
    });

    const rightEar = generateLimbGeometry(skeleton, {
      bones: ['ear_right', 'ear_right_tip'],
      radii: [0.12, 0.07],
      sides: 10
    });

    // === 5. TAIL ===
    const tailGeometry = generateTailGeometry(skeleton, {
      bones: ['tail_base', 'tail_mid', 'tail_tip'],
      sides: 6,
      baseRadius: 0.11 * tailScale,
      tipRadius: 0.05 * tailScale
    });

    // === 6. LEGS ===
    const legConfig = { sides: 8 };
    const frontRadii = [0.2 * legScale, 0.17 * legScale, 0.14 * legScale, 0.12 * legScale];
    const rearRadii = [0.22 * legScale, 0.18 * legScale, 0.15 * legScale, 0.13 * legScale];

    const fl = generateLimbGeometry(skeleton, {
      bones: ['front_left_shoulder', 'front_left_upper', 'front_left_lower', 'front_left_paw'],
      radii: frontRadii,
      ...legConfig
    });

    const fr = generateLimbGeometry(skeleton, {
      bones: ['front_right_shoulder', 'front_right_upper', 'front_right_lower', 'front_right_paw'],
      radii: frontRadii,
      ...legConfig
    });

    const bl = generateLimbGeometry(skeleton, {
      bones: ['rear_left_hip', 'rear_left_upper', 'rear_left_lower', 'rear_left_paw'],
      radii: rearRadii,
      ...legConfig
    });

    const br = generateLimbGeometry(skeleton, {
      bones: ['rear_right_hip', 'rear_right_upper', 'rear_right_lower', 'rear_right_paw'],
      radii: rearRadii,
      ...legConfig
    });

    // === Merge ===
    const mergedGeometry = mergeGeometries(
      [
        torsoGeometry,
        neckGeometry,
        headGeometry,
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

    if (options.debug) {
      console.debug('[CatGenerator] vertex count', mergedGeometry.getAttribute('position').count);
      console.debug('[CatGenerator] torso radii', [0.38, 0.44, 0.33, 0.26 * headScale]);
      console.debug('[CatGenerator] tail radii', [0.11 * tailScale, 0.05 * tailScale]);
      console.debug('[CatGenerator] front leg radii', frontRadii);
      console.debug('[CatGenerator] rear leg radii', rearRadii);
    }

    // === Material (Node-based cat skin) ===
    const material = createCatSkinMaterial({
      bodyColor: options.bodyColor,
      accentColor: options.accentColor,
      bellyColor: options.bellyColor
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new CatBehavior(skeleton, mesh);

    return { mesh, behavior };
  }
}
