// src/animals/bodyParts/TorsoGenerator.js

import * as THREE from 'three';
import * as BufferGeometryUtils from '../../libs/BufferGeometryUtils.js';

/**
 * Wrap rings around the supplied spine bones to form a simple torso volume.
 * This mirrors the signature expected by the animal generators: it accepts a
 * skeleton plus a set of bone names and optional radii/sides overrides.
 *
 * New options supported:
 *   - lowPoly: boolean
 *       When true, uses fewer radial segments and can optionally weld vertices
 *       for a more faceted, low-poly look.
 *   - lowPolySegments: number
 *       Optional explicit segment count when lowPoly is true.
 *   - lowPolyWeldTolerance: number
 *       If > 0 and lowPoly is true, mergeVertices(geometry, tolerance) is
 *       applied after building the torso, and normals are recomputed.
 *   - capStart: boolean
 *       When true, add a triangle-fan cap at the first ring (rump).
 *   - capEnd: boolean
 *       When true, add a triangle-fan cap at the last ring (neck/front).
 *   - extendRumpToRearLegs: boolean | { bones?: string[], extraMargin?: number }
 *       When enabled, inserts an extra rump ring behind the hips so the torso
 *       extends to cover (and slightly beyond) the rear-most leg position.
 *       Accepts an optional list of leg bone names to measure and an optional
 *       extra margin to extend beyond the farthest measured leg.
  */
export function generateTorsoGeometry(skeleton, options = {}) {
  const bones = options.bones || [];
  const radii = options.radii || [];

  const lowPoly = options.lowPoly === true;
  const lowPolySegments =
    typeof options.lowPolySegments === 'number' && options.lowPolySegments >= 3
      ? options.lowPolySegments
      : 9; // default radial segments for low-poly mode

  const baseSides =
    typeof options.sides === 'number' && options.sides >= 3
      ? options.sides
      : 24;

  const sides = lowPoly ? lowPolySegments : baseSides;

  const lowPolyWeldTolerance =
    typeof options.lowPolyWeldTolerance === 'number' && options.lowPolyWeldTolerance > 0
      ? options.lowPolyWeldTolerance
      : 0;

  const radiusProfile =
    typeof options.radiusProfile === 'function' ? options.radiusProfile : null;

  const capStart = options.capStart !== false;
  const capEnd = options.capEnd === true;
  const rumpBulgeDepth =
    typeof options.rumpBulgeDepth === 'number' ? options.rumpBulgeDepth : null;
  const extendRumpToRearLegs = options.extendRumpToRearLegs || false;

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => {
    boneIndexMap[bone.name] = idx;
    bone.updateMatrixWorld(true);
  });

  const spine = bones.map((name) => {
    const bone = skeleton.bones.find((b) => b.name === name);
    const pos = bone
      ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
      : new THREE.Vector3();
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      boneIndex: boneIndexMap[name] ?? 0
    };
  });

  const hipRadius = (() => {
    const shoulderRadius = radii[1] ?? radii[0] ?? 1.5;
    return radii[0] ?? shoulderRadius;
  })();

  const shouldExtend =
    extendRumpToRearLegs === true ||
    (extendRumpToRearLegs && typeof extendRumpToRearLegs === 'object');

  const spineForBuild = spine.slice();
  const radiiForBuild = radii.slice();

  const rumpCenter = spine[0]
    ? new THREE.Vector3(spine[0].x, spine[0].y, spine[0].z)
    : null;

  let bodyForward = new THREE.Vector3(0, 0, 1);
  if (spine.length > 1) {
    bodyForward.set(
      spine[1].x - spine[0].x,
      spine[1].y - spine[0].y,
      spine[1].z - spine[0].z
    );
    if (bodyForward.lengthSq() > 1e-6) {
      bodyForward.normalize();
    } else {
      bodyForward.set(0, 0, 1);
    }
  }
  const bodyBack = bodyForward.clone().negate();

  if (shouldExtend && rumpCenter) {
    const defaultRearLegBones = [
      'back_left_foot',
      'back_right_foot',
      'back_left_lower',
      'back_right_lower',
      'back_left_upper',
      'back_right_upper'
    ];

    const rearLegBones = Array.isArray(extendRumpToRearLegs?.bones)
      ? extendRumpToRearLegs.bones
      : defaultRearLegBones;

    let maxRearOffset = null;

    rearLegBones.forEach((name) => {
      const legBone = skeleton.bones.find((b) => b.name === name);
      if (!legBone) return;
      const legPos = new THREE.Vector3().setFromMatrixPosition(
        legBone.matrixWorld
      );
      const offset = legPos.clone().sub(rumpCenter).dot(bodyBack);
      if (offset > 0) {
        maxRearOffset = maxRearOffset === null ? offset : Math.max(maxRearOffset, offset);
      }
    });

    const minBackExtent = 0.1;
    let backExtent = Math.max(minBackExtent, maxRearOffset || 0);

    const extraMargin =
      typeof extendRumpToRearLegs === 'object' &&
      typeof extendRumpToRearLegs.extraMargin === 'number'
        ? extendRumpToRearLegs.extraMargin
        : 0.0;

    backExtent += extraMargin;

    if (backExtent > 0) {
      const extraRumpCenter = rumpCenter.clone().add(
        bodyBack.clone().multiplyScalar(backExtent)
      );

      const rumpBoneIndex = spine[0].boneIndex ?? 0;
      const extraSpineEntry = {
        x: extraRumpCenter.x,
        y: extraRumpCenter.y,
        z: extraRumpCenter.z,
        boneIndex: rumpBoneIndex
      };

      spineForBuild.unshift(extraSpineEntry);

      if (radiiForBuild.length > 0) {
        radiiForBuild.unshift(radiiForBuild[0]);
      }
    }
  }

  const geometry = buildTorsoFromSpine(
    spineForBuild,
    radiiForBuild,
    sides,
    radiusProfile,
    capStart,
    capEnd,
    rumpBulgeDepth
  );

  if (lowPoly && lowPolyWeldTolerance > 0) {
    // For low-poly mode, optionally weld nearby vertices to create larger
    // facets and recompute normals for flat shading.
    geometry.deleteAttribute('normal');
    const welded = BufferGeometryUtils.mergeVertices(
      geometry,
      lowPolyWeldTolerance
    );
    welded.computeVertexNormals();
    return welded;
  }

  return geometry;
}

function buildTorsoFromSpine(
  spineBones,
  radii = [],
  segments = 8,
  radiusProfile = null,
  capStart = true,
  capEnd = false,
  rumpBulgeDepth = null
) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];

  const rings = spineBones.length;
  if (rings === 0) {
    return geometry;
  }

  // ---------------------------------------------------------------------------
  // 1) Precompute points and a smooth frame (tangent / normal / binormal)
  //    along the spine so all rings are "in line" and don't suddenly twist.
  // ---------------------------------------------------------------------------
  const points = spineBones.map(
    (b) => new THREE.Vector3(b.x, b.y, b.z)
  );

  const tangents = [];
  for (let i = 0; i < rings; i += 1) {
    let t;
    if (rings === 1) {
      t = new THREE.Vector3(0, 0, 1);
    } else if (i === rings - 1) {
      t = points[i].clone().sub(points[i - 1]);
    } else {
      t = points[i + 1].clone().sub(points[i]);
    }
    if (t.lengthSq() === 0) {
      t.set(0, 0, 1);
    }
    t.normalize();
    tangents.push(t);
  }

  const frameNormals = [];
  const frameBinormals = [];

  for (let i = 0; i < rings; i += 1) {
    const t = tangents[i];

    if (i === 0) {
      // Initial normal: choose something not parallel to tangent.
      const arbitrary =
        Math.abs(t.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      const n = new THREE.Vector3().crossVectors(t, arbitrary).normalize();
      const b = new THREE.Vector3().crossVectors(t, n).normalize();

      frameNormals.push(n);
      frameBinormals.push(b);
    } else {
      const nPrev = frameNormals[i - 1];

      // Parallel-transport: project previous normal onto plane orthogonal to t
      let n = nPrev
        .clone()
        .sub(t.clone().multiplyScalar(nPrev.dot(t)));

      if (n.lengthSq() < 1e-6) {
        const arbitrary =
          Math.abs(t.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        n = new THREE.Vector3().crossVectors(t, arbitrary);
      }

      n.normalize();
      const b = new THREE.Vector3().crossVectors(t, n).normalize();

      frameNormals.push(n);
      frameBinormals.push(b);
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Radius defaults for hips / shoulders / mid-section
  // ---------------------------------------------------------------------------
  const shoulderRadius = radii[1] ?? radii[0] ?? 1.5;
  const hipRadius = radii[0] ?? shoulderRadius;
  const midRadius = radii[2] ?? (hipRadius + shoulderRadius) / 2;

  const ringStarts = [];
  const uvVDenom = rings > 1 ? rings - 1 : 1;

  // ---------------------------------------------------------------------------
  // 3) Build rings along the spine
  // ---------------------------------------------------------------------------
  for (let ringIndex = 0; ringIndex < rings; ringIndex += 1) {
    const bone = spineBones[ringIndex];
    const center = points[ringIndex];
    const sNormalized = rings > 1 ? ringIndex / (rings - 1) : 0;

    let baseRadius = typeof radii[ringIndex] === 'number'
      ? radii[ringIndex]
      : null;

    if (baseRadius === null) {
      if (ringIndex < 2) {
        baseRadius = hipRadius;
      } else if (ringIndex > rings - 3) {
        baseRadius = shoulderRadius;
      } else {
        baseRadius = midRadius;
      }
    }

    const n = frameNormals[ringIndex];
    const b = frameBinormals[ringIndex];

    const ringStart = vertices.length / 3;
    ringStarts.push(ringStart);

    for (let sideIndex = 0; sideIndex < segments; sideIndex += 1) {
      const theta = (sideIndex / segments) * Math.PI * 2.0;

      let radius = baseRadius;
      if (radiusProfile !== null) {
        radius = radiusProfile(sNormalized, theta, baseRadius);
      }

      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const offset = n
        .clone()
        .multiplyScalar(cosTheta * radius)
        .add(b.clone().multiplyScalar(sinTheta * radius));

      const vertexPosition = center.clone().add(offset);

      vertices.push(vertexPosition.x, vertexPosition.y, vertexPosition.z);
      uvs.push(sideIndex / segments, sNormalized);

      // Weight each ring to its corresponding spine bone. Blend slightly
      // toward the next bone so the torso deforms smoothly along the column.
      const boneIndexA = bone.boneIndex ?? 0;
      const nextBoneIndex =
        spineBones[Math.min(ringIndex + 1, rings - 1)].boneIndex ?? boneIndexA;
      const blend = rings > 1 ? ringIndex / (rings - 1) : 0;

      skinIndices.push(boneIndexA, nextBoneIndex, 0, 0);
      skinWeights.push(1 - blend, blend, 0, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Connect rings with quads (two triangles per quad)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const next = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + next;
      const c = (i + 1) * segments + next;
      const d = (i + 1) * segments + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Optional end caps (rump + neck) with normals aligned to spine
  // ---------------------------------------------------------------------------
  let startCapIndex = -1;
  let endCapIndex = -1;

  if (capStart && rings > 1) {
    const firstRingStart = ringStarts[0];
    const rumpRingIndex = 0;
    const rumpCenter = points[rumpRingIndex];

    let capCenter = rumpCenter.clone();

    if (typeof rumpBulgeDepth === 'number') {
      const forward = points[Math.min(rings - 1, rumpRingIndex + 1)]
        .clone()
        .sub(rumpCenter);

      if (forward.lengthSq() < 1e-6) {
        forward.set(0, 0, 1);
      } else {
        forward.normalize();
      }

      const bodyBack = forward.clone().negate();
      capCenter = rumpCenter.clone().add(
        bodyBack.multiplyScalar(rumpBulgeDepth)
      );
    }

    startCapIndex = vertices.length / 3;

    vertices.push(capCenter.x, capCenter.y, capCenter.z);
    uvs.push(0.5, 0.0); // simple center UV
    const rumpBoneIndex = spineBones[rumpRingIndex].boneIndex ?? 0;
    skinIndices.push(rumpBoneIndex, rumpBoneIndex, 0, 0);
    skinWeights.push(1, 0, 0, 0);

    for (let j = 0; j < segments; j += 1) {
      const a = startCapIndex;
      const b = firstRingStart + ((j + 1) % segments);
      const c = firstRingStart + j;
      indices.push(a, b, c);
    }
  }

  if (capEnd && rings > 1) {
    const lastRingStart = ringStarts[ringStarts.length - 1];
    const center = points[points.length - 1];
    endCapIndex = vertices.length / 3;

    vertices.push(center.x, center.y, center.z);
    uvs.push(0.5, 1.0); // simple center UV
    const neckBoneIndex = spineBones[spineBones.length - 1].boneIndex ?? 0;
    skinIndices.push(neckBoneIndex, neckBoneIndex, 0, 0);
    skinWeights.push(1, 0, 0, 0);

    for (let j = 0; j < segments; j += 1) {
      const a = endCapIndex;
      const b = lastRingStart + ((j + 1) % segments);
      const c = lastRingStart + j;
      indices.push(a, b, c);
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Build geometry & compute normals
  // ---------------------------------------------------------------------------
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  // normals will be computed, so initialise with zeros
  const normals = new Float32Array((vertices.length / 3) * 3);
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(skinIndices, 4)
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(skinWeights, 4)
  );
  geometry.setIndex(indices);

  geometry.computeVertexNormals();

  // Force the cap centers to have normals aligned with the spine tangents.
  const normalAttr = geometry.getAttribute('normal');
  if (startCapIndex >= 0) {
    const n0 = tangents[0].clone().negate().normalize();
    normalAttr.setXYZ(startCapIndex, n0.x, n0.y, n0.z);
  }
  if (endCapIndex >= 0) {
    const n1 = tangents[tangents.length - 1].clone().normalize();
    normalAttr.setXYZ(endCapIndex, n1.x, n1.y, n1.z);
  }
  if (startCapIndex >= 0 || endCapIndex >= 0) {
    normalAttr.needsUpdate = true;
  }

  return geometry;
}
