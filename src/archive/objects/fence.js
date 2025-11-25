// src/objects/fence.js

import * as THREE from '../../libs/three.module.js';
import * as CANNON from '../../libs/cannon-es.js';

// Fence segment parameters
const SEGMENT_LENGTH = 8;    // Distance between posts (should match tile size)
const BASE_HEIGHT = 1.1;
const BASE_THICK = 0.5;
const BAR_HEIGHT = 3.2;
const BAR_RADIUS = 0.13;
const BAR_SPACING = 1.1;    // How far between bars
const BAR_COLOR = 0x222629;
const BASE_COLOR = 0xababab;
const POST_RADIUS = 0.26;
const POST_HEIGHT = BAR_HEIGHT + BASE_HEIGHT;
const POST_COLOR = 0x1a1a1a;

/**
 * Creates a fence segment: Three.js mesh and Cannon-es physics body
 * @param {number} x1 - Start x
 * @param {number} z1 - Start z
 * @param {number} x2 - End x
 * @param {number} z2 - End z
 * @param {number} [y=0] - Base Y
 * @param {boolean} [addStartPost=false]
 * @param {boolean} [addEndPost=false]
 * @returns {{mesh:THREE.Group, body:CANNON.Body}}
 */
export function createFenceSegment(x1, z1, x2, z2, y = 0, addStartPost = false, addEndPost = false) {
  const group = new THREE.Group();

  // Vector along segment
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  // Center position (midpoint)
  const mx = (x1 + x2) / 2;
  const mz = (z1 + z2) / 2;

  // ---- Visuals (Three.js) ----
  // Cement block base
  const baseGeom = new THREE.BoxGeometry(len, BASE_HEIGHT, BASE_THICK);
  const baseMat = new THREE.MeshPhongMaterial({ color: BASE_COLOR });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.set(0, BASE_HEIGHT / 2, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Bars: spaced along the segment
  const numBars = Math.floor(len / BAR_SPACING) + 1;
  for (let i = 0; i < numBars; i++) {
    const frac = numBars === 1 ? 0.5 : i / (numBars - 1);
    const barX = -len / 2 + frac * len;
    const barGeom = new THREE.CylinderGeometry(BAR_RADIUS, BAR_RADIUS, BAR_HEIGHT, 10);
    const barMat = new THREE.MeshPhongMaterial({ color: BAR_COLOR });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.set(barX, BASE_HEIGHT + BAR_HEIGHT / 2, 0);
    group.add(bar);
  }

  // Start/end posts (corners)
  if (addStartPost) {
    const postGeom = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 16);
    const postMat = new THREE.MeshPhongMaterial({ color: POST_COLOR });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(-len / 2, POST_HEIGHT / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }
  if (addEndPost) {
    const postGeom = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 16);
    const postMat = new THREE.MeshPhongMaterial({ color: POST_COLOR });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(len / 2, POST_HEIGHT / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  // Place and rotate group at segment center, facing correct direction
  group.position.set(mx, y, mz);
  group.rotation.y = angle;

  // ---- Physics (Cannon-es) ----
  // Use a single long box shape for collisions (approximate base+bars as one solid)
  const fenceShape = new CANNON.Box(
    new CANNON.Vec3(len / 2, (BAR_HEIGHT + BASE_HEIGHT) / 2, BASE_THICK / 1.4)
  );
  const body = new CANNON.Body({
    mass: 0, // static
    position: new CANNON.Vec3(mx, y + (BAR_HEIGHT + BASE_HEIGHT) / 2, mz),
    shape: fenceShape
  });
  // Align orientation
  body.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    angle
  );

  return { mesh: group, body };
}
