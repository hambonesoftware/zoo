// src/animals/Gorilla/GorillaGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { GorillaBehavior } from './GorillaBehavior.js';

export class GorillaGenerator {
  static generate(skeleton, options = {}) {
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

    const seed = typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => Math.abs(Math.sin(s * 43758.5453)) % 1;
    const variantFactor = random01(seed);
    const armScale = 1 + (variantFactor - 0.5) * 0.2;
    const headScale = 1 + (0.5 - variantFactor) * 0.1;

    const torsoGeometry = ensureSkinnedGeometry(
      generateTorsoGeometry(skeleton, {
        bones: ['spine_base', 'spine_mid', 'spine_neck', 'head'],
        radii: [0.8, 0.95, 0.75, 0.55 * headScale],
        sides: 18
      }),
      'spine_base'
    );

    const neckGeometry = ensureSkinnedGeometry(
      generateNeckGeometry(skeleton, {
        bones: ['spine_neck', 'head'],
        radii: [0.3, 0.25 * headScale],
        sides: 12
      }),
      'spine_neck'
    );

    const headGeometry = ensureSkinnedGeometry(
      generateHeadGeometry(skeleton, {
        parentBone: 'head',
        radius: 0.36 * headScale,
        sides: 14
      }),
      'head'
    );

    const armConfig = { sides: 12 };
    const upperArmRadii = [0.26 * armScale, 0.24 * armScale, 0.23 * armScale];

    const leftArm = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['shoulder_left', 'arm_left_upper', 'arm_left_lower', 'hand_left'],
        radii: [...upperArmRadii, 0.2 * armScale],
        ...armConfig
      }),
      'shoulder_left'
    );
    const rightArm = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['shoulder_right', 'arm_right_upper', 'arm_right_lower', 'hand_right'],
        radii: [...upperArmRadii, 0.2 * armScale],
        ...armConfig
      }),
      'shoulder_right'
    );

    const legConfig = { sides: 12 };
    const legRadii = [0.28, 0.26, 0.24, 0.22];
    const leftLeg = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['hip_left', 'leg_left_upper', 'leg_left_lower', 'foot_left'],
        radii: legRadii,
        ...legConfig
      }),
      'hip_left'
    );
    const rightLeg = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['hip_right', 'leg_right_upper', 'leg_right_lower', 'foot_right'],
        radii: legRadii,
        ...legConfig
      }),
      'hip_right'
    );

    const mergedGeometry = mergeGeometries(
      [torsoGeometry, neckGeometry, headGeometry, leftArm, rightArm, leftLeg, rightLeg],
      false
    );

    const material = new THREE.MeshStandardMaterial({
      color: options.bodyColor || 0x3b3b3b,
      roughness: 0.65,
      metalness: 0.08,
      skinning: true
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new GorillaBehavior(skeleton, mesh, options);

    return { mesh, behavior };
  }
}
