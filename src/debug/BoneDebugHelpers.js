// src/debug/BoneDebugHelpers.js

import * as THREE from 'three';

/**
 * A helper to visualize bone pivots and orientations.
 * Each bone will be represented by a small sphere and axis helper.
 */
export class BoneDebugHelpers {
  constructor(skeleton) {
    this.group = new THREE.Group();
    this.skeleton = skeleton;
    this.boneHelpers = [];

    this.init();
  }

  init() {
    if (!this.skeleton || !this.skeleton.bones) return;

    this.skeleton.bones.forEach(bone => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      bone.add(sphere);

      const axes = new THREE.AxesHelper(0.05);
      bone.add(axes);

      this.boneHelpers.push({ bone, sphere, axes });
    });
  }

  /**
   * Update bone helpers if needed (in case of dynamic pose changes)
   */
  update() {
    this.boneHelpers.forEach(({ bone, sphere, axes }) => {
      sphere.position.set(0, 0, 0);
      axes.position.set(0, 0, 0);
    });
  }

  /**
   * Returns the helper group that should be added to the scene.
   */
  getHelperGroup() {
    return this.group;
  }
}
