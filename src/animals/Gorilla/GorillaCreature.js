// src/animals/Gorilla/GorillaCreature.js

import * as THREE from 'three';
import { GorillaDefinition } from './GorillaDefinition.js';
import { GorillaGenerator } from './GorillaGenerator.js';
import { GorillaLocation } from './GorillaLocation.js';

export class GorillaCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    this.bones = this._buildBonesFromDefinition(GorillaDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    const rootBone = this.bones.find((b) => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    this.updateMatrixWorld(true);

    const { mesh, behavior } = GorillaGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior;

    this.add(mesh);

    const showSkeleton = options.showSkeleton !== false;
    if (showSkeleton) {
      this.skeletonHelper = new THREE.SkeletonHelper(rootBone);
      this.skeletonHelper.skeleton = this.skeleton;
      this.skeletonHelper.material.linewidth = 1;
      this.skeletonHelper.material.color.set(0x00ff66);
      this.skeletonHelper.material.transparent = true;
      this.skeletonHelper.material.opacity = 0.9;
      this.skeletonHelper.material.blending = THREE.AdditiveBlending;
      this.skeletonHelper.material.depthWrite = false;
      this.skeletonHelper.material.toneMapped = false;
      this.add(this.skeletonHelper);
    }

    const position = options.position || GorillaLocation.position.toArray();
    this.position.fromArray(position);

    const rotation = options.rotation || [
      GorillaLocation.rotation.x,
      GorillaLocation.rotation.y,
      GorillaLocation.rotation.z
    ];
    this.rotation.set(...rotation);

    const scale = options.scale ?? GorillaLocation.scale;
    this.scale.setScalar(scale);
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
