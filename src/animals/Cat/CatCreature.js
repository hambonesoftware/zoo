// src/animals/CatCreature.js

import * as THREE from 'three';
import { CatDefinition } from './CatDefinition.js';
import { CatGenerator } from './CatGenerator.js';

export class CatCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    // 1. Build Bones based on the updated CatDefinition
    this.bones = this._buildBonesFromDefinition(CatDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    // 2. Update World Matrices (Critical for skinning calculation)
    // We attach the skeleton to the Group (this) temporarily to calculate world positions
    // relative to the creature's origin.
    const rootBone = this.bones.find(b => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    
    this.updateMatrixWorld(true);
    this.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

    // 3. Generate Mesh
    const { mesh, behavior } = CatGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior;

    this.add(mesh);

    // 4. Debug Helpers
    // Only add if debug option is passed, otherwise clean view
    if (options.debug) {
        this.skeletonHelper = new THREE.SkeletonHelper(this.mesh);
        this.skeletonHelper.material.linewidth = 2;
        this.skeletonHelper.material.color.set(0xff0000);
        this.add(this.skeletonHelper);
    }

    // 5. Transform
    if (options.position) this.position.fromArray(options.position);
    if (options.scale) this.scale.setScalar(options.scale);
    
    // Rotate 180 if your model faces Z-negative (optional, depends on your scene)
    // this.rotation.y = Math.PI; 
  }

  /**
   * Helper: Reconstruct bone hierarchy from flat definition
   */
  _buildBonesFromDefinition(boneDefs) {
    const boneMap = {};
    
    // Create bones
    for (const def of boneDefs) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      // Position in definition is relative to parent
      bone.position.fromArray(def.position);
      boneMap[def.name] = bone;
    }

    // Link parents
    for (const def of boneDefs) {
      if (def.parent && boneMap[def.parent] && def.parent !== 'root') {
        boneMap[def.parent].add(boneMap[def.name]);
      }
    }

    // Return array in the order defined in CatDefinition
    return boneDefs.map(def => boneMap[def.name]);
  }

  update(delta) {
    if (this.behavior) this.behavior.update(delta);
    if (this.skeletonHelper) this.skeletonHelper.update();
  }
}