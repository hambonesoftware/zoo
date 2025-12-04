// src/animals/ElephantCreature.js

import * as THREE from 'three';
import { ElephantDefinition } from './ElephantDefinition.js';
import { ElephantGenerator } from './ElephantGenerator.js';

export class ElephantCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    // 1. Build Bones
    this.bones = this._buildBonesFromDefinition(ElephantDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    // 2. Helper to set initial World Matrices
    const rootBone =
      this.bones.find((b) => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    this.updateMatrixWorld(true);

    // 3. Generate Mesh via ElephantGenerator
    //    We keep creature-level options (scale, debug, position) separate
    //    from generator options that affect the procedural mesh itself.
    const generatorOptions = { ...options };
    if (generatorOptions.lowPoly === undefined) {
      // Default to low-poly faceted style unless the caller explicitly
      // disables it. This flag is consumed by ElephantGenerator and the
      // skin material node.
      generatorOptions.lowPoly = true;
    }

    const { mesh, behavior } = ElephantGenerator.generate(
      this.skeleton,
      {
        debugVolumes: true,
        ...generatorOptions
      }
    );
    this.mesh = mesh;
    this.behavior = behavior; // Behaviour drives idle motions, etc.

    this.add(mesh);

    // 4. Debug
    const debugShowSkeleton =
      options.debug === true ||
      (options.debug && typeof options.debug === 'object' && options.debug.showSkeleton === true);
    const showSkeleton = options.showSkeleton === true || debugShowSkeleton;
    if (showSkeleton) {
      // Use the actual root bone so the helper traverses the full skeleton
      // hierarchy, even though the skinned mesh is a sibling in the group.
      this.skeletonHelper = new THREE.SkeletonHelper(rootBone);
      this.skeletonHelper.skeleton = this.skeleton;
      this.skeletonHelper.material.linewidth = 1;
      this.skeletonHelper.material.color.set(0x00ff66); // Thin neon green lines
      this.skeletonHelper.material.transparent = true;
      this.skeletonHelper.material.opacity = 0.9;
      this.skeletonHelper.material.blending = THREE.AdditiveBlending;
      this.skeletonHelper.material.depthWrite = false;
      this.skeletonHelper.material.toneMapped = false;
      this.add(this.skeletonHelper);
    }

    // 5. Transform (creature-level transform, not baked into mesh)
    if (options.position) {
      this.position.fromArray(options.position);
    }

    // Default scale 1.0, but elephants are big, so this 1.0 represents
    // a large unit size. Caller can override with options.scale.
    if (options.scale) {
      this.scale.setScalar(options.scale);
    }
  }

  _buildBonesFromDefinition(boneDefs) {
    const boneMap = {};

    for (const def of boneDefs) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.fromArray(def.position);
      if (def.rotation) {
        bone.rotation.fromArray(def.rotation);
      }
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
    if (this.behavior) {
      this.behavior.update(delta);
    }
    if (this.skeletonHelper) {
      this.skeletonHelper.updateMatrixWorld(true);
    }
  }
}
