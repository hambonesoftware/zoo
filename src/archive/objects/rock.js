// src/objects/rock.js

import * as THREE from '../../libs/three.module.js';
import * as CANNON from '../../libs/cannon-es.js';

// Helper to add randomness for organic look
function perturbPosition(geometry, radius, flatTop = false, yOff = 0) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    // Only perturb non-flat faces for top
    if (!flatTop || y < yOff - 0.001) {
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * radius * 0.17);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * radius * 0.17);
    }
    // Sides bulge a little
    if (y > yOff - 0.3 && y < yOff + 0.3) {
      pos.setY(i, y + (Math.random() - 0.5) * radius * 0.03);
    }
  }
  geometry.computeVertexNormals();
}

// Make a single rocky tier (flat top, irregular sides)
function makeTier({ radius = 4, height = 1.2, y = 0, color = 0x90897c, name = "tier" } = {}) {
  const geom = new THREE.CylinderGeometry(
    radius * (1 + (Math.random() - 0.5) * 0.08),
    radius * (1 + (Math.random() - 0.5) * 0.1),
    height,
    18 + Math.floor(Math.random() * 4),
    1,
    false
  );
  perturbPosition(geom, radius, true, height / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: color,
    flatShading: true,
    shininess: 12,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, y, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  mesh.userData = { interactive: true, type: 'ledge', name };
  return mesh;
}

/**
 * Create a multi-tiered, organic rock and matching Cannon-es physics body.
 * @param {object} options - Customization
 * @returns {{ mesh: THREE.Group, body: CANNON.Body }}
 */
export function createRock({
  position = { x: 0, y: 0, z: 0 },
  baseRadius = 5.2,     // Much wider base
  midRadius = 4.1,      // A little wider mid-tier
  topRadius = 2.2,      // Unchanged top tier
  height = 3.6,
  colorBase = 0x8b8376,
  colorMid = 0xa59d8c,
  colorTop = 0xe7e3d7
} = {}) {
  const group = new THREE.Group();

  // Heights of tiers
  const baseHeight = height * 0.48;
  const midHeight = height * 0.32;
  const topHeight = height * 0.19;

  // Bottom tier (much wider)
  const baseTier = makeTier({
    radius: baseRadius,
    height: baseHeight,
    y: baseHeight / 2,
    color: colorBase,
    name: "baseTier"
  });
  group.add(baseTier);

  // Middle tier (wider)
  const midTier = makeTier({
    radius: midRadius,
    height: midHeight,
    y: baseHeight + midHeight / 2 - 0.14,
    color: colorMid,
    name: "midTier"
  });
  midTier.position.x = 0.45 + (Math.random() - 0.5) * baseRadius * 0.15;
  midTier.position.z = 0.38 + (Math.random() - 0.5) * baseRadius * 0.09;
  group.add(midTier);

  // Top tier (unchanged)
  const topTier = makeTier({
    radius: topRadius,
    height: topHeight,
    y: baseHeight + midHeight + topHeight / 2 - 0.24,
    color: colorTop,
    name: "topTier"
  });
  topTier.position.x = 0.75 + (Math.random() - 0.5) * baseRadius * 0.13;
  topTier.position.z = -0.55 + (Math.random() - 0.5) * baseRadius * 0.13;
  group.add(topTier);

  // Optional: Add a darker "underhang" at the bottom for visual weight
  const underhangGeom = new THREE.CylinderGeometry(baseRadius * 0.83, baseRadius * 0.93, baseHeight * 0.19, 18, 1, false);
  perturbPosition(underhangGeom, baseRadius * 0.8);
  const underhangMat = new THREE.MeshPhongMaterial({
    color: 0x393531,
    flatShading: true,
    shininess: 6
  });
  const underhang = new THREE.Mesh(underhangGeom, underhangMat);
  underhang.position.set(0, baseHeight * 0.1, 0);
  underhang.castShadow = true;
  underhang.receiveShadow = true;
  underhang.name = "underhang";
  underhang.userData = { interactive: false };
  group.add(underhang);

  // Place in world
  group.position.set(position.x, position.y, position.z);
  group.userData = { isRock: true };

  // ----- Physics body (static cylinder, matches base tier) -----
  const baseY = position.y + (baseHeight / 2); // vertical center of base
  const rockShape = new CANNON.Cylinder(
    baseRadius * 0.98,
    baseRadius * 0.97,
    baseHeight * 1.08,
    18
  );
  const quat = new CANNON.Quaternion();
  quat.setFromEuler(-Math.PI / 2, 0, 0); // Cannon cylinder is along X; rotate to Y
  const body = new CANNON.Body({
    mass: 0, // static
    shape: rockShape,
    position: new CANNON.Vec3(position.x, baseY, position.z),
    quaternion: quat
  });

  return { mesh: group, body };
}
