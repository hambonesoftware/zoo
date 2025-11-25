// src/objects/bush.js

import * as THREE from '../../libs/three.module.js';
import * as CANNON from '../../libs/cannon-es.js';

// Bush color palette
const GREENS = [0x44b05c, 0x56b964, 0x3c8c47, 0x5fd177, 0x349946];
const HIGHLIGHT_GREENS = [0x7af29b, 0x90ffb1, 0x66e68a];
// Berry/flower colors
const BERRY_COLORS = [0xd22a2a, 0xfad12e, 0xffffff, 0x8b47cf, 0xff89ad];

// For Cannon-es, this is the main collision sphere's radius
const BUSH_RADIUS = 0.74;

/**
 * Create a lush, multi-puff bush mesh + static Cannon-es physics body.
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} z - World Z position
 * @returns {{ mesh: THREE.Group, body: CANNON.Body }}
 */
export function createBush(x = 0, y = 0, z = 0) {
  const group = new THREE.Group();

  // Number of "puffs" (main + random offset puffs)
  const puffCount = 4 + Math.floor(Math.random() * 3); // 4–6 puffs
  const puffRadii = [];
  let avgRadius = 0;
  for (let i = 0; i < puffCount; i++) {
    // Main puff is larger, side puffs vary
    const radius = i === 0 ? BUSH_RADIUS : BUSH_RADIUS * (0.68 + Math.random() * 0.18);
    puffRadii.push(radius);
    avgRadius += radius;
    // Randomly choose main or highlight green, with subtle variance
    const color = (i > 1 && Math.random() < 0.36) ?
      HIGHLIGHT_GREENS[Math.floor(Math.random() * HIGHLIGHT_GREENS.length)] :
      GREENS[Math.floor(Math.random() * GREENS.length)];
    const geom = new THREE.SphereGeometry(radius, 14, 12);
    const mat = new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 10 });
    const puff = new THREE.Mesh(geom, mat);

    // Center puff goes up, others orbit the center in XZ, Y with random variance
    if (i === 0) {
      puff.position.set(0, radius, 0);
    } else {
      const angle = (i / (puffCount - 1)) * Math.PI * 2 + Math.random() * 0.7;
      const rOff = BUSH_RADIUS * (0.61 + Math.random() * 0.26);
      puff.position.set(
        Math.cos(angle) * rOff,
        radius * (0.92 + Math.random() * 0.18),
        Math.sin(angle) * rOff
      );
    }
    puff.castShadow = true;
    puff.receiveShadow = true;
    group.add(puff);
  }
  avgRadius /= puffCount;

  // Optional: Berries/flowers at the top or side
  if (Math.random() < 0.35) {
    const berryColor = BERRY_COLORS[Math.floor(Math.random() * BERRY_COLORS.length)];
    const berryGeom = new THREE.SphereGeometry(0.11 + Math.random() * 0.07, 7, 6);
    const berryMat = new THREE.MeshPhongMaterial({
      color: berryColor,
      emissive: berryColor,
      emissiveIntensity: 0.17 + Math.random() * 0.22,
      flatShading: true
    });
    const berry = new THREE.Mesh(berryGeom, berryMat);
    // Randomly place on top or side
    if (Math.random() < 0.5) {
      berry.position.set(
        (Math.random() - 0.5) * 0.32,
        BUSH_RADIUS * 1.42 + Math.random() * 0.12,
        (Math.random() - 0.5) * 0.32
      );
    } else {
      const angle = Math.random() * Math.PI * 2;
      berry.position.set(
        Math.cos(angle) * BUSH_RADIUS * 0.95,
        BUSH_RADIUS * (1.0 + Math.random() * 0.12),
        Math.sin(angle) * BUSH_RADIUS * 0.95
      );
    }
    berry.castShadow = true;
    group.add(berry);
  }

  // Place bush group in world
  group.position.set(x, y, z);
  group.userData = { isBush: true };

  // --- Physics: Single static sphere ---
  const body = new CANNON.Body({
    mass: 0, // static
    position: new CANNON.Vec3(x, y + BUSH_RADIUS, z), // vertical center
    shape: new CANNON.Sphere(BUSH_RADIUS)
  });

  return { mesh: group, body };
}
