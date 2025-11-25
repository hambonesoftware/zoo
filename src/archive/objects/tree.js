// src/objects/tree.js

import * as THREE from '../../libs/three.module.js';
import * as CANNON from '../../libs/cannon-es.js';

// === Parameters for base tree ===
const TRUNK_HEIGHT = 2.2;
const TRUNK_RADIUS = 0.32;
const TRUNK_COLOR  = 0x9a7b55;

const LEAVES_HEIGHT = 2.2;
const LEAVES_RADIUS = 1.15;
const LEAVES_COLOR  = 0x34b645;

/**
 * Create a tree mesh and physics body.
 * type: 0 = round/deciduous, 1 = pine, 2 = palm, 3 = fruit
 * Returns: { mesh, body }
 */
export function createTree(x = 0, y = 0, z = 0, type = 0) {
  const group = new THREE.Group();

  // --- Trunk (cylinder) ---
  const trunkGeom = new THREE.CylinderGeometry(TRUNK_RADIUS, TRUNK_RADIUS * 0.8, TRUNK_HEIGHT, 10);
  const trunkMat  = new THREE.MeshPhongMaterial({ color: TRUNK_COLOR });
  const trunk     = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.set(0, TRUNK_HEIGHT / 2, 0);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // --- Leaves / Canopy / Fronds ---
  switch (type) {
    case 1: // Pine/conifer (cone)
      {
        const pineGeom = new THREE.ConeGeometry(LEAVES_RADIUS * 0.95, LEAVES_HEIGHT * 1.4, 14);
        const pineMat  = new THREE.MeshPhongMaterial({ color: 0x297441 });
        const pine     = new THREE.Mesh(pineGeom, pineMat);
        pine.position.set(0, TRUNK_HEIGHT + LEAVES_HEIGHT * 0.7, 0);
        pine.castShadow = true;
        pine.receiveShadow = true;
        group.add(pine);
      }
      break;
    case 2: // Palm (six splayed fronds, flat leaves on top)
      {
        const palmGeom = new THREE.CylinderGeometry(LEAVES_RADIUS * 0.07, LEAVES_RADIUS * 0.19, LEAVES_HEIGHT * 0.13, 10);
        const palmMat  = new THREE.MeshPhongMaterial({ color: 0x6ed65d });
        for (let i = 0; i < 6; i++) {
          const palmLeaf = new THREE.Mesh(palmGeom, palmMat);
          palmLeaf.position.set(
            Math.cos((i / 6) * Math.PI * 2) * (LEAVES_RADIUS * 1.15),
            TRUNK_HEIGHT + 0.5,
            Math.sin((i / 6) * Math.PI * 2) * (LEAVES_RADIUS * 1.15)
          );
          palmLeaf.rotation.z = Math.PI / 2;
          palmLeaf.rotation.y = (i / 6) * Math.PI * 2;
          palmLeaf.castShadow = true;
          palmLeaf.receiveShadow = true;
          group.add(palmLeaf);
        }
      }
      break;
    case 3: // Fruit tree (round leaves, plus fruits)
      {
        const fruitGeom = new THREE.SphereGeometry(LEAVES_RADIUS * 1.08, 11, 8);
        const fruitMat  = new THREE.MeshPhongMaterial({ color: 0xc3e060 });
        const fruit     = new THREE.Mesh(fruitGeom, fruitMat);
        fruit.position.set(0, TRUNK_HEIGHT + LEAVES_RADIUS * 0.98, 0);
        fruit.castShadow = true;
        fruit.receiveShadow = true;
        group.add(fruit);
        // Add 3–5 "fruits" (small spheres)
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
          const appleGeom = new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 8, 6);
          const appleMat  = new THREE.MeshPhongMaterial({ color: 0xf0572c });
          const angle = i * Math.PI / 2 + Math.random() * 0.5;
          const apple = new THREE.Mesh(appleGeom, appleMat);
          apple.position.set(
            Math.cos(angle) * (LEAVES_RADIUS * 0.8),
            TRUNK_HEIGHT + LEAVES_RADIUS * (1.0 + Math.random() * 0.14),
            Math.sin(angle) * (LEAVES_RADIUS * 0.8)
          );
          apple.castShadow = true;
          group.add(apple);
        }
      }
      break;
    default: // Deciduous/round
      {
        const leavesGeom = new THREE.SphereGeometry(LEAVES_RADIUS, 13, 10);
        const leavesMat  = new THREE.MeshPhongMaterial({ color: LEAVES_COLOR });
        const leaves     = new THREE.Mesh(leavesGeom, leavesMat);
        leaves.position.set(0, TRUNK_HEIGHT + LEAVES_RADIUS * 0.85, 0);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        group.add(leaves);

        // Add 1-2 extra spheres for canopy variety
        for (let i = 0; i < 2; i++) {
          const r = LEAVES_RADIUS * (0.83 + Math.random() * 0.21);
          const g = new THREE.SphereGeometry(r, 11, 8);
          const m = new THREE.MeshPhongMaterial({ color: 0x43c755 + Math.floor(Math.random() * 0x50) });
          const s = new THREE.Mesh(g, m);
          s.position.set(
            (Math.random() - 0.5) * LEAVES_RADIUS * 1.4,
            TRUNK_HEIGHT + LEAVES_RADIUS * (0.65 + Math.random() * 0.25),
            (Math.random() - 0.5) * LEAVES_RADIUS * 1.1
          );
          s.castShadow = true;
          group.add(s);
        }
      }
  }

  // Place tree group in world space
  group.position.set(x, y, z);
  group.userData = { isTree: true, type };

  // --- Physics: Trunk as static Cannon cylinder ---
  // Cannon cylinder axis is X by default; rotate to vertical (Y)
  const trunkShape = new CANNON.Cylinder(
    TRUNK_RADIUS * 0.98, TRUNK_RADIUS * 0.96, TRUNK_HEIGHT * 0.99, 10
  );
  const quat = new CANNON.Quaternion();
  quat.setFromEuler(-Math.PI / 2, 0, 0);
  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(x, y + TRUNK_HEIGHT / 2, z),
    shape: trunkShape,
    quaternion: quat
  });

  return { mesh: group, body };
}
