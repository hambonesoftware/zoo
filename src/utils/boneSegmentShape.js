// src/utils/boneSegmentShapes.js

import * as THREE from 'three';

/**
 * Creates a low-poly box geometry for a body or torso.
 * @param {number} w Width (x)
 * @param {number} h Height (y)
 * @param {number} d Depth (z)
 * @param {number} ws Width segments (default: 6)
 * @param {number} hs Height segments (default: 2)
 * @param {number} ds Depth segments (default: 6)
 * @returns {THREE.BoxGeometry}
 */
export function createLowPolyBox(w, h, d, ws = 6, hs = 2, ds = 6) {
  // Fewer segments = more stylized!
  return new THREE.BoxGeometry(w, h, d, ws, hs, ds);
}

/**
 * Creates a low-poly cylinder geometry stretching between two points.
 * Used for legs, necks, tails.
 * @param {THREE.Vector3} a Start position
 * @param {THREE.Vector3} b End position
 * @param {number} rA Radius at start
 * @param {number} rB Radius at end
 * @param {number} radialSegments (default: 5)
 * @returns {THREE.BufferGeometry}
 */
export function createLowPolyCylinder(a, b, rA, rB, radialSegments = 5) {
  const len = a.distanceTo(b);
  const mid = a.clone().lerp(b, 0.5);

  // Cylinder aligned along local Z axis, then rotated
  const geo = new THREE.CylinderGeometry(rB, rA, len, radialSegments, 1);
  // Orient Z axis to direction a->b
  const zDir = b.clone().sub(a).normalize();
  let yDir = new THREE.Vector3(0, 1, 0);
  if (Math.abs(zDir.dot(yDir)) > 0.999) yDir.set(1, 0, 0); // Avoid parallel bug
  const xDir = new THREE.Vector3().crossVectors(yDir, zDir).normalize();
  const rotMat = new THREE.Matrix4().makeBasis(xDir, yDir, zDir);
  geo.applyMatrix4(rotMat);
  geo.translate(mid.x, mid.y, mid.z);

  return geo;
}

/**
 * Creates a stylized low-poly tetrahedral head.
 * @param {THREE.Vector3} center World position for head center
 * @param {number} w Width (x)
 * @param {number} h Height (y)
 * @param {number} d Depth (z)
 * @returns {THREE.BufferGeometry}
 */
export function createTetraHead(center, w, h, d) {
  // Use no subdivisions for strong silhouette (low-poly look)
  const geo = new THREE.TetrahedronGeometry(0.5, 0);
  geo.scale(w, h, d * 1.2); // Slight elongation on Z for snout
  geo.translate(center.x, center.y, center.z);
  return geo;
}

/**
 * Optionally, create a low-poly paw using a cube or tetrahedron.
 * @param {THREE.Vector3} center World position for paw
 * @param {number} size Overall size
 * @returns {THREE.BufferGeometry}
 */
export function createLowPolyPaw(center, size = 0.06) {
  // You can use a simple cube, tetra, or even a small pyramid
  const geo = new THREE.BoxGeometry(size, size * 0.5, size, 1, 1, 1);
  geo.translate(center.x, center.y - size * 0.25, center.z);
  return geo;
}
