// src/objects/building.js

import * as THREE from '../../libs/three.module.js';
import * as CANNON from '../../libs/cannon-es.js';

// Building parameters
const BUILDING_WIDTH  = 9;
const BUILDING_HEIGHT = 5;
const BUILDING_DEPTH  = 8;
const WALL_COLOR      = 0xd4c7b7;
const ROOF_COLOR      = 0x9d2f28;
const DOOR_COLOR      = 0x714729;
const WINDOW_COLOR    = 0xcfe5ff;

// Extra details
const ROOF_RIDGE_COLOR = 0x7a1f1a;
const STEP_COLOR = 0xa18c77;

// Options: { entrance: "front"|"left"|"right"|"back", windows: true|false }
export function createBuilding(
  x = 0, y = 0, z = 0,
  options = { entrance: "front", windows: true }
) {
  const group = new THREE.Group();

  // --- Main body (walls) ---
  const wallGeom = new THREE.BoxGeometry(BUILDING_WIDTH, BUILDING_HEIGHT, BUILDING_DEPTH);
  const wallMat  = new THREE.MeshPhongMaterial({ color: WALL_COLOR, flatShading: true });
  const walls    = new THREE.Mesh(wallGeom, wallMat);
  walls.position.set(0, BUILDING_HEIGHT / 2, 0);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // --- Roof (with ridge) ---
  const roofGeom = new THREE.BoxGeometry(BUILDING_WIDTH * 1.13, 1.16, BUILDING_DEPTH * 1.13);
  const roofMat  = new THREE.MeshPhongMaterial({ color: ROOF_COLOR });
  const roof     = new THREE.Mesh(roofGeom, roofMat);
  roof.position.set(0, BUILDING_HEIGHT + 0.65, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Ridge cap (optional)
  if (Math.random() < 0.82) {
    const ridgeGeom = new THREE.BoxGeometry(BUILDING_WIDTH * 0.97, 0.25, 0.32);
    const ridgeMat = new THREE.MeshPhongMaterial({ color: ROOF_RIDGE_COLOR });
    const ridge = new THREE.Mesh(ridgeGeom, ridgeMat);
    ridge.position.set(0, BUILDING_HEIGHT + 1.10, 0);
    ridge.castShadow = true;
    group.add(ridge);
  }

  // --- Door (with optional step) ---
  let door = null;
  let step = null;
  const DOOR_HEIGHT = 2.2 + Math.random() * 0.22;
  const DOOR_WIDTH  = 1.13 + Math.random() * 0.17;

  if (options.entrance === "front") {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.27),
      new THREE.MeshPhongMaterial({ color: DOOR_COLOR })
    );
    door.position.set(0, 1.15, BUILDING_DEPTH/2 + 0.14 - 0.05);

    // Optional step
    if (Math.random() < 0.84) {
      step = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR_WIDTH + 0.34, 0.24, 0.54),
        new THREE.MeshPhongMaterial({ color: STEP_COLOR })
      );
      step.position.set(0, 0.12, BUILDING_DEPTH/2 + 0.26);
      group.add(step);
    }
  } else if (options.entrance === "left") {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, DOOR_HEIGHT, DOOR_WIDTH),
      new THREE.MeshPhongMaterial({ color: DOOR_COLOR })
    );
    door.position.set(-BUILDING_WIDTH/2 - 0.13 + 0.05, 1.15, 0);
    if (Math.random() < 0.84) {
      step = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.24, DOOR_WIDTH + 0.34),
        new THREE.MeshPhongMaterial({ color: STEP_COLOR })
      );
      step.position.set(-BUILDING_WIDTH/2 - 0.26, 0.12, 0);
      group.add(step);
    }
  } else if (options.entrance === "right") {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, DOOR_HEIGHT, DOOR_WIDTH),
      new THREE.MeshPhongMaterial({ color: DOOR_COLOR })
    );
    door.position.set(BUILDING_WIDTH/2 + 0.13 - 0.05, 1.15, 0);
    if (Math.random() < 0.84) {
      step = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.24, DOOR_WIDTH + 0.34),
        new THREE.MeshPhongMaterial({ color: STEP_COLOR })
      );
      step.position.set(BUILDING_WIDTH/2 + 0.26, 0.12, 0);
      group.add(step);
    }
  } else if (options.entrance === "back") {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.27),
      new THREE.MeshPhongMaterial({ color: DOOR_COLOR })
    );
    door.position.set(0, 1.15, -BUILDING_DEPTH/2 - 0.14 + 0.05);
    if (Math.random() < 0.84) {
      step = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR_WIDTH + 0.34, 0.24, 0.54),
        new THREE.MeshPhongMaterial({ color: STEP_COLOR })
      );
      step.position.set(0, 0.12, -BUILDING_DEPTH/2 - 0.26);
      group.add(step);
    }
  }
  if (door) {
    door.castShadow = true;
    group.add(door);
  }

  // --- Windows (optional, more variety) ---
  if (options.windows) {
    const windowGeom = new THREE.BoxGeometry(1.23 + Math.random() * 0.25, 1.06, 0.13);
    const windowMat  = new THREE.MeshPhongMaterial({ color: WINDOW_COLOR, emissive: 0x9ec0e7, emissiveIntensity: 0.14 });

    // Front face windows (2-3)
    for (let i of [-2, 0, 2]) {
      if (Math.random() < 0.7 || i === 0) {
        const win = new THREE.Mesh(windowGeom, windowMat);
        win.position.set(i * 1.25, 2.9, BUILDING_DEPTH / 2 + 0.09);
        group.add(win);
      }
    }
    // Side face windows (random, up to 2 per side)
    for (let j of [-1, 1]) {
      for (let i of [-1, 1]) {
        if (Math.random() < 0.6) {
          const sideWin = new THREE.Mesh(windowGeom, windowMat);
          sideWin.rotation.y = Math.PI / 2;
          sideWin.position.set(j * (BUILDING_WIDTH / 2 + 0.09), 2.9, i * 2.0);
          group.add(sideWin);
        }
      }
    }
    // Back face window (0–1, centered)
    if (Math.random() < 0.6) {
      const winBack = new THREE.Mesh(windowGeom, windowMat);
      winBack.position.set(0, 2.9, -BUILDING_DEPTH / 2 - 0.09);
      group.add(winBack);
    }
  }

  // (Optional) Add a sign above door
  if (Math.random() < 0.32 && door) {
    const signGeom = new THREE.BoxGeometry(2.1, 0.44, 0.14);
    const signMat = new THREE.MeshPhongMaterial({ color: 0x56391c });
    const sign = new THREE.Mesh(signGeom, signMat);
    sign.position.copy(door.position);
    sign.position.y += 1.3;
    sign.position.z += (options.entrance === "front" ? 0.21 : options.entrance === "back" ? -0.21 : 0);
    sign.position.x += (options.entrance === "left" ? -0.21 : options.entrance === "right" ? 0.21 : 0);
    group.add(sign);
  }

  // Final positioning
  group.position.set(x, y, z);

  // Add marker for raycasting
  group.userData = { isBuilding: true };

  // --- Physics: Static Cannon-es box for main structure ---
  const body = new CANNON.Body({
    mass: 0, // static
    position: new CANNON.Vec3(x, y + BUILDING_HEIGHT / 2, z),
    shape: new CANNON.Box(
      new CANNON.Vec3(BUILDING_WIDTH / 2, BUILDING_HEIGHT / 2, BUILDING_DEPTH / 2)
    )
  });

  return { mesh: group, body };
}
