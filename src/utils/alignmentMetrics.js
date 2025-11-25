// src/utils/alignmentMetrics.js

import * as THREE from 'three';


/**
 * Computes world-space alignment metrics between a mesh and its corresponding bone.
 * Useful for debug overlays or runtime adjustments.
 *
 * @param {THREE.Object3D} mesh - The mesh attached to the skeleton.
 * @param {THREE.Bone} bone - The bone controlling the mesh.
 * @returns {Object} - An object containing position delta, angular delta, and bounding box metrics.
 */
export function computeAlignmentMetrics(mesh, bone) {
  const meshWorldPos = new THREE.Vector3();
  const boneWorldPos = new THREE.Vector3();
  const meshWorldQuat = new THREE.Quaternion();
  const boneWorldQuat = new THREE.Quaternion();

  // Get world position and rotation
  mesh.getWorldPosition(meshWorldPos);
  bone.getWorldPosition(boneWorldPos);
  mesh.getWorldQuaternion(meshWorldQuat);
  bone.getWorldQuaternion(boneWorldQuat);

  // Position difference
  const positionDelta = meshWorldPos.clone().sub(boneWorldPos);

  // Angular difference
  const angularDelta = meshWorldQuat.angleTo(boneWorldQuat);

  // Mesh bounding box size for scale context
  const bbox = new THREE.Box3().setFromObject(mesh);
  const bboxSize = new THREE.Vector3();
  bbox.getSize(bboxSize);

  return {
    positionDelta,    // Vector3
    angularDelta,     // Float (radians)
    bboxSize          // Vector3
  };
}
