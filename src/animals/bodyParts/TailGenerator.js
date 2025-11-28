// src/animals/bodyParts/TailGenerator.js

import * as THREE from 'three';
import { bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

/**
 * generateTailGeometry
 *
 * Builds a tube (tail / trunk) along a chain of bones. Compared to the
 * original version, this implementation avoids abrupt 90° twists in the
 * ring orientation by using a simple parallel–transport frame instead
 * of rebuilding each ring's basis from a fixed global "up" vector.
 */
export function generateTailGeometry(skeleton, options = {}) {
  const tailBoneNames = options.bones || ['tail_base', 'tail_mid', 'tail_tip'];
  const rootBoneName = options.rootBone || 'spine_base';
  const sides = typeof options.sides === 'number' ? options.sides : 6;
  const baseRadius = options.baseRadius || 0.08;
  const midRadius  = options.midRadius  || 0.07;
  const tipRadius  = options.tipRadius  || 0.05;
  const yOffset = options.yOffset || 0;

  // ------------------------------------------------------------
  // 1) Collect bone indices and world-space positions
  // ------------------------------------------------------------
  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => {
    boneIndexMap[bone.name] = idx;
  });
  skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

  const allTailBoneNames = [rootBoneName, ...tailBoneNames];
  const tailPoints = allTailBoneNames.map((name) => {
    const idx = boneIndexMap[name];
    if (idx === undefined) {
      throw new Error(`Missing bone: ${name}`);
    }
    return new THREE.Vector3().setFromMatrixPosition(
      skeleton.bones[idx].matrixWorld
    );
  });

  // ------------------------------------------------------------
  // 2) Radii profile along the chain
  // ------------------------------------------------------------
  let radii;
  if (options.radii && Array.isArray(options.radii)) {
    radii = options.radii;
  } else if (allTailBoneNames.length === 4) {
    // Typical tail: [spine_base, base, mid, tip]
    radii = [baseRadius, baseRadius, midRadius, tipRadius];
  } else {
    // Generic: smoothly lerp from base → tip.
    radii = [];
    for (let i = 0; i < tailPoints.length; i += 1) {
      const t = tailPoints.length > 1 ? i / (tailPoints.length - 1) : 0;
      radii.push(THREE.MathUtils.lerp(baseRadius, tipRadius, t));
    }
  }

  // ------------------------------------------------------------
  // 3) Build a smooth frame (tangent, normal, binormal) per point
  //    using a parallel–transport style update to avoid sudden twists.
  // ------------------------------------------------------------
  const tangents = [];
  const normalsFrame = [];
  const binormalsFrame = [];

  // Tangent per point
  for (let i = 0; i < tailPoints.length; i += 1) {
    const center = tailPoints[i];
    let axis;
    if (i === tailPoints.length - 1) {
      axis = center.clone().sub(tailPoints[i - 1]);
    } else {
      axis = tailPoints[i + 1].clone().sub(center);
    }
    axis.normalize();
    tangents.push(axis);
  }

  // Frame per point
  for (let i = 0; i < tailPoints.length; i += 1) {
    const t = tangents[i];

    if (i === 0) {
      // Initial normal: choose something not parallel to t
      const arbitrary =
        Math.abs(t.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      const n = new THREE.Vector3().crossVectors(t, arbitrary).normalize();
      const b = new THREE.Vector3().crossVectors(t, n).normalize();

      normalsFrame.push(n);
      binormalsFrame.push(b);
    } else {
      const nPrev = normalsFrame[i - 1];

      // Parallel transport: project previous normal onto plane orthogonal to t
      let n = nPrev
        .clone()
        .sub(t.clone().multiplyScalar(nPrev.dot(t)));

      // Fallback in the unlikely event of near-zero length
      if (n.lengthSq() < 1e-6) {
        const arbitrary =
          Math.abs(t.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        n = new THREE.Vector3().crossVectors(t, arbitrary);
      }

      n.normalize();
      const b = new THREE.Vector3().crossVectors(t, n).normalize();

      normalsFrame.push(n);
      binormalsFrame.push(b);
    }
  }

  // ------------------------------------------------------------
  // 4) Build rings using the smooth frame
  // ------------------------------------------------------------
  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];

  const segmentCount = tailPoints.length;
  const uvVDenom = segmentCount > 1 ? segmentCount - 1 : 1;

  for (let i = 0; i < segmentCount; i += 1) {
    const center = tailPoints[i];
    const radius = radii[i];
    const n = normalsFrame[i];
    const b = binormalsFrame[i];

    const ringStartIndex = positions.length / 3;
    ringStarts.push(ringStartIndex);

    const mainBone = boneIndexMap[allTailBoneNames[i]];

    for (let j = 0; j < sides; j += 1) {
      const theta = (j / sides) * Math.PI * 2.0;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const offset = n
        .clone()
        .multiplyScalar(cosTheta * radius)
        .add(b.clone().multiplyScalar(sinTheta * radius));

      const v = center.clone().add(offset);

      positions.push(v.x, v.y + yOffset, v.z);

      const norm = offset.clone().normalize();
      normals.push(norm.x, norm.y, norm.z);

      uvs.push(j / sides, i / uvVDenom);

      // Simple 1-bone skinning for now; tail/trunk deformation comes
      // from the bone transforms rather than blend weights.
      skinIndices.push(mainBone, mainBone, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
  }

  // ------------------------------------------------------------
  // 5) Bridge rings into quads/triangles
  // ------------------------------------------------------------
  for (let seg = 0; seg < segmentCount - 1; seg += 1) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  // ------------------------------------------------------------
  // 6) Build BufferGeometry
  // ------------------------------------------------------------
  let geometry = buildBufferGeometry({
    positions,
    normals,
    skinIndices,
    skinWeights,
    uvs,
    indices
  });

  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  return geometry;
}

