// src/animals/Elephant/ElephantGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
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

    const legSidesLowPoly =
      typeof options.lowPolyLegSides === 'number' &&
      options.lowPolyLegSides >= 3
        ? options.lowPolyLegSides
        : 9;

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
    const headScale = 1.0 + (0.5 - variantFactor) * 0.15; // ±7.5%
    const headRadius = 0.95 * headScale;
    const torsoRadiusProfile = makeElephantTorsoRadiusProfile(headScale);

    // Helper to get a bone by name.
    const getBoneByName = (name) =>
      skeleton.bones.find((b) => b.name === name) || null;

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

    const torsoGeometry = generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck'],
      // [hips, ribcage, neck base]
      radii: [1.15 * headScale, 1.35, 1.0 * headScale],
      sides: 28,
      radiusProfile: torsoRadiusProfile,
      rumpBulgeDepth: 0.4,
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
      lowPolySegments: lowPoly ? lowPolyTorsoSegments : undefined,
      lowPolyWeldTolerance: lowPoly ? lowPolyTorsoWeldTolerance : 0
    });

    // === 2. NECK (Front torso ring -> head base) ===
    // Separate neck segment from spine_neck to head.
    const neckRadiusAtHead = 0.4 * (0.95 * headScale); // 40% of head diameter for slimmer profile
    const neckGeometry = generateNeckGeometry(skeleton, {
      // Use actual bones that exist in the rig: spine_neck -> head
      bones: ['spine_neck', 'head'],
      headBone: 'head',
      neckTipBone: 'head',
      radii: [neckRadiusAtHead * 1.1, neckRadiusAtHead * 0.95],
      sides: lowPoly ? Math.max(neckSidesLowPoly, 8) : 18,
      capBase: true
    });

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

    // === 3. HEAD ===
    const headGeometry = generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: headRadius, // Big dome scaled by variant
      sides: lowPoly ? headSidesLowPoly : 22
    });

    // === 4. TRUNK (Prehensile) ===
    const trunkRootBoneName = getBoneByName('trunk_anchor')
      ? 'trunk_anchor'
      : getBoneByName('trunk_root')
        ? 'trunk_root'
        : 'head';
    const trunkGeometry = generateTailGeometry(skeleton, {
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
    const leftTusk = generateTailGeometry(skeleton, {
      bones: ['tusk_left', 'tusk_left_tip'],
      sides: lowPoly ? tuskSidesLowPoly : 16,
      baseRadius: 0.12,
      tipRadius: 0.02,
      lengthScale: tuskScale
    });

    const rightTusk = generateTailGeometry(skeleton, {
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
      bones: ['tail_base', 'tail_mid', 'tail_tip'],
      sides: lowPoly ? tailSidesLowPoly : 14,
      baseRadius: 0.15,
      tipRadius: 0.05
    });

    // === 8. LEGS (Pillars) ===
    const legConfig = {
      sides: lowPoly ? legSidesLowPoly : 20
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
      radii: [
        0.5 * legScale,
        0.45 * legScale,
        0.4 * legScale,
        0.38 * legScale,
        0.43 * legScale
      ],
      ...legConfig
    });

    const fr = generateLimbGeometry(skeleton, {
      bones: [
        'front_right_collarbone',
        'front_right_upper',
        'front_right_lower',
        'front_right_foot'
      ],
      radii: [
        0.5 * legScale,
        0.45 * legScale,
        0.4 * legScale,
        0.38 * legScale,
        0.43 * legScale
      ],
      ...legConfig
    });

    const bl = generateLimbGeometry(skeleton, {
      bones: [
        'back_left_pelvis',
        'back_left_upper',
        'back_left_lower',
        'back_left_foot'
      ],
      radii: [
        0.55 * legScale,
        0.5 * legScale,
        0.42 * legScale,
        0.38 * legScale,
        0.44 * legScale
      ],
      ...legConfig
    });

    const br = generateLimbGeometry(skeleton, {
      bones: [
        'back_right_pelvis',
        'back_right_upper',
        'back_right_lower',
        'back_right_foot'
      ],
      radii: [
        0.55 * legScale,
        0.5 * legScale,
        0.42 * legScale,
        0.38 * legScale,
        0.44 * legScale
      ],
      ...legConfig
    });

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
        neckGeometry,
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

    const behavior = new ElephantBehavior(skeleton, mesh);

    return { mesh, behavior };
  }
}
