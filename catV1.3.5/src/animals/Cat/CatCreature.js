// src/animals/CatCreature.js

import * as THREE from 'three';
import { CatDefinition } from './CatDefinition.js';
import { CatGenerator } from './CatGenerator.js';

export class CatCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    // 1. Build Bones
    this.bones = this._buildBonesFromDefinition(CatDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    // 2. Helper to set initial World Matrices
    const rootBone = this.bones.find(b => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    this.updateMatrixWorld(true);
    
    // 3. Generate High-Res Mesh
    const { mesh, behavior } = CatGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior; // You may need to adjust physics in Behavior for weight!

    this.add(mesh);

    // 4. Debug
    if (options.debug) {
        this.skeletonHelper = new THREE.SkeletonHelper(this.mesh);
        this.skeletonHelper.material.linewidth = 2;
        this.skeletonHelper.material.color.set(0xffff00); // Yellow for visibility
        this.add(this.skeletonHelper);
    }

    // 5. Transform
    if (options.position) this.position.fromArray(options.position);
    
    // Default scale 1.0; adjust via options.scale to fit the scene as needed.
    if (options.scale) this.scale.setScalar(options.scale);
  }

  _buildBonesFromDefinition(boneDefs) {
    const boneMap = {};
    
    for (const def of boneDefs) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.fromArray(def.position);
      boneMap[def.name] = bone;
    }

    for (const def of boneDefs) {
      if (def.parent && boneMap[def.parent] && def.parent !== 'root') {
        boneMap[def.parent].add(boneMap[def.name]);
      }
    }

    return boneDefs.map(def => boneMap[def.name]);
  }

  update(delta) {
    if (this.behavior) this.behavior.update(delta);
    if (this.skeletonHelper) this.skeletonHelper.update();
  }
}