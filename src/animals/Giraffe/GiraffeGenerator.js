// src/animals/Giraffe/GiraffeGenerator.js

import * as THREE from 'three';
// Torso + neck as one continuous body
import { generateSpineTorsoGeometry } from '../bodyParts/SpineTorsoGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import {
  projectLegRootRingVertices,
  sampleTorsoRingSurface
} from '../bodyParts/BranchBlendUtils.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { createGiraffeSkinMaterial } from './GiraffeSkinNode.js';

export class GiraffeGenerator {
  static generate(skeleton, options = {}) {
    // Make sure bone world matrices are fresh
    skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

    const findBoneIndex = (name) =>
      skeleton.bones.findIndex((b) => b.name === name);

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
        geo.setAttribute(
          'skinIndex',
          new THREE.Uint16BufferAttribute(skinIndices, 4)
        );
        geo.setAttribute(
          'skinWeight',
          new THREE.Float32BufferAttribute(skinWeights, 4)
        );
      }

      return geo;
    };

    const samplePosition = (boneName) => {
      const bone = skeleton.bones.find((b) => b.name === boneName);
      return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld) : null;
    };

    // Variant noise
    const seed = typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => Math.abs(Math.sin(s * 43758.5453)) % 1;
    const variantFactor = random01(seed);

    const neckScale =
      (1 + (variantFactor - 0.5) * 0.25) * (options.neckRadiusScale || 1); // ±12.5%
    const headScale = 1 + (0.5 - variantFactor) * 0.1; // ±5%
    const legScale =
      (1 + (variantFactor - 0.5) * 0.15) * (options.legRadiusScale || 1); // ±7.5%
    const torsoScale =
      (1 + (variantFactor - 0.5) * 0.08) * (options.torsoRadiusScale || 1); // ±4%

    const neckBones =
      Array.isArray(options.neckBones) && options.neckBones.length > 0
        ? options.neckBones
        : ['neck_0', 'neck_1', 'neck_2', 'neck_3', 'neck_4', 'neck_5', 'neck_6'];

    const neckTipName = neckBones[neckBones.length - 1] || 'neck_6';
    const neckBlendBone =
      options.neckBone ||
      (neckBones.length > 1 ? neckBones[neckBones.length - 2] : neckTipName);

    const lowPoly = options.lowPoly === true;
    const enableBranchBlending = options.enableBranchBlending !== false;
    const branchBlendOffset =
      typeof options.branchBlendOffset === 'number' ? options.branchBlendOffset : 0.02;
    const branchBlendSpan =
      typeof options.branchBlendSpan === 'number' ? options.branchBlendSpan : 0.22;
    const lowPolySides = options.sides || (lowPoly ? 10 : 18);
    const ringsPerSegment = Math.max(1, options.ringsPerSegment || 2);
    const neckRingsPerSegment = Math.max(
      3,
      options.neckRingsPerSegment || ringsPerSegment
    );

    // === 1. Continuous Spine + Neck body ===
    // One tube from spine_base → spine_mid → spine_upper → neck_0..neck_6
    const { geometry: spineNeckGeometryRaw, ringData: spineNeckRingData } =
      generateSpineTorsoGeometry(skeleton, {
        spineBones: ['spine_base', 'spine_mid', 'spine_upper'],
        neckBones,
        spineRadii: [0.62 * torsoScale, 0.7 * torsoScale, 0.55 * torsoScale],
        neckRadii: [
          0.44 * neckScale,
          0.4 * neckScale,
          0.36 * neckScale,
          0.32 * neckScale,
          0.28 * neckScale,
          0.24 * neckScale,
          0.2 * neckScale
        ],
        sides: lowPolySides,
        // Use neckRingsPerSegment so the whole spine+neck has nice resolution
        ringsPerSegment: neckRingsPerSegment,
        extendRumpToRearLegs: true,
        // Close off the rear; leave the neck tip open so the head can attach
        capStart: true,
        capEnd: false,
        includeRingData: true
      });

    const spineNeckGeometry = ensureSkinnedGeometry(spineNeckGeometryRaw, 'spine_base');

    // === 2. Head ===
    const neckTip = samplePosition(neckTipName);
    const headPos = samplePosition('head');

    const headDir =
      headPos && neckTip
        ? headPos.clone().sub(neckTip)
        : new THREE.Vector3(0, 0, 1);
    if (headDir.lengthSq() < 1e-6) headDir.set(0, 0, 1);

    const headMid =
      neckTip && headPos ? neckTip.clone().lerp(headPos, 0.6) : new THREE.Vector3();
    const headLength =
      headPos && neckTip ? neckTip.distanceTo(headPos) + 0.2 : 0.6;

    const headDirNorm = headDir.clone().normalize();
    const headQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      headDirNorm
    );

    const muzzleLength = headLength * 0.55;
    const muzzleRadius = 0.12 * headScale;

    const muzzle = new THREE.CapsuleGeometry(
      muzzleRadius,
      muzzleLength,
      lowPoly ? 4 : 6,
      lowPoly ? 6 : 12
    );
    muzzle.scale(0.9, 0.8, 1.0);
    muzzle.applyQuaternion(headQuat);

    const muzzleBase =
      neckTip && headPos
        ? neckTip.clone().lerp(headPos, 0.35)
        : headMid.clone();

    muzzle.translate(
      muzzleBase.x + headDirNorm.x * (muzzleLength * 0.35),
      muzzleBase.y + headDirNorm.y * (muzzleLength * 0.35),
      muzzleBase.z + headDirNorm.z * (muzzleLength * 0.35)
    );

    const domeRadius = 0.24 * headScale;
    const dome = new THREE.SphereGeometry(
      domeRadius,
      lowPoly ? 8 : 14,
      lowPoly ? 6 : 10,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.72
    );
    dome.scale(1.0, 0.92, 1.05);
    dome.applyQuaternion(headQuat);

    const domeOffset = muzzleBase
      .clone()
      .add(headDirNorm.clone().multiplyScalar(muzzleLength * 0.85));
    dome.translate(domeOffset.x, domeOffset.y, domeOffset.z);

    const headGeometry = ensureSkinnedGeometry(
      mergeGeometries([muzzle, dome], false),
      'head'
    );

    // === 3. Horns ===
    const makeCurvedHorn = (boneName, radius, length, lateralCurve) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();
      const base = bonePos.clone();
      const tip = bonePos.clone().add(new THREE.Vector3(0, length * 0.9, 0));
      const control = bonePos
        .clone()
        .add(new THREE.Vector3(lateralCurve, length * 0.6, length * 0.08));

      const curve = new THREE.CatmullRomCurve3([base, control, tip]);
      const tube = new THREE.TubeGeometry(
        curve,
        lowPoly ? 8 : 14,
        radius,
        lowPoly ? 6 : 10,
        false
      );

      const capTop = new THREE.SphereGeometry(
        radius * 0.95,
        lowPoly ? 6 : 10,
        lowPoly ? 4 : 8
      );
      capTop.translate(tip.x, tip.y, tip.z);

      const capBase = new THREE.SphereGeometry(
        radius,
        lowPoly ? 6 : 10,
        lowPoly ? 4 : 8
      );
      capBase.translate(base.x, base.y, base.z);

      const hornGeometry = mergeGeometries([tube, capTop, capBase], false);
      return ensureSkinnedGeometry(hornGeometry, boneName);
    };

    const hornLeft = makeCurvedHorn('horn_left', 0.05, 0.24, -0.05);
    const hornRight = makeCurvedHorn('horn_right', 0.05, 0.24, 0.05);

    // === 4. Ears ===
    const makeEar = (boneName, flip = 1) => {
      const bonePos = samplePosition(boneName) || new THREE.Vector3();

      const earShape = new THREE.Shape();
      earShape.moveTo(0, 0);
      earShape.lineTo(0.18, 0.04);
      earShape.lineTo(0.12, 0.16);
      earShape.lineTo(-0.02, 0.12);
      earShape.closePath();

      const earGeo = new THREE.ExtrudeGeometry(earShape, {
        depth: 0.045,
        bevelEnabled: false
      });

      earGeo.translate(-0.08, -0.08, -0.0225);
      earGeo.scale(1, 1, 1 + (flip < 0 ? 0.05 : 0));
      earGeo.rotateZ(THREE.MathUtils.degToRad(10 * flip));
      earGeo.rotateX(THREE.MathUtils.degToRad(-8));
      earGeo.translate(bonePos.x, bonePos.y + 0.02, bonePos.z - 0.04);

      return ensureSkinnedGeometry(earGeo, boneName);
    };

    const earLeft = makeEar('ear_left', -1);
    const earRight = makeEar('ear_right', 1);

    // === 5. Neck / Head Blend (optional) ===
    // Default: OFF. Set options.enableNeckBlend = true to turn it back on.
    let neckBlendGeometry = null;
    const useNeckBlend = options.enableNeckBlend === true;

    if (useNeckBlend && neckTip && headPos) {
      const blendLength = Math.max(0.08, headLength * 0.15);
      const radiusBottom = 0.18 * neckScale;
      const radiusTop = muzzleRadius * 0.9;

      const blendCylinder = new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        blendLength,
        lowPoly ? 8 : 12,
        1,
        true // open-ended
      );

      const blendQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        headDirNorm
      );
      blendCylinder.applyQuaternion(blendQuat);

      const seamEps = 0.01;
      const blendStart = neckTip
        .clone()
        .add(headDirNorm.clone().multiplyScalar(seamEps));
      const blendOffset = headDirNorm.clone().multiplyScalar(blendLength * 0.5);

      blendCylinder.translate(
        blendStart.x + blendOffset.x,
        blendStart.y + blendOffset.y,
        blendStart.z + blendOffset.z
      );

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
    const limbSides = enableBranchBlending ? lowPolySides : lowPoly ? 8 : 12;
    const limbOptions = {
      sides: limbSides,
      rings: Math.max(3, ringsPerSegment + 2),
      ringBias: 0.2
    };

    const frontRadii = [
      0.26 * legScale,
      0.22 * legScale,
      0.18 * legScale,
      0.16 * legScale
    ];
    const backRadii = [
      0.28 * legScale,
      0.23 * legScale,
      0.19 * legScale,
      0.16 * legScale
    ];

    const fl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: [
          'front_left_shoulder',
          'front_left_upper',
          'front_left_lower',
          'front_left_foot'
        ],
        radii: frontRadii,
        ...limbOptions
      }),
      'front_left_shoulder'
    );

    const fr = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: [
          'front_right_shoulder',
          'front_right_upper',
          'front_right_lower',
          'front_right_foot'
        ],
        radii: frontRadii,
        ...limbOptions
      }),
      'front_right_shoulder'
    );

    const bl = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: [
          'back_left_hip',
          'back_left_upper',
          'back_left_lower',
          'back_left_foot'
        ],
        radii: backRadii,
        ...limbOptions
      }),
      'back_left_hip'
    );

    const br = ensureSkinnedGeometry(
      generateLimbGeometry(skeleton, {
        bones: [
          'back_right_hip',
          'back_right_upper',
          'back_right_lower',
          'back_right_foot'
        ],
        radii: backRadii,
        ...limbOptions
      }),
      'back_right_hip'
    );

    const blendGeometry = [];
    if (enableBranchBlending && spineNeckRingData && spineNeckRingData.rings > 1) {
      const torsoSegments = spineNeckRingData.segments;

      const getLegRootIndices = () =>
        Array.from({ length: torsoSegments }, (_, i) => i);

      const getRingCenterFromGeometry = (geometry, indices) => {
        const positionAttr = geometry.getAttribute('position');
        const center = new THREE.Vector3();
        if (!positionAttr || indices.length === 0) return center;
        indices.forEach((index) => {
          center.add(new THREE.Vector3().fromBufferAttribute(positionAttr, index));
        });
        return center.multiplyScalar(1 / indices.length);
      };

      const findClosestRingIndex = (target) => {
        const ringCenters = spineNeckRingData.ringCenters;
        if (!ringCenters || ringCenters.length === 0) return 0;
        const axisStart = ringCenters[0];
        const axisEnd = ringCenters[ringCenters.length - 1];
        const axisDir = axisEnd.clone().sub(axisStart);
        if (axisDir.lengthSq() < 1e-6) {
          return 0;
        }
        axisDir.normalize();
        const targetAxis = target.clone().sub(axisStart).dot(axisDir);

        let bestIndex = 0;
        let bestDist = Infinity;
        ringCenters.forEach((center, index) => {
          const centerAxis = center.clone().sub(axisStart).dot(axisDir);
          const dist = Math.abs(centerAxis - targetAxis);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = index;
          }
        });
        return bestIndex;
      };

      const clampRingIndex = (index) =>
        THREE.MathUtils.clamp(index, 0, spineNeckRingData.rings - 2);

      const collectRingSegments = (centerSegment, span) => {
        const segments = [];
        const halfSpan = Math.max(1, Math.floor(span / 2));
        for (let offset = -halfSpan; offset <= halfSpan; offset += 1) {
          segments.push((centerSegment + offset + torsoSegments) % torsoSegments);
        }
        return segments;
      };

      const removeTorsoFaces = (ringIndex, segmentIndices) => {
        const bandIndex = clampRingIndex(ringIndex);
        const ringStart = spineNeckRingData.ringStarts[bandIndex];
        const nextRingStart = spineNeckRingData.ringStarts[bandIndex + 1];
        if (ringStart === undefined || nextRingStart === undefined) return;

        const removeSet = new Set();
        segmentIndices.forEach((segment) => {
          const next = (segment + 1) % torsoSegments;
          const a = ringStart + segment;
          const b = ringStart + next;
          const c = nextRingStart + next;
          const d = nextRingStart + segment;
          const key1 = [a, b, d].sort((x, y) => x - y).join(',');
          const key2 = [b, c, d].sort((x, y) => x - y).join(',');
          removeSet.add(key1);
          removeSet.add(key2);
        });

        const indexAttr = spineNeckGeometry.getIndex();
        if (!indexAttr) return;
        const oldIndices = Array.from(indexAttr.array);
        const newIndices = [];
        for (let i = 0; i < oldIndices.length; i += 3) {
          const tri = [oldIndices[i], oldIndices[i + 1], oldIndices[i + 2]];
          const key = tri.slice().sort((x, y) => x - y).join(',');
          if (!removeSet.has(key)) {
            newIndices.push(...tri);
          }
        }
        spineNeckGeometry.setIndex(newIndices);
      };

      const buildBridgeGeometry = (
        legGeometry,
        legRootIndices,
        ringIndex,
        segmentIndices,
        legSegmentOffset
      ) => {
        const bandIndex = clampRingIndex(ringIndex);
        const ringStart = spineNeckRingData.ringStarts[bandIndex];
        const nextRingStart = spineNeckRingData.ringStarts[bandIndex + 1];
        if (ringStart === undefined || nextRingStart === undefined) return null;

        const torsoPosition = spineNeckGeometry.getAttribute('position');
        const torsoUv = spineNeckGeometry.getAttribute('uv');
        const torsoSkinIndex = spineNeckGeometry.getAttribute('skinIndex');
        const torsoSkinWeight = spineNeckGeometry.getAttribute('skinWeight');

        const legPosition = legGeometry.getAttribute('position');
        const legUv = legGeometry.getAttribute('uv');
        const legSkinIndex = legGeometry.getAttribute('skinIndex');
        const legSkinWeight = legGeometry.getAttribute('skinWeight');

        const positions = [];
        const uvs = [];
        const skinIndices = [];
        const skinWeights = [];

        const pushVertex = (attrSet, index) => {
          positions.push(
            attrSet.position.getX(index),
            attrSet.position.getY(index),
            attrSet.position.getZ(index)
          );
          if (attrSet.uv) {
            uvs.push(attrSet.uv.getX(index), attrSet.uv.getY(index));
          } else {
            uvs.push(0, 0);
          }
          if (attrSet.skinIndex && attrSet.skinWeight) {
            skinIndices.push(
              attrSet.skinIndex.getX(index),
              attrSet.skinIndex.getY(index),
              attrSet.skinIndex.getZ(index),
              attrSet.skinIndex.getW(index)
            );
            skinWeights.push(
              attrSet.skinWeight.getX(index),
              attrSet.skinWeight.getY(index),
              attrSet.skinWeight.getZ(index),
              attrSet.skinWeight.getW(index)
            );
          } else {
            skinIndices.push(0, 0, 0, 0);
            skinWeights.push(1, 0, 0, 0);
          }
        };

        const addQuad = (a, b, c, d) => {
          pushVertex(a.source, a.index);
          pushVertex(b.source, b.index);
          pushVertex(d.source, d.index);
          pushVertex(b.source, b.index);
          pushVertex(c.source, c.index);
          pushVertex(d.source, d.index);
        };

        segmentIndices.forEach((segment) => {
          const next = (segment + 1) % torsoSegments;
          const legSegment = (segment + legSegmentOffset + torsoSegments) % torsoSegments;
          const legNext = (legSegment + 1) % torsoSegments;

          const torsoCurrent = ringStart + segment;
          const torsoNext = ringStart + next;
          const torsoUpperCurrent = nextRingStart + segment;
          const torsoUpperNext = nextRingStart + next;

          const legCurrent = legRootIndices[legSegment];
          const legNextIndex = legRootIndices[legNext];

          addQuad(
            { source: { position: torsoPosition, uv: torsoUv, skinIndex: torsoSkinIndex, skinWeight: torsoSkinWeight }, index: torsoCurrent },
            { source: { position: torsoPosition, uv: torsoUv, skinIndex: torsoSkinIndex, skinWeight: torsoSkinWeight }, index: torsoNext },
            { source: { position: legPosition, uv: legUv, skinIndex: legSkinIndex, skinWeight: legSkinWeight }, index: legNextIndex },
            { source: { position: legPosition, uv: legUv, skinIndex: legSkinIndex, skinWeight: legSkinWeight }, index: legCurrent }
          );

          addQuad(
            { source: { position: legPosition, uv: legUv, skinIndex: legSkinIndex, skinWeight: legSkinWeight }, index: legCurrent },
            { source: { position: legPosition, uv: legUv, skinIndex: legSkinIndex, skinWeight: legSkinWeight }, index: legNextIndex },
            { source: { position: torsoPosition, uv: torsoUv, skinIndex: torsoSkinIndex, skinWeight: torsoSkinWeight }, index: torsoUpperNext },
            { source: { position: torsoPosition, uv: torsoUv, skinIndex: torsoSkinIndex, skinWeight: torsoSkinWeight }, index: torsoUpperCurrent }
          );
        });

        const bridgeGeometry = new THREE.BufferGeometry();
        bridgeGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(positions, 3)
        );
        bridgeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        bridgeGeometry.setAttribute(
          'skinIndex',
          new THREE.Uint16BufferAttribute(skinIndices, 4)
        );
        bridgeGeometry.setAttribute(
          'skinWeight',
          new THREE.Float32BufferAttribute(skinWeights, 4)
        );
        bridgeGeometry.computeVertexNormals();
        return bridgeGeometry;
      };

      const blendLeg = (legGeometry, legBones, targetBoneName, blendSpanScale = 1) => {
        if (limbSides !== torsoSegments) {
          return;
        }

        const legRootIndices = getLegRootIndices();
        let legRootCenter = getRingCenterFromGeometry(legGeometry, legRootIndices);
        const targetPosition = samplePosition(targetBoneName) || legRootCenter;
        const ringIndex = findClosestRingIndex(targetPosition);

        const torsoRing = sampleTorsoRingSurface(
          spineNeckGeometry,
          spineNeckRingData,
          ringIndex
        );
        const legDirection = (() => {
          const root = samplePosition(legBones[0]);
          const next = samplePosition(legBones[1]);
          if (root && next) {
            return next.clone().sub(root);
          }
          return legRootCenter.clone().sub(torsoRing.center);
        })();

        projectLegRootRingVertices(
          legGeometry,
          legRootIndices,
          torsoRing,
          legDirection,
          branchBlendOffset
        );

        legRootCenter = getRingCenterFromGeometry(legGeometry, legRootIndices);
        const toLeg = legRootCenter.clone().sub(torsoRing.center);
        const toLegPlane = toLeg
          .clone()
          .sub(torsoRing.tangent.clone().multiplyScalar(toLeg.dot(torsoRing.tangent)));
        const planeDir =
          toLegPlane.lengthSq() > 1e-6 ? toLegPlane.normalize() : torsoRing.normal.clone();

        const angle = Math.atan2(
          planeDir.dot(torsoRing.binormal),
          planeDir.dot(torsoRing.normal)
        );
        const normalizedAngle = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
        const centerSegment = Math.round(normalizedAngle * torsoSegments) % torsoSegments;

        const blendSpan = THREE.MathUtils.clamp(
          branchBlendSpan * blendSpanScale,
          0.05,
          1
        );
        const span = Math.min(
          torsoSegments,
          Math.max(3, Math.round(torsoSegments * blendSpan))
        );
        const segmentIndices = collectRingSegments(centerSegment, span);

        let legCenterSegment = 0;
        let bestDot = -Infinity;
        for (let i = 0; i < legRootIndices.length; i += 1) {
          const index = legRootIndices[i];
          const position = new THREE.Vector3().fromBufferAttribute(
            legGeometry.getAttribute('position'),
            index
          );
          const legDir = position.clone().sub(legRootCenter);
          if (legDir.lengthSq() > 1e-6) {
            const dot = legDir.normalize().dot(planeDir);
            if (dot > bestDot) {
              bestDot = dot;
              legCenterSegment = i;
            }
          }
        }

        const legSegmentOffset =
          (legCenterSegment - centerSegment + torsoSegments) % torsoSegments;

        removeTorsoFaces(ringIndex, segmentIndices);

        const bridge = buildBridgeGeometry(
          legGeometry,
          legRootIndices,
          ringIndex,
          segmentIndices,
          legSegmentOffset
        );
        if (bridge) {
          blendGeometry.push(bridge);
        }
      };

      blendLeg(fl, ['front_left_shoulder', 'front_left_upper'], 'spine_mid', 1);
      blendLeg(fr, ['front_right_shoulder', 'front_right_upper'], 'spine_mid', 1);
      blendLeg(bl, ['back_left_hip', 'back_left_upper'], 'back_left_hip', 0.75);
      blendLeg(br, ['back_right_hip', 'back_right_upper'], 'back_right_hip', 0.75);

      spineNeckGeometry.computeVertexNormals();
      fl.computeVertexNormals();
      fr.computeVertexNormals();
      bl.computeVertexNormals();
      br.computeVertexNormals();
    }

    // === Merge ===
    const prepareForMerge = (geometry) => {
      let geo = geometry;

      const count = geo.getAttribute('position').count;
      const ensureAttribute = (name, factory) => {
        if (!geo.getAttribute(name)) {
          geo.setAttribute(name, factory(count));
        }
      };

      ensureAttribute('normal', () => {
        geo.computeVertexNormals();
        return geo.getAttribute('normal');
      });

      ensureAttribute('uv', (vertexCount) =>
        new THREE.Float32BufferAttribute(
          new Float32Array(vertexCount * 2),
          2
        )
      );

      ensureAttribute('skinIndex', (vertexCount) =>
        new THREE.Uint16BufferAttribute(
          new Uint16Array(vertexCount * 4),
          4
        )
      );

      ensureAttribute('skinWeight', (vertexCount) => {
        const weights = new Float32Array(vertexCount * 4);
        for (let i = 0; i < vertexCount; i += 1) {
          weights[i * 4] = 1;
        }
        return new THREE.Float32BufferAttribute(weights, 4);
      });

      geo = geo.index ? geo.toNonIndexed() : geo;
      geo.morphAttributes = geo.morphAttributes || {};

      return geo;
    };

    const mergedGeometry = mergeGeometries(
      [
        spineNeckGeometry,
        headGeometry,
        neckBlendGeometry, // null unless enableNeckBlend === true
        hornLeft,
        hornRight,
        earLeft,
        earRight,
        tailGeometry,
        fl,
        fr,
        bl,
        br,
        ...blendGeometry
      ]
        .filter(Boolean)
        .map(prepareForMerge),
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
