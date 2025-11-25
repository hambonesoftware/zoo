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

    const findBoneIndex = (name) => skeleton.bones.findIndex((b) => b.name === name);

    const ensureSkinnedGeometry = (geometry, boneName) => {
      let geo = geometry.index ? geometry.toNonIndexed() : geometry;

      if (!geo.getAttribute('normal')) {
        geo.computeVertexNormals();
      }

      const position = geo.getAttribute('position');
      const vertexCount = position.count;

      if (!geo.getAttribute('uv')) {
        const uv = new Float32Array(vertexCount * 2);
        for (let i = 0; i < vertexCount; i++) {
          uv[i * 2] = position.getX(i);
          uv[i * 2 + 1] = position.getZ(i);
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      }

      const targetBone = findBoneIndex(boneName);
      if (!geo.getAttribute('skinIndex') || !geo.getAttribute('skinWeight')) {
        const skinIndices = new Uint16Array(vertexCount * 4);
        const skinWeights = new Float32Array(vertexCount * 4);
        const boneIndex = targetBone >= 0 ? targetBone : 0;
        for (let i = 0; i < vertexCount; i++) {
          skinIndices[i * 4] = boneIndex;
          skinWeights[i * 4] = 1.0;
        }
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
      }

      return geo;
    };

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
    const torsoGeometry = ensureSkinnedGeometry(generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck', 'head'],
      radii: [0.38, 0.44, 0.33, 0.26 * headScale],
      sides: 10
    }), 'spine_base');

    // === 2. NECK ===
    const neckGeometry = ensureSkinnedGeometry(generateNeckGeometry(skeleton, {
      bones: ['spine_neck', 'head'],
      radii: [0.26, 0.2 * headScale],
      sides: 8
    }), 'spine_neck');

    // === 3. HEAD ===
    const headGeometry = ensureSkinnedGeometry(generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: 0.22 * headScale,
      sides: 14
    }), 'head');

    // === 4. EARS ===
    const leftEar = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['ear_left', 'ear_left_tip'],
      radii: [0.12, 0.07],
      sides: 10
    }), 'ear_left');

    const rightEar = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['ear_right', 'ear_right_tip'],
      radii: [0.12, 0.07],
      sides: 10
    }), 'ear_right');

    // === 5. TAIL ===
    const tailGeometry = ensureSkinnedGeometry(generateTailGeometry(skeleton, {
      bones: ['tail_base', 'tail_mid', 'tail_tip'],
      sides: 6,
      baseRadius: 0.11 * tailScale,
      tipRadius: 0.05 * tailScale
    }), 'tail_base');

    // === 6. LEGS ===
    const legConfig = { sides: 8 };
    const frontRadii = [0.2 * legScale, 0.17 * legScale, 0.14 * legScale, 0.12 * legScale];
    const rearRadii = [0.22 * legScale, 0.18 * legScale, 0.15 * legScale, 0.13 * legScale];

    const fl = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['front_left_shoulder', 'front_left_upper', 'front_left_lower', 'front_left_paw'],
      radii: frontRadii,
      ...legConfig
    }), 'front_left_shoulder');

    const fr = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['front_right_shoulder', 'front_right_upper', 'front_right_lower', 'front_right_paw'],
      radii: frontRadii,
      ...legConfig
    }), 'front_right_shoulder');

    const bl = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['rear_left_hip', 'rear_left_upper', 'rear_left_lower', 'rear_left_paw'],
      radii: rearRadii,
      ...legConfig
    }), 'rear_left_hip');

    const br = ensureSkinnedGeometry(generateLimbGeometry(skeleton, {
      bones: ['rear_right_hip', 'rear_right_upper', 'rear_right_lower', 'rear_right_paw'],
      radii: rearRadii,
      ...legConfig
    }), 'rear_right_hip');

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
