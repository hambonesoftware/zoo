// src/animals/bodyParts/TorsoGenerator.js

import * as THREE from 'three';

/**
 * Wrap rings around the supplied spine bones to form a simple torso volume.
 * This mirrors the signature expected by the animal generators: it accepts a
 * skeleton plus a set of bone names and optional radii/sides overrides.
 */
export function generateTorsoGeometry(skeleton, options = {}) {
  const bones = options.bones || [];
  const radii = options.radii || [];
  const sides = typeof options.sides === 'number' ? options.sides : 24;
  const radiusProfile = typeof options.radiusProfile === 'function'
    ? options.radiusProfile
    : null;

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
    return { x: pos.x, y: pos.y, z: pos.z, boneIndex: boneIndexMap[name] ?? 0 };
  });

  return buildTorsoFromSpine(spine, radii, sides, radiusProfile);
}

function buildTorsoFromSpine(spineBones, radii = [], segments = 8, radiusProfile = null) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];

  const rings = spineBones.length;
  const shoulderRadius = radii[1] ?? radii[0] ?? 1.5;
  const hipRadius = radii[0] ?? shoulderRadius;
  const midRadius = radii[2] ?? (hipRadius + shoulderRadius) / 2;
  const normal = new THREE.Vector3(1, 0, 0);
  const binormal = new THREE.Vector3(0, 1, 0);

  for (let ringIndex = 0; ringIndex < rings; ringIndex++) {
    const bone = spineBones[ringIndex];
    const center = new THREE.Vector3(bone.x, bone.y, bone.z);
    const sNormalized = rings > 1 ? ringIndex / (rings - 1) : 0;

    let baseRadius = typeof radii[ringIndex] === 'number' ? radii[ringIndex] : null;
    if (baseRadius === null) {
      if (ringIndex < 2) {
        baseRadius = hipRadius;
      } else if (ringIndex > rings - 3) {
        baseRadius = shoulderRadius;
      } else {
        baseRadius = midRadius;
      }
    }

    const angleStep = (2 * Math.PI) / segments;

    for (let sideIndex = 0; sideIndex < segments; sideIndex++) {
      const theta = (sideIndex / segments) * Math.PI * 2.0;

      let radius = baseRadius;
      if (radiusProfile !== null) {
        radius = radiusProfile(sNormalized, theta, baseRadius);
      }

      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const offset = normal.clone().multiplyScalar(cosTheta * radius)
        .add(binormal.clone().multiplyScalar(sinTheta * radius));

      const vertexPosition = center.clone().add(offset);

      vertices.push(vertexPosition.x, vertexPosition.y, vertexPosition.z);
      uvs.push(sideIndex / segments, sNormalized);

      // Weight each ring to its corresponding spine bone. Blend slightly
      // toward the next bone so the torso deforms smoothly along the column.
      const boneIndexA = spineBones[ringIndex].boneIndex ?? 0;
      const boneIndexB = spineBones[Math.min(ringIndex + 1, rings - 1)].boneIndex ?? boneIndexA;
      const blend = rings > 1 ? ringIndex / (rings - 1) : 0;
      skinIndices.push(boneIndexA, boneIndexB, 0, 0);
      skinWeights.push(1 - blend, blend, 0, 0);
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
