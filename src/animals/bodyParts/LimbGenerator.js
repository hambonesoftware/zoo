// src/animals/bodyParts/LimbGenerator.js

import * as THREE from 'three';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';

function buildLimbSegment(start, end, radiusStart, radiusEnd, segments = 8, rings = 5, boneStart = 0, boneEnd = 0, uvOffset = 0, uvSpan = 1) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length === 0) return geometry;
  direction.normalize();

  // Build a local coordinate frame for the limb segment.
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(direction.dot(up)) > 0.99) {
    up.set(1, 0, 0); // Avoid degeneracy when aligned to Y
  }
  const side = new THREE.Vector3().crossVectors(direction, up).normalize();
  const binormal = new THREE.Vector3().crossVectors(direction, side).normalize();

  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const center = new THREE.Vector3().lerpVectors(start, end, t);
    const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
    const angleStep = (2 * Math.PI) / segments;

    for (let j = 0; j < segments; j++) {
      const angle = j * angleStep;
      const offset = side
        .clone()
        .multiplyScalar(Math.cos(angle) * radius)
        .add(binormal.clone().multiplyScalar(Math.sin(angle) * radius));

      const v = center.clone().add(offset);
      vertices.push(v.x, v.y, v.z);
      uvs.push(j / segments, uvOffset + t * uvSpan);

      const weightEnd = t;
      const weightStart = 1 - weightEnd;
      skinIndices.push(boneStart, boneEnd, 0, 0);
      skinWeights.push(weightStart, weightEnd, 0, 0);
    }
  }

  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + next;
      const c = (i + 1) * segments + next;
      const d = (i + 1) * segments + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Extrude a segmented limb along the named bones. Radii may optionally contain
 * one more entry than the number of bones so that each joint can taper.
 */
export function generateLimbGeometry(skeleton, options = {}) {
  const bones = options.bones || [];
  const radii = options.radii || [];
  const segments = options.sides || 8;
  const rings = options.rings || 5;

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => {
    boneIndexMap[bone.name] = idx;
    bone.updateMatrixWorld(true);
  });

  const positions = bones.map((name) => {
    const bone = skeleton.bones.find((b) => b.name === name);
    return bone
      ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
      : new THREE.Vector3();
  });

  const limbSegments = [];
  const segmentSpan = 1 / Math.max(1, positions.length - 1);
  for (let i = 0; i < positions.length - 1; i++) {
    const start = positions[i];
    const end = positions[i + 1];
    const rStart = radii[i] ?? radii[radii.length - 1] ?? 0.3;
    const rEnd = radii[i + 1] ?? rStart;
    const boneStart = boneIndexMap[bones[i]] ?? 0;
    const boneEnd = boneIndexMap[bones[i + 1]] ?? boneStart;
    limbSegments.push(
      buildLimbSegment(
        start,
        end,
        rStart,
        rEnd,
        segments,
        rings,
        boneStart,
        boneEnd,
        i * segmentSpan,
        segmentSpan
      )
    );
  }

  return mergeGeometries(limbSegments, false);
}
