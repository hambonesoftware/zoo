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
    const neckBones = Array.isArray(options.neckBones) && options.neckBones.length > 0
      ? options.neckBones
      : ['neck_0', 'neck_1', 'neck_2', 'neck_3', 'neck_4', 'neck_5', 'neck_6'];
    const neckTipName = neckBones[neckBones.length - 1] || 'neck_6';
    const neckBlendBone = options.neckBone || (neckBones.length > 1 ? neckBones[neckBones.length - 2] : neckTipName);

    const lowPoly = options.lowPoly === true;
    const lowPolySides = options.sides || (lowPoly ? 10 : 18);
    const ringsPerSegment = Math.max(1, options.ringsPerSegment || 2);
    const neckRingsPerSegment = Math.max(3, options.neckRingsPerSegment || ringsPerSegment);

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
        bones: neckBones,
        headBone: 'head',
        neckTipBone: neckTipName,
        sides: lowPolySides,
        ringsPerSegment: neckRingsPerSegment,
        radii: [
          0.44 * neckScale,
          0.4 * neckScale,
          0.36 * neckScale,
          0.32 * neckScale,
          0.28 * neckScale,
          0.24 * neckScale,
          0.2 * neckScale
        ],
        capBase: true
      }),
      'neck_0'
    );

    // === 3. Head ===
    const neckTip = samplePosition(neckTipName);
    const headPos = samplePosition('head');
    const headDir = headPos && neckTip ? headPos.clone().sub(neckTip) : new THREE.Vector3(0, 0, 1);
    if (headDir.lengthSq() < 1e-6) headDir.set(0, 0, 1);
    const headMid = neckTip && headPos ? neckTip.clone().lerp(headPos, 0.6) : new THREE.Vector3();
    const headLength = headPos && neckTip ? neckTip.distanceTo(headPos) + 0.2 : 0.6;
    let headGeometry;

    const headDirNorm = headDir.clone().normalize();
    const headQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), headDirNorm);

    const muzzleLength = headLength * 0.55;
    const muzzleRadius = 0.12 * headScale;
    const muzzle = new THREE.CapsuleGeometry(muzzleRadius, muzzleLength, lowPoly ? 4 : 6, lowPoly ? 6 : 12);
    muzzle.scale(0.9, 0.8, 1.0);
    muzzle.applyQuaternion(headQuat);
    const muzzleBase = neckTip && headPos ? neckTip.clone().lerp(headPos, 0.35) : headMid.clone();
    muzzle.translate(muzzleBase.x + headDirNorm.x * (muzzleLength * 0.35), muzzleBase.y + headDirNorm.y * (muzzleLength * 0.35), muzzleBase.z + headDirNorm.z * (muzzleLength * 0.35));

    const domeRadius = 0.24 * headScale;
    const dome = new THREE.SphereGeometry(domeRadius, lowPoly ? 8 : 14, lowPoly ? 6 : 10, 0, Math.PI * 2, 0, Math.PI * 0.72);
    dome.scale(1.0, 0.92, 1.05);
    dome.applyQuaternion(headQuat);
    const domeOffset = muzzleBase.clone().add(headDirNorm.clone().multiplyScalar(muzzleLength * 0.85));
    dome.translate(domeOffset.x, domeOffset.y, domeOffset.z);

    headGeometry = ensureSkinnedGeometry(mergeGeometries([muzzle, dome], false), 'head');

    // === 4. Horns ===
    const makeCurvedHorn = (boneName, radius, length, lateralCurve) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();
      const base = bonePos.clone();
      const tip = bonePos.clone().add(new THREE.Vector3(0, length * 0.9, 0));
      const control = bonePos
        .clone()
        .add(new THREE.Vector3(lateralCurve, length * 0.6, length * 0.08));
      const curve = new THREE.CatmullRomCurve3([base, control, tip]);
      const tube = new THREE.TubeGeometry(curve, lowPoly ? 8 : 14, radius, lowPoly ? 6 : 10, false);
      const capTop = new THREE.SphereGeometry(radius * 0.95, lowPoly ? 6 : 10, lowPoly ? 4 : 8);
      capTop.translate(tip.x, tip.y, tip.z);
      const capBase = new THREE.SphereGeometry(radius, lowPoly ? 6 : 10, lowPoly ? 4 : 8);
      capBase.translate(base.x, base.y, base.z);

      const hornGeometry = mergeGeometries([tube, capTop, capBase], false);
      return ensureSkinnedGeometry(hornGeometry, boneName);
    };

    const hornLeft = makeCurvedHorn('horn_left', 0.05, 0.24, -0.05);
    const hornRight = makeCurvedHorn('horn_right', 0.05, 0.24, 0.05);

    // === 5. Ears ===
    const makeEar = (boneName, flip = 1) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();

      const earShape = new THREE.Shape();
      earShape.moveTo(0, 0);
      earShape.lineTo(0.18, 0.04);
      earShape.lineTo(0.12, 0.16);
      earShape.lineTo(-0.02, 0.12);
      earShape.closePath();

      const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.045, bevelEnabled: false });
      earGeo.translate(-0.08, -0.08, -0.0225);
      earGeo.scale(1, 1, 1 + (flip < 0 ? 0.05 : 0));
      earGeo.rotateZ(THREE.MathUtils.degToRad(10 * flip));
      earGeo.rotateX(THREE.MathUtils.degToRad(-8));
      earGeo.translate(bonePos.x, bonePos.y + 0.02, bonePos.z - 0.04);
      return ensureSkinnedGeometry(earGeo, boneName);
    };

    const earLeft = makeEar('ear_left', -1);
    const earRight = makeEar('ear_right', 1);

    // === Neck / Head Blend ===
    let neckBlendGeometry = null;
    if (neckTip && headPos) {
      const blendLength = Math.max(0.08, headLength * 0.15);
      const radiusBottom = 0.18 * neckScale;
      const radiusTop = muzzleRadius * 0.9;
      const blendCylinder = new THREE.CylinderGeometry(radiusTop, radiusBottom, blendLength, lowPoly ? 8 : 12, 1, false);
      const blendQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), headDirNorm);
      blendCylinder.applyQuaternion(blendQuat);
      const blendStart = neckTip.clone();
      const blendOffset = headDirNorm.clone().multiplyScalar(blendLength * 0.5);
      blendCylinder.translate(blendStart.x + blendOffset.x, blendStart.y + blendOffset.y, blendStart.z + blendOffset.z);
      neckBlendGeometry = ensureSkinnedGeometry(blendCylinder, neckBlendBone);
    }

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
        neckBlendGeometry,
        hornLeft,
        hornRight,
        earLeft,
        earRight,
        tailGeometry,
        fl,
        fr,
        bl,
        br
      ].filter(Boolean),
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
