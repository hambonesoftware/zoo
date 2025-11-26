// src/animals/Giraffe/GiraffeGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { GiraffeBehavior } from './GiraffeBehavior.js';
import { createGiraffeSkinMaterial } from './GiraffeSkinNode.js';

export class GiraffeGenerator {
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

    const torsoGeometry = ensureSkinnedGeometry(
      generateTorsoGeometry(skeleton, {
        bones: ['spine_base', 'spine_mid', 'spine_neck_base', 'spine_neck_mid', 'spine_neck_top'],
        radii: [0.45, 0.52, 0.32, 0.25, 0.18],
        sides: 14
      }),
      'spine_base'
    );

    const headGeometry = ensureSkinnedGeometry(
      generateHeadGeometry(skeleton, {
        parentBone: 'head',
        radius: 0.34,
        sides: 12
      }),
      'head'
    );

    const leftOssicone = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['ossicone_left', 'ossicone_left_tip'],
        radii: [0.06, 0.04],
        sides: 6,
        rings: 3
      }),
      'ossicone_left'
    );

    const rightOssicone = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['ossicone_right', 'ossicone_right_tip'],
        radii: [0.06, 0.04],
        sides: 6,
        rings: 3
      }),
      'ossicone_right'
    );

    const tailGeometry = ensureSkinnedGeometry(
      generateTailGeometry(skeleton, {
        bones: ['tail_base', 'tail_mid', 'tail_tip'],
        sides: 6,
        baseRadius: 0.1,
        tipRadius: 0.06
      }),
      'tail_base'
    );

    const legConfig = { sides: 10, rings: 6 };
    const frontRadii = [0.22, 0.2, 0.18, 0.16];
    const rearRadii = [0.24, 0.21, 0.19, 0.16];

    const fl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['front_left_shoulder', 'front_left_upper', 'front_left_lower', 'front_left_hoof'],
        radii: frontRadii,
        ...legConfig
      }),
      'front_left_shoulder'
    );

    const fr = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['front_right_shoulder', 'front_right_upper', 'front_right_lower', 'front_right_hoof'],
        radii: frontRadii,
        ...legConfig
      }),
      'front_right_shoulder'
    );

    const rl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['rear_left_hip', 'rear_left_upper', 'rear_left_lower', 'rear_left_hoof'],
        radii: rearRadii,
        ...legConfig
      }),
      'rear_left_hip'
    );

    const rr = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['rear_right_hip', 'rear_right_upper', 'rear_right_lower', 'rear_right_hoof'],
        radii: rearRadii,
        ...legConfig
      }),
      'rear_right_hip'
    );

    const mergedGeometry = mergeGeometries(
      [torsoGeometry, headGeometry, leftOssicone, rightOssicone, tailGeometry, fl, fr, rl, rr],
      false
    );

    const material = createGiraffeSkinMaterial({
      bodyColor: options.bodyColor,
      textureOptions: options.textureOptions
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new GiraffeBehavior(skeleton, mesh, options);

    return { mesh, behavior };
  }
}
