// src/animals/Giraffe/GiraffeGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
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
      const boneIndex = targetBone >= 0 ? targetBone : 0;
      if (!geo.getAttribute('skinIndex') || !geo.getAttribute('skinWeight')) {
        const skinIndices = new Uint16Array(vertexCount * 4);
        const skinWeights = new Float32Array(vertexCount * 4);
        for (let i = 0; i < vertexCount; i++) {
          skinIndices[i * 4] = boneIndex;
          skinWeights[i * 4] = 1.0;
        }
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
      }

      return geo;
    };

    const samplePosition = (boneName) => {
      const bone = skeleton.bones.find((b) => b.name === boneName);
      return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld) : null;
    };

    const seed = typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => Math.abs(Math.sin(s * 43758.5453)) % 1;
    const variantFactor = random01(seed);

    const neckScale = (1 + (variantFactor - 0.5) * 0.25) * (options.neckRadiusScale || 1); // ±12.5%
    const headScale = 1 + (0.5 - variantFactor) * 0.1; // ±5%
    const legScale = (1 + (variantFactor - 0.5) * 0.15) * (options.legRadiusScale || 1); // ±7.5%
    const torsoScale = (1 + (variantFactor - 0.5) * 0.08) * (options.torsoRadiusScale || 1); // subtle ±4%

    const lowPoly = options.lowPoly === true;
    const lowPolySides = options.sides || (lowPoly ? 10 : 18);
    const ringsPerSegment = Math.max(1, options.ringsPerSegment || 2);

    // === 1. Torso ===
    const torsoGeometry = ensureSkinnedGeometry(
      generateTorsoGeometry(skeleton, {
        bones: ['spine_base', 'spine_mid', 'spine_upper'],
        radii: [0.62 * torsoScale, 0.7 * torsoScale, 0.55 * torsoScale],
        sides: lowPolySides,
        ringsPerSegment,
        extendRumpToRearLegs: true
      }),
      'spine_base'
    );

    // === 2. Neck ===
    const neckGeometry = ensureSkinnedGeometry(
      generateNeckGeometry(skeleton, {
        bones: ['neck_0', 'neck_1', 'neck_2', 'neck_3', 'neck_4', 'neck_5'],
        headBone: 'head',
        neckTipBone: 'neck_5',
        sides: lowPolySides,
        radii: [
          0.36 * neckScale,
          0.33 * neckScale,
          0.28 * neckScale,
          0.24 * neckScale,
          0.2 * neckScale,
          0.18 * neckScale
        ],
        capBase: true
      }),
      'neck_0'
    );

    // === 3. Head ===
    const neckTip = samplePosition('neck_5');
    const headPos = samplePosition('head');
    const headDir = headPos && neckTip ? headPos.clone().sub(neckTip) : new THREE.Vector3(0, 0, 1);
    if (headDir.lengthSq() < 1e-6) headDir.set(0, 0, 1);
    const headMid = neckTip && headPos ? neckTip.clone().lerp(headPos, 0.6) : new THREE.Vector3();
    const headLength = headPos && neckTip ? neckTip.distanceTo(headPos) + 0.2 : 0.6;

    const headDetail = lowPoly ? 0 : 1;
    let headGeometry = new THREE.IcosahedronGeometry(1.0, headDetail);
    headGeometry.scale(0.3 * headScale, 0.26 * headScale, headLength * 0.55);
    const headQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), headDir.clone().normalize());
    headGeometry.applyQuaternion(headQuat);
    headGeometry.translate(headMid.x, headMid.y, headMid.z);
    headGeometry = ensureSkinnedGeometry(headGeometry, 'head');

    // === 4. Horns ===
    const makeConeForBone = (boneName, radius, height) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();
      const cone = new THREE.ConeGeometry(radius, height, lowPoly ? 6 : 10);
      cone.translate(bonePos.x, bonePos.y + height * 0.5, bonePos.z);
      return ensureSkinnedGeometry(cone, boneName);
    };

    const hornLeft = makeConeForBone('horn_left', 0.06, 0.22);
    const hornRight = makeConeForBone('horn_right', 0.06, 0.22);

    // === 5. Ears ===
    const makeEar = (boneName) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();
      const earGeo = new THREE.BoxGeometry(0.28, 0.14, 0.05);
      earGeo.translate(bonePos.x, bonePos.y, bonePos.z - 0.02);
      return ensureSkinnedGeometry(earGeo, boneName);
    };

    const earLeft = makeEar('ear_left');
    const earRight = makeEar('ear_right');

    // === 6. Tail ===
    const tailGeometry = ensureSkinnedGeometry(
      generateTailGeometry(skeleton, {
        bones: ['tail_0', 'tail_1', 'tail_tip'],
        sides: lowPoly ? 6 : 10,
        baseRadius: 0.12,
        tipRadius: 0.05
      }),
      'tail_0'
    );

    // === 7. Legs ===
    const limbOptions = {
      sides: lowPoly ? 8 : 12,
      rings: Math.max(3, ringsPerSegment + 2),
      ringBias: 0.2
    };

    const frontRadii = [0.26 * legScale, 0.22 * legScale, 0.18 * legScale, 0.16 * legScale];
    const backRadii = [0.28 * legScale, 0.23 * legScale, 0.19 * legScale, 0.16 * legScale];

    const fl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['front_left_shoulder', 'front_left_upper', 'front_left_lower', 'front_left_foot'],
        radii: frontRadii,
        ...limbOptions
      }),
      'front_left_shoulder'
    );

    const fr = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['front_right_shoulder', 'front_right_upper', 'front_right_lower', 'front_right_foot'],
        radii: frontRadii,
        ...limbOptions
      }),
      'front_right_shoulder'
    );

    const bl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['back_left_hip', 'back_left_upper', 'back_left_lower', 'back_left_foot'],
        radii: backRadii,
        ...limbOptions
      }),
      'back_left_hip'
    );

    const br = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: ['back_right_hip', 'back_right_upper', 'back_right_lower', 'back_right_foot'],
        radii: backRadii,
        ...limbOptions
      }),
      'back_right_hip'
    );

    // === Merge ===
    const mergedGeometry = mergeGeometries(
      [
        torsoGeometry,
        neckGeometry,
        headGeometry,
        hornLeft,
        hornRight,
        earLeft,
        earRight,
        tailGeometry,
        fl,
        fr,
        bl,
        br
      ],
      false
    );

    const material = createGiraffeSkinMaterial({
      bodyColor: options.bodyColor,
      spotColor: options.spotColor,
      bellyColor: options.bellyColor
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    return { mesh, behavior: null };
  }
}
