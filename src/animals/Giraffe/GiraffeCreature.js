// src/animals/Giraffe/GiraffeCreature.js

import * as THREE from 'three';
import { GiraffeDefinition } from './GiraffeDefinition.js';
import { GiraffeGenerator } from './GiraffeGenerator.js';

export class GiraffeCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    this.bones = this._buildBonesFromDefinition(GiraffeDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    const rootBone = this.bones.find((b) => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    this.updateMatrixWorld(true);

    const { mesh, behavior } = GiraffeGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior;

    this.add(mesh);

    if (options.debug) {
      this.skeletonHelper = new THREE.SkeletonHelper(this.mesh);
      this.skeletonHelper.material.linewidth = 2;
      this.skeletonHelper.material.color.set(0xffc04d);
      this.add(this.skeletonHelper);
    }

    if (options.position) this.position.fromArray(options.position);
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

    return boneDefs.map((def) => boneMap[def.name]);
  }

  update(delta) {
    if (this.behavior) this.behavior.update(delta);
    if (this.skeletonHelper) this.skeletonHelper.update();
  }
}
