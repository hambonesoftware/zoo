// src/animals/ElephantCreature.js

import * as THREE from 'three';
import { ElephantDefinition } from './ElephantDefinition.js';
import { ElephantGenerator } from './ElephantGenerator.js';
import { RingsOverlay } from './debug/RingsOverlay.js';

export class ElephantCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    // 1. Build Bones
    const definition = options.definition || ElephantDefinition;
    this.bones = this._buildBonesFromDefinition(definition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    // 2. Helper to set initial World Matrices
    const rootBone =
      this.bones.find((b) => b.name === 'spine_base') || this.bones[0];
    this.rootBone = rootBone;
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

    if (this.behavior && typeof this.behavior.setInstrumentProgram === 'function') {
      this.behavior.setInstrumentProgram(options.instrumentProgram);
    }

    // Parent the skeleton under the skinned mesh so any creature-level
    // transforms (position/rotation/scale) apply equally to both the mesh and
    // the bones. This prevents the skeleton helper from drifting relative to
    // the visible geometry when the creature is moved in the scene.
    this.remove(this.rootBone);
    this.mesh.add(this.rootBone);

    this.add(mesh);

    // 4. Debug
    const debugShowSkeleton =
      options.debug === true ||
      (options.debug && typeof options.debug === 'object' && options.debug.showSkeleton === true);
    const showSkeleton = options.showSkeleton === true || debugShowSkeleton;
    if (showSkeleton) {
      this._ensureSkeletonHelper();
      this.skeletonHelper.visible = true;
    }
    this.ringsOverlay = new RingsOverlay(this.skeleton);
    this.add(this.ringsOverlay);
    if (options.debugRings) {
      this.ringsOverlay.updateConfig(options.debugRings);
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
    this.updateMatrixWorld(true);
    if (this.skeletonHelper && this.skeletonHelper.visible) {
      this.skeletonHelper.updateMatrixWorld(true);
    }
    if (this.ringsOverlay) {
      this.ringsOverlay.update();
    }
  }

  setSkeletonVisible(visible) {
    if (visible) {
      this._ensureSkeletonHelper();
      this.skeletonHelper.visible = true;
      this.skeletonHelper.updateMatrixWorld(true);
      return;
    }
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = false;
    }
  }

  _ensureSkeletonHelper() {
    if (this.skeletonHelper) return;
    if (!this.rootBone) return;
    // Use the actual root bone so the helper traverses the full skeleton
    // hierarchy, even though the skinned mesh is a sibling in the group.
    this.skeletonHelper = new THREE.SkeletonHelper(this.rootBone);
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
}
