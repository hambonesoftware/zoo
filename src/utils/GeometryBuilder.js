// src/utils/GeometryBuilder.js

import * as THREE from 'three';

/**
 * Create a ring of vertices perpendicular to axis at center.
 */
export function createRing(center, axis, radius, sides) {
  const up = Math.abs(axis.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(axis, up).normalize();
  const bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize();
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const theta = (i / sides) * Math.PI * 2;
    const offset = new THREE.Vector3()
      .addScaledVector(tangent, Math.cos(theta) * radius)
      .addScaledVector(bitangent, Math.sin(theta) * radius);
    verts.push(center.clone().add(offset));
  }
  return verts;
}

/**
 * Bridge two rings into quads (triangulated), appending indices.
 */
export function bridgeRings(startA, startB, sides, indices) {
  for (let i = 0; i < sides; i++) {
    const a0 = startA + i;
    const a1 = startA + ((i + 1) % sides);
    const b0 = startB + i;
    const b1 = startB + ((i + 1) % sides);
    indices.push(a0, b0, a1);
    indices.push(a1, b0, b1);
  }
}

/**
 * Packs arrays into BufferGeometry and performs validation.
 */
export function buildBufferGeometry({positions, normals, skinIndices, skinWeights, uvs, indices}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Debug: Validate attribute lengths
  const vcount = positions.length / 3;
  if (
    normals.length / 3 !== vcount ||
    skinIndices.length / 4 !== vcount ||
    skinWeights.length / 4 !== vcount ||
    uvs.length / 2 !== vcount
  ) {
    console.warn('Attribute array length mismatch!', {
      positions: positions.length,
      normals: normals.length,
      skinIndices: skinIndices.length,
      skinWeights: skinWeights.length,
      uvs: uvs.length
    });
  }
  return geometry;
}
