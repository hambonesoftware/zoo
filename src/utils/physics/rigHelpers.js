// src/utils/physics/rigHelpers.js

import * as CANNON from 'cannon-es';

/**
 * Add a capsule shape (cylinder + hemispheres) to a Cannon-es body.
 * @param {CANNON.Body} body
 * @param {number} radius
 * @param {number} length
 * @param {'x'|'y'|'z'} direction
 */
export function addCapsuleToBody(body, radius = 0.2, length = 1, direction = 'y') {
  const halfLength = length / 2;
  const cylinderHeight = length - radius * 2;

  let quaternion;
  switch (direction) {
    case 'x':
      quaternion = new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2);
      break;
    case 'z':
      quaternion = new CANNON.Quaternion().setFromEuler(Math.PI / 2, 0, 0);
      break;
    case 'y':
    default:
      quaternion = new CANNON.Quaternion().setFromEuler(0, 0, 0);
  }

  // Centered cylinder
  if (cylinderHeight > 0) {
    const cylinder = new CANNON.Cylinder(radius, radius, cylinderHeight, 16);
    body.addShape(cylinder, new CANNON.Vec3(0, 0, 0), quaternion);
  }

  // Spheres on each end
  const sphereA = new CANNON.Sphere(radius);
  const sphereB = new CANNON.Sphere(radius);
  const offsetA = new CANNON.Vec3(halfLength, 0, 0);
  const offsetB = new CANNON.Vec3(-halfLength, 0, 0);

  if (direction === 'y') {
    offsetA.set(0, halfLength, 0);
    offsetB.set(0, -halfLength, 0);
  } else if (direction === 'z') {
    offsetA.set(0, 0, halfLength);
    offsetB.set(0, 0, -halfLength);
  }
  body.addShape(sphereA, offsetA);
  body.addShape(sphereB, offsetB);
}
