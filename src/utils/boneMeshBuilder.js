// src/utils/boneMeshBinder.js

import * as THREE from 'three';

/**
 * Create a mesh for a given bone and align it properly.
 * @param {THREE.Bone} bone - The bone to bind the mesh to.
 * @param {Object} options
 * @param {THREE.Vector3} options.size - Dimensions of the mesh.
 * @param {THREE.Material} options.material - Material for the mesh.
 * @param {THREE.Bone|null} options.childBone - Optional child bone to help orient the mesh.
 * @param {boolean} options.alignZ - Whether to align the mesh along the Z axis (default false).
 * @returns {THREE.Mesh}
 */
export function bindMeshToBone(bone, { size, material, childBone = null, alignZ = false }) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

  // Shift geometry to align base of box with the bone
  geometry.translate(0, -size.y / 2, 0);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  bone.add(mesh);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);

  // Orient mesh toward child if needed
  if (childBone) {
    const dir = new THREE.Vector3().subVectors(childBone.getWorldPosition(new THREE.Vector3()), bone.getWorldPosition(new THREE.Vector3()));
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    mesh.quaternion.copy(quat);
  } else if (alignZ) {
    // Optionally align along Z (for tails)
    mesh.rotation.x = Math.PI / 2;
  }

  return mesh;
}

/**
 * Helper to generate a box geometry centered at the bone's midpoint.
 * @param {THREE.Vector3} size - Size of the geometry
 * @returns {THREE.BoxGeometry}
 */
export function recenterGeometryToBoneOrigin(size) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(0, -size.y / 2, 0);
  return geometry;
}

/**
 * Gets the direction vector from a bone to its child.
 * @param {THREE.Bone} bone
 * @param {THREE.Bone} child
 * @returns {THREE.Vector3}
 */
export function getBoneChainVector(bone, child) {
  const from = bone.getWorldPosition(new THREE.Vector3());
  const to = child.getWorldPosition(new THREE.Vector3());
  return new THREE.Vector3().subVectors(to, from).normalize();
}
