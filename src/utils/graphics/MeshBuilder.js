// src/utils/graphics/MeshBuilder.js

import * as THREE from 'three';

/**
 * MeshBuilder
 * -----------
 * Centralizes creation of geometry+material meshes for zoo creatures, objects, and fence parts.
 * Extendable for new shapes.
 */
const MeshBuilder = {
  /**
   * Create a Three.js Mesh for a sphere.
   * @param {number} radius
   * @param {THREE.Material} material
   * @param {number} segments - (optional) default 20
   * @returns {THREE.Mesh}
   */
  createSphere(radius, material, segments = 20) {
    const geo = new THREE.SphereGeometry(radius, segments, segments);
    return new THREE.Mesh(geo, material);
  },

  /**
   * Create a Three.js Mesh for a capsule (with hemispherical ends).
   * Requires r150+ of Three.js (THREE.CapsuleGeometry).
   * @param {number} radius
   * @param {number} length - Full length (end to end)
   * @param {THREE.Material} material
   * @param {number} capSegments - (optional) default 8
   * @returns {THREE.Mesh}
   */
	   
	createLionMesh() {
	  // For now, just use a colored sphere as a placeholder
	  const geo = new THREE.SphereGeometry(1.0, 32, 32);
	  const mat = new THREE.MeshStandardMaterial({ color: 0xf0c040 });
	  return new THREE.Mesh(geo, mat);
	},

   
   
  createCapsule(radius, length, material, capSegments = 8) {
    const geo = new THREE.CapsuleGeometry(radius, length, capSegments, capSegments);
    return new THREE.Mesh(geo, material);
  },

  /**
   * Create a Three.js Mesh for a box.
   * @param {{x:number, y:number, z:number}} size
   * @param {THREE.Material} material
   * @returns {THREE.Mesh}
   */
  createBox(size, material) {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    return new THREE.Mesh(geo, material);
  },

  /**
   * Create a Three.js Mesh for a cylinder (used for fence bars, logs, etc).
   * @param {number} radius
   * @param {number} height
   * @param {THREE.Material} material
   * @param {number} radialSegments (optional)
   * @returns {THREE.Mesh}
   */
  createCylinder(radius, height, material, radialSegments = 16) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
    return new THREE.Mesh(geo, material);
  },

  /**
   * Create a cement block (for fence base).
   * @param {{x:number, y:number, z:number}} size
   * @param {THREE.Material} material
   * @returns {THREE.Mesh}
   */
  createCementBlock(size, material) {
    return MeshBuilder.createBox(size, material);
  },

  /**
   * Create a vertical bar for a fence.
   * @param {number} barRadius
   * @param {number} barHeight
   * @param {THREE.Material} material
   * @returns {THREE.Mesh}
   */
  createFenceBar(barRadius, barHeight, material) {
    return MeshBuilder.createCylinder(barRadius, barHeight, material, 12);
  }
};

export default MeshBuilder;
