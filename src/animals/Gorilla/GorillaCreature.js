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
    // Prime the bone transforms before generating geometry so the skinned mesh
    // binds to the same coordinate space as the skeleton.
    rootBone.updateMatrixWorld(true);

    const { mesh, behavior } = GorillaGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior;

    // Keep the skeleton and mesh in the same transform hierarchy so scaling the
    // creature also scales the debug skeleton helper.
    this.mesh.add(rootBone);
    this.mesh.bind(this.skeleton);

    this.add(mesh);

    const debugShowSkeleton =
      options.debug === true ||
      (options.debug && typeof options.debug === 'object' && options.debug.showSkeleton === true);
    const showSkeleton = options.showSkeleton === true || debugShowSkeleton;
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
    if (this.skeletonHelper) this.skeletonHelper.updateMatrixWorld(true);
  }
}
