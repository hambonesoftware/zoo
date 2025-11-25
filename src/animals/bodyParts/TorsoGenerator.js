// src/animals/bodyParts/TorsoGenerator.js

import * as THREE from 'three';

/**
 * Wrap rings around the supplied spine bones to form a simple torso volume.
 * This mirrors the signature expected by the animal generators: it accepts a
 * skeleton plus a set of bone names and optional radii/sides overrides.
 */
export function generateTorsoGeometry(skeleton, options = {}) {
  const bones = options.bones || [];
  const sides = options.sides || 8;
  const radii = options.radii || [];

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

  // Use the provided radii if available; otherwise fall back to simple defaults.
  const shoulderRadius = radii[1] ?? radii[0] ?? 1.5;
  const hipRadius = radii[0] ?? shoulderRadius;

  return buildTorsoFromSpine(spine, shoulderRadius, hipRadius, sides);
}

function buildTorsoFromSpine(spineBones, shoulderRadius = 1.5, hipRadius = 1.5, segments = 8) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];

  const rings = spineBones.length;
  for (let i = 0; i < rings; i++) {
    const bone = spineBones[i];
    const pos = new THREE.Vector3(bone.x, bone.y, bone.z);
    const radius = i < 2 ? hipRadius : (i > rings - 3 ? shoulderRadius : (hipRadius + shoulderRadius) / 2);
    const angleStep = (2 * Math.PI) / segments;

    for (let j = 0; j < segments; j++) {
      const angle = j * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      vertices.push(pos.x + x, pos.y + y, pos.z);
      uvs.push(j / segments, i / Math.max(1, rings - 1));

      // Weight each ring to its corresponding spine bone. Blend slightly
      // toward the next bone so the torso deforms smoothly along the column.
      const boneIndexA = spineBones[i].boneIndex ?? 0;
      const boneIndexB = spineBones[Math.min(i + 1, rings - 1)].boneIndex ?? boneIndexA;
      const blend = i / Math.max(1, rings - 1);
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
