// src/animals/Elephant/ElephantGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateNoseGeometry } from '../bodyParts/NoseGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import {
  projectLegRootRingVertices,
  sampleTorsoRingSurface
} from '../bodyParts/BranchBlendUtils.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { ElephantBehavior } from './ElephantBehavior.js';

import { createElephantSkinMaterial } from './ElephantSkinNode.js';
import { makeElephantTorsoRadiusProfile } from './ElephantTorsoProfile.js';

export class ElephantGenerator {
  static generate(skeleton, options = {}) {
    // Make sure all bone world matrices are current before sampling.
    skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

    // ------------------------------------------------------------
    // Global style flags
    // ------------------------------------------------------------
    const lowPoly = options.lowPoly === true;
    const debugVolumes = options.debugVolumes !== false;
    const enableBranchBlending = options.enableBranchBlending === true;
    const branchBlendOffset =
      typeof options.branchBlendOffset === 'number' ? options.branchBlendOffset : 0.02;
    const branchBlendSpan =
      typeof options.branchBlendSpan === 'number' ? options.branchBlendSpan : 0.22;

    // Optional torso-specific low-poly controls
    const lowPolyTorsoSegments =
      typeof options.lowPolyTorsoSegments === 'number' &&
      options.lowPolyTorsoSegments >= 3
        ? options.lowPolyTorsoSegments
        : 9; // default radial segments around torso when low-poly

    const lowPolyTorsoWeldTolerance =
      typeof options.lowPolyTorsoWeldTolerance === 'number' &&
      options.lowPolyTorsoWeldTolerance > 0
        ? options.lowPolyTorsoWeldTolerance
        : 0.02; // default weld tolerance for torso facets

    // Per-part low-poly side counts (fallbacks if user doesn't override)
    const headSidesLowPoly =
      typeof options.lowPolyHeadSides === 'number' &&
      options.lowPolyHeadSides >= 3
        ? options.lowPolyHeadSides
        : 12;

    const trunkSidesLowPoly =
      typeof options.lowPolyTrunkSides === 'number' &&
      options.lowPolyTrunkSides >= 3
        ? options.lowPolyTrunkSides
        : 10;

    const neckSidesLowPoly =
      typeof options.lowPolyNeckSides === 'number' &&
      options.lowPolyNeckSides >= 3
        ? options.lowPolyNeckSides
        : 12;

    const tuskSidesLowPoly =
      typeof options.lowPolyTuskSides === 'number' &&
      options.lowPolyTuskSides >= 3
        ? options.lowPolyTuskSides
        : 8;

    const earSidesLowPoly =
      typeof options.lowPolyEarSides === 'number' &&
      options.lowPolyEarSides >= 3
        ? options.lowPolyEarSides
        : 10;

    const tailSidesLowPoly =
      typeof options.lowPolyTailSides === 'number' &&
      options.lowPolyTailSides >= 3
        ? options.lowPolyTailSides
        : 8;
    const torsoOptions = options.torso || {};
    const torsoRadiusScale =
      typeof torsoOptions.radiusScale === 'number' ? torsoOptions.radiusScale : 1;
    const torsoBulge =
      typeof torsoOptions.bulge === 'number' ? torsoOptions.bulge : 0.4;
    const torsoRingsPerSegment = Math.max(0, Math.floor(torsoOptions.ringsPerSegment ?? 0));
    const torsoSidesOverride =
      typeof torsoOptions.sides === 'number' ? Math.max(3, Math.floor(torsoOptions.sides)) : null;
    const torsoLowPolySegmentsOverride =
      typeof torsoOptions.sides === 'number' ? Math.max(3, Math.floor(torsoOptions.sides)) : null;

    const legSidesLowPoly =
      typeof options.lowPolyLegSides === 'number' &&
      options.lowPolyLegSides >= 3
        ? options.lowPolyLegSides
        : 9;
    const limbMeshOptions = options.limbMesh || {};
    const limbRings = Math.max(
      3,
      Math.round(
        typeof limbMeshOptions.ringsPerSegment === 'number'
          ? limbMeshOptions.ringsPerSegment
          : 5
      )
    );
    const limbRingBias =
      typeof limbMeshOptions.ringBias === 'number' ? limbMeshOptions.ringBias : 0;
    const limbRingStartT =
      typeof limbMeshOptions.startT === 'number'
        ? THREE.MathUtils.clamp(limbMeshOptions.startT, 0, 1)
        : 0;
    const limbRingEndT = Math.max(
      limbRingStartT,
      typeof limbMeshOptions.endT === 'number'
        ? THREE.MathUtils.clamp(limbMeshOptions.endT, 0, 1)
        : 1
    );
    const limbRingTStops =
      Array.isArray(limbMeshOptions.tStops) && limbMeshOptions.tStops.length > 0
        ? limbMeshOptions.tStops.map((t) => THREE.MathUtils.clamp(t, 0, 1))
        : null;
    const limbRingDistribution =
      typeof limbMeshOptions.distributionFn === 'function'
        ? limbMeshOptions.distributionFn
        : null;
    const limbSidesOverride =
      typeof limbMeshOptions.sides === 'number' && limbMeshOptions.sides >= 3
        ? limbMeshOptions.sides
        : null;
    const limbOverrides = limbMeshOptions.limbs || {};

    // ------------------------------------------------------------
    // Variant processing
    //
    // A subtle size/age variant can be supplied via options.variantSeed.
    // This seed controls small variations in the proportions of the animal
    // such as leg length, tusk length/curvature and head size.  The
    // function below produces a reproducible pseudo-random number in
    // [0,1] from an integer seed.  If no seed is provided the value is
    // 0.5, corresponding to the baseline proportions.  These factors
    // gently modulate the radii and lengths defined below.
    const seed =
      typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => {
      // simple deterministic PRNG based on sine; yields 0..1
      return Math.abs(Math.sin(s * 43758.5453)) % 1;
    };
    const variantFactor = random01(seed);
    // Map variantFactor into ranges for each feature.  These ranges are
    // chosen so that the resulting elephants remain recognisably the same
    // stylised species while still exhibiting subtle differences.
    const legScale = 1.0 + (variantFactor - 0.5) * 0.2; // ±10%
    const tuskScale = 1.0 + (variantFactor - 0.5) * 0.3; // ±15%
    const headScaleMultiplier =
      typeof options.headScale === 'number' && options.headScale > 0
        ? options.headScale
        : 1;
    const headScale = (1.0 + (0.5 - variantFactor) * 0.15) * headScaleMultiplier; // ±7.5%
    const headRadius = 0.95 * headScale;
    const neckBones = Array.isArray(options.neckBones) && options.neckBones.length > 0
      ? options.neckBones
      : ['spine_mid', 'spine_neck', 'head'];
    const torsoRadiusProfile = makeElephantTorsoRadiusProfile(headScale);

    // Helper to get a bone by name.
    const getBoneByName = (name) =>
      skeleton.bones.find((b) => b.name === name) || null;

    const formatVector = (vec) =>
      `(${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)})`;

    const sampleBonePosition = (name) => {
      const bone = getBoneByName(name);
      if (!bone) {
        return null;
      }
      return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    };

    // Helper to build a pivot-based transform matrix for ears.
    // We:
    //   1) translate geometry so the ear root is at the origin,
    //   2) rotate about X to flop the ear down,
    //   3) flatten along Z so the ear becomes a thin slice,
    //   4) translate back to the original root position.
    const makeEarTransformMatrix = (earRootName) => {
	  const earRootBone = getBoneByName(earRootName);
	  if (!earRootBone) {
		return new THREE.Matrix4(); // identity
	  }

	  const pivot = new THREE.Vector3().setFromMatrixPosition(
		earRootBone.matrixWorld
	  );

	  const toOrigin = new THREE.Matrix4().makeTranslation(
		-pivot.x,
		-pivot.y,
		-pivot.z
	  );
	  const fromOrigin = new THREE.Matrix4().makeTranslation(
		pivot.x,
		pivot.y,
		pivot.z
	  );

	  // Use Z rotation for the ear fan, but mirror the angle for left vs right.
	  const baseAngle = Math.PI / 4; // 45°
	  const isLeft = earRootName.toLowerCase().includes('left');
	  const tiltAngle = isLeft ? baseAngle : -baseAngle;

	  const rotate = new THREE.Matrix4().makeRotationZ(tiltAngle);
	  const flatten = new THREE.Matrix4().makeScale(1.5, 1.0, 0.18);

	  // Combined transform: T_back * R * S * T_toOrigin
	  const m = new THREE.Matrix4();
	  m.copy(fromOrigin);
	  m.multiply(rotate);
	  m.multiply(flatten);
	  m.multiply(toOrigin);

	  return m;
	};


    // === 1. TORSO (The Tank) ===
    // Radii indices map to: [Hips, Ribcage, NeckBase]
    const rearLegRadii = {
      back_left_upper: 0.5 * legScale,
      back_right_upper: 0.5 * legScale,
      back_left_lower: 0.42 * legScale,
      back_right_lower: 0.42 * legScale,
      back_left_foot: 0.44 * legScale,
      back_right_foot: 0.44 * legScale
    };

    const torsoSides = torsoSidesOverride ?? 28;
    const torsoLowPolySegments = torsoLowPolySegmentsOverride ?? lowPolyTorsoSegments;

    const torsoResult = generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck'],
      // [hips, ribcage, neck base]
      radii: [1.15 * headScale * torsoRadiusScale, 1.35 * torsoRadiusScale, 1.0 * headScale * torsoRadiusScale],
      sides: torsoSides,
      radiusProfile: torsoRadiusProfile,
      rumpBulgeDepth: torsoBulge,
      ringsPerSegment: torsoRingsPerSegment,
      extendRumpToRearLegs: {
        bones: [
          'back_left_foot',
          'back_right_foot',
          'back_left_lower',
          'back_right_lower',
          'back_left_upper',
          'back_right_upper'
        ],
        extraMargin: 0.05,
        boneRadii: rearLegRadii
      },
      lowPoly,
      lowPolySegments: lowPoly ? torsoLowPolySegments : undefined,
      lowPolyWeldTolerance: lowPoly ? lowPolyTorsoWeldTolerance : 0,
      includeRingData: enableBranchBlending
    });
    const torsoGeometry = enableBranchBlending ? torsoResult.geometry : torsoResult;
    const torsoRingData = enableBranchBlending ? torsoResult.ringData : null;

    // === 2. NECK (Front torso ring -> head base) ===
    // Separate neck segment from spine_neck to head.
    const neckRadiusAtHead = 0.4 * (0.95 * headScale); // 40% of head diameter for slimmer profile
   

    // === Trunk/Tusk spatial relationship ===
    const tuskLeft = getBoneByName('tusk_left');
    const tuskRight = getBoneByName('tusk_right');

    // Default to the rigged separation if tusk bones are missing
    let tuskSeparation = 0.6;
    if (tuskLeft && tuskRight) {
      const leftPos = new THREE.Vector3().setFromMatrixPosition(
        tuskLeft.matrixWorld
      );
      const rightPos = new THREE.Vector3().setFromMatrixPosition(
        tuskRight.matrixWorld
      );
      tuskSeparation = leftPos.distanceTo(rightPos);
    }

    // Limit trunk diameter to 80% of tusk separation
    const maxTrunkRadius = (tuskSeparation * 0.8) * 0.5;
    const maxTrunkRadiusByHead = headRadius * 0.6; // prevent intersection with head dome

    const defaultTrunkBaseRadius = 0.46;
    const defaultTrunkMidRadius =
      typeof options.trunkMidRadius === 'number'
        ? options.trunkMidRadius
        : 0.07;
    const defaultTrunkTipRadius = 0.26;

    const trunkBaseRadius = Math.min(
      defaultTrunkBaseRadius,
      maxTrunkRadius,
      maxTrunkRadiusByHead
    );
    const trunkMidRadius = Math.min(
      defaultTrunkMidRadius,
      maxTrunkRadius,
      maxTrunkRadiusByHead
    );
    const trunkTipRadius = Math.min(
      defaultTrunkTipRadius,
      maxTrunkRadius,
      maxTrunkRadiusByHead
    );

    const trunkRootBoneName = getBoneByName('trunk_anchor')
      ? 'trunk_anchor'
      : getBoneByName('trunk_root')
        ? 'trunk_root'
        : 'trunk_root';

    // === 3. HEAD ===
    const headGeometry = generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: headRadius, // Big dome scaled by variant
      sides: lowPoly ? headSidesLowPoly : 22,
      bones: neckBones,
      neckBone: options.neckBone
    });

    // === 4. TRUNK (Prehensile) ===
    const trunkGeometry = generateNoseGeometry(skeleton, {
      bones: ['trunk_base', 'trunk_mid1', 'trunk_mid2', 'trunk_tip'],
      rootBone: trunkRootBoneName,
      // A touch more sides in low-poly mode so faces aren’t crazy skinny
      sides: lowPoly ? Math.max(trunkSidesLowPoly, 12) : 24,
      // Slightly thicker and less extreme taper
      baseRadius: trunkBaseRadius,
      midRadius: trunkMidRadius,
      tipRadius: trunkTipRadius
    });

    // === 5. TUSKS (Start -> Tip) ===
    // === 5. TUSKS (Start -> Tip) ===
	const leftTusk = generateNoseGeometry(skeleton, {
	  rootBone: 'head_tip_3',                 // NEW: left tusk root
	  bones: ['tusk_left', 'tusk_left_tip'],
	  sides: lowPoly ? tuskSidesLowPoly : 16,
	  baseRadius: 0.12,
	  tipRadius: 0.02,
	  lengthScale: tuskScale
	});

	const rightTusk = generateNoseGeometry(skeleton, {
	  rootBone: 'head_tip_4',                 // NEW: right tusk root
	  bones: ['tusk_right', 'tusk_right_tip'],
	  sides: lowPoly ? tuskSidesLowPoly : 16,
	  baseRadius: 0.12,
	  tipRadius: 0.02,
	  lengthScale: tuskScale
	});


    // === 6. EARS ===
    // We create a thin, sagging flap by using a limb generator, then
    // reshape it into a flattened, cone-slice fan around the ear root.
    const leftEar = generateLimbGeometry(skeleton, {
      bones: ['ear_left', 'ear_left_tip'],
      radii: [0.65, 0.35],
      sides: lowPoly ? earSidesLowPoly : 20
    });

    const rightEar = generateLimbGeometry(skeleton, {
      bones: ['ear_right', 'ear_right_tip'],
      radii: [0.65, 0.35],
      sides: lowPoly ? earSidesLowPoly : 20
    });

    // Apply ear transforms: rotate about X and flatten, using the
    // corresponding ear root bone as the pivot so they stay attached.
    const leftEarMatrix = makeEarTransformMatrix('ear_left');
    const rightEarMatrix = makeEarTransformMatrix('ear_right');

    leftEar.applyMatrix4(leftEarMatrix);
    rightEar.applyMatrix4(rightEarMatrix);

    leftEar.computeVertexNormals();
    rightEar.computeVertexNormals();

	// === 7. TAIL ===
	const tailGeometry = generateTailGeometry(skeleton, {
	  rootBone: 'spine_tail',                 // NEW: tail is anchored at the rump cap center
	  bones: ['tail_base', 'tail_mid', 'tail_tip'],
	  sides: lowPoly ? tailSidesLowPoly : 14,
	  baseRadius: 0.15,
	  tipRadius: 0.05
	});


    // === 8. LEGS (Pillars) ===
    const limbSides =
      limbSidesOverride ??
      (enableBranchBlending ? torsoSides : lowPoly ? legSidesLowPoly : 20);
    const legConfig = {
      sides: limbSides,
      rings: limbRings,
      ringBias: limbRingBias,
      startT: limbRingStartT,
      endT: limbRingEndT,
      tStops: limbRingTStops,
      distributionFn: limbRingDistribution
    };

    const buildLimbRadii = (limbKey, defaults) => {
      const override = limbOverrides[limbKey] || {};
      const upper = override.upperRadius ?? defaults.upperRadius;
      const knee = override.kneeRadius ?? defaults.kneeRadius;
      const ankle = override.ankleRadius ?? defaults.ankleRadius;
      const foot = override.footRadius ?? defaults.footRadius;
      const flare = override.footFlare ?? defaults.footFlare ?? foot;
      return [upper, knee, ankle, foot, flare].map((v) => v * legScale);
    };

    // To emphasise the toe/hoof band near the bottom of each leg we
    // introduce an additional radius entry just above the foot.  The
    // bottom radius flares slightly outward, and the preceding radius
    // tapers inward to create a subtle ring.  Leg length is modulated
    // by the legScale variant.
    const fl = generateLimbGeometry(skeleton, {
      bones: [
        'front_left_collarbone',
        'front_left_upper',
        'front_left_lower',
        'front_left_foot'
      ],
      radii: buildLimbRadii('frontLeft', {
        upperRadius: 0.5,
        kneeRadius: 0.45,
        ankleRadius: 0.4,
        footRadius: 0.38,
        footFlare: 0.43
      }),
      ...legConfig
    });

    const fr = generateLimbGeometry(skeleton, {
      bones: [
        'front_right_collarbone',
        'front_right_upper',
        'front_right_lower',
        'front_right_foot'
      ],
      radii: buildLimbRadii('frontRight', {
        upperRadius: 0.5,
        kneeRadius: 0.45,
        ankleRadius: 0.4,
        footRadius: 0.38,
        footFlare: 0.43
      }),
      ...legConfig
    });

    const bl = generateLimbGeometry(skeleton, {
      bones: [
        'back_left_pelvis',
        'back_left_upper',
        'back_left_lower',
        'back_left_foot'
      ],
      radii: buildLimbRadii('backLeft', {
        upperRadius: 0.55,
        kneeRadius: 0.5,
        ankleRadius: 0.42,
        footRadius: 0.38,
        footFlare: 0.44
      }),
      ...legConfig
    });

    const br = generateLimbGeometry(skeleton, {
      bones: [
        'back_right_pelvis',
        'back_right_upper',
        'back_right_lower',
        'back_right_foot'
      ],
      radii: buildLimbRadii('backRight', {
        upperRadius: 0.55,
        kneeRadius: 0.5,
        ankleRadius: 0.42,
        footRadius: 0.38,
        footFlare: 0.44
      }),
      ...legConfig
    });

    const blendGeometry = [];
    if (enableBranchBlending && torsoRingData && torsoRingData.rings > 1) {
      const torsoSegments = torsoRingData.segments;

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

      const ringCenters = torsoRingData.ringCenters;
      const ringAxisDistances = (() => {
        const distances = [0];
        for (let i = 1; i < ringCenters.length; i += 1) {
          distances[i] =
            distances[i - 1] + ringCenters[i].distanceTo(ringCenters[i - 1]);
        }
        return distances;
      })();

      const findClosestRingIndex = (target) => {
        let bestAxisDistance = 0;
        let bestDistanceSq = Infinity;

        for (let i = 0; i < ringCenters.length - 1; i += 1) {
          const start = ringCenters[i];
          const end = ringCenters[i + 1];
          const segment = end.clone().sub(start);
          const segmentLengthSq = segment.lengthSq();
          if (segmentLengthSq < 1e-8) {
            continue;
          }
          const toTarget = target.clone().sub(start);
          const t = THREE.MathUtils.clamp(
            toTarget.dot(segment) / segmentLengthSq,
            0,
            1
          );
          const projection = start.clone().add(segment.multiplyScalar(t));
          const distanceSq = projection.distanceToSquared(target);
          if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            bestAxisDistance =
              ringAxisDistances[i] +
              Math.sqrt(segmentLengthSq) * t;
          }
        }

        let bestIndex = 0;
        let bestAxisDelta = Infinity;
        ringAxisDistances.forEach((axisDistance, index) => {
          const delta = Math.abs(axisDistance - bestAxisDistance);
          if (delta < bestAxisDelta) {
            bestAxisDelta = delta;
            bestIndex = index;
          }
        });

        return bestIndex;
      };

      const clampRingIndex = (index) =>
        THREE.MathUtils.clamp(index, 0, torsoRingData.rings - 2);

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
        const ringStart = torsoRingData.ringStarts[bandIndex];
        const nextRingStart = torsoRingData.ringStarts[bandIndex + 1];
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

        const indexAttr = torsoGeometry.getIndex();
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
        torsoGeometry.setIndex(newIndices);
      };

      const buildBridgeGeometry = (
        legGeometry,
        legRootIndices,
        ringIndex,
        segmentIndices,
        legSegmentOffset
      ) => {
        const bandIndex = clampRingIndex(ringIndex);
        const ringStart = torsoRingData.ringStarts[bandIndex];
        const nextRingStart = torsoRingData.ringStarts[bandIndex + 1];
        if (ringStart === undefined || nextRingStart === undefined) return null;

        const torsoPosition = torsoGeometry.getAttribute('position');
        const torsoUv = torsoGeometry.getAttribute('uv');
        const torsoSkinIndex = torsoGeometry.getAttribute('skinIndex');
        const torsoSkinWeight = torsoGeometry.getAttribute('skinWeight');

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

      const blendLeg = (legGeometry, legBones, targetBoneName, blendSpanOverride) => {
        if (limbSides !== torsoSegments) {
          return;
        }

        const legRootIndices = getLegRootIndices();
        let legRootCenter = getRingCenterFromGeometry(legGeometry, legRootIndices);
        const targetPosition = sampleBonePosition(targetBoneName) || legRootCenter;
        const ringIndex = findClosestRingIndex(targetPosition);

        const torsoRing = sampleTorsoRingSurface(torsoGeometry, torsoRingData, ringIndex);
        const legDirection = (() => {
          const root = sampleBonePosition(legBones[0]);
          const next = sampleBonePosition(legBones[1]);
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
          blendSpanOverride ?? branchBlendSpan,
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

      const rearBlendSpan = Math.min(branchBlendSpan, 0.16);

      blendLeg(fl, ['front_left_collarbone', 'front_left_upper'], 'spine_mid');
      blendLeg(fr, ['front_right_collarbone', 'front_right_upper'], 'spine_mid');
      blendLeg(
        bl,
        ['back_left_pelvis', 'back_left_upper'],
        'back_left_pelvis',
        rearBlendSpan
      );
      blendLeg(
        br,
        ['back_right_pelvis', 'back_right_upper'],
        'back_right_pelvis',
        rearBlendSpan
      );

      torsoGeometry.computeVertexNormals();
      fl.computeVertexNormals();
      fr.computeVertexNormals();
      bl.computeVertexNormals();
      br.computeVertexNormals();
    }

    // === Merge ===
    // BufferGeometryUtils requires that all geometries share the same
    // attributes and index state. The procedural body parts above were
    // authored independently, so we normalise them here by ensuring each
    // has position/normal/uv/skinIndex/skinWeight attributes and by
    // converting everything to non-indexed form.
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
          weights[i * 4] = 1; // full weight to the first influence
        }
        return new THREE.Float32BufferAttribute(weights, 4);
      });

      geo = geo.index ? geo.toNonIndexed() : geo;
      geo.morphAttributes = geo.morphAttributes || {};

      return geo;
    };

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
        br,
        ...blendGeometry
      ].map(prepareForMerge),
      false
    );

    // === Material (Node-based elephant skin) ===
    const material = createElephantSkinMaterial({
      bodyColor: options.bodyColor,
      lowPoly
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new ElephantBehavior(skeleton, mesh, options);

    return { mesh, behavior };
  }
}
