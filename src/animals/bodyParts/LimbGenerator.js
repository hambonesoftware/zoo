// src/animals/bodyParts/LimbGenerator.js

import * as THREE from 'three';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';

function buildLimbSegment(start, end, radiusStart, radiusEnd, segments = 8, rings = 5) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

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

  const positions = bones.map((name) => {
    const bone = skeleton.bones.find((b) => b.name === name);
    return bone
      ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
      : new THREE.Vector3();
  });

  const limbSegments = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const start = positions[i];
    const end = positions[i + 1];
    const rStart = radii[i] ?? radii[radii.length - 1] ?? 0.3;
    const rEnd = radii[i + 1] ?? rStart;
    limbSegments.push(buildLimbSegment(start, end, rStart, rEnd, segments, rings));
  }

  return mergeGeometries(limbSegments, false);
}
