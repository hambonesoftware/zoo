// src/animals/Giraffe/GiraffeCreature.js

import * as THREE from 'three';
import { GiraffeDefinition } from './GiraffeDefinition.js';
import { GiraffeGenerator } from './GiraffeGenerator.js';
import { GiraffeBehavior } from './GiraffeBehavior.js';

export class GiraffeCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    this._skeletonHelperMatrix = new THREE.Matrix4();

    const definition = options.definition || GiraffeDefinition;

    this.bones = this._buildBonesFromDefinition(definition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);

    const rootBone = this.bones.find((b) => b.name === 'spine_base') || this.bones[0];
    this.rootBone = rootBone;
    this.add(rootBone);
    this.updateMatrixWorld(true);

    const generatorOptions = { ...options };
    if (generatorOptions.lowPoly === undefined) {
      generatorOptions.lowPoly = true;
    }

    const { mesh } = GiraffeGenerator.generate(this.skeleton, generatorOptions);
    this.mesh = mesh;

    this.behavior = new GiraffeBehavior(this.skeleton, this.mesh, {
      idle: options.idle,
      debug: options.debug
    });

    this.remove(this.rootBone);
    this.mesh.add(this.rootBone);
    this.add(this.mesh);

    const debugShowSkeleton =
      options.debug === true ||
      (options.debug && typeof options.debug === 'object' && options.debug.showSkeleton === true);
    const showSkeleton = options.showSkeleton === true || debugShowSkeleton;
    if (showSkeleton) {
      this._ensureSkeletonHelper();
      this.skeletonHelper.visible = true;
    }

    if (options.position) {
      this.position.fromArray(options.position);
    }

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
      this._syncSkeletonHelperMatrix();
      this.skeletonHelper.updateMatrixWorld(true);
    }
  }

  setSkeletonVisible(visible) {
    if (visible) {
      this._ensureSkeletonHelper();
      this.skeletonHelper.visible = true;
      this._syncSkeletonHelperMatrix();
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
    this.skeletonHelper = new THREE.SkeletonHelper(this.rootBone);
    this.skeletonHelper.skeleton = this.skeleton;
    this.skeletonHelper.material.linewidth = 1;
    this.skeletonHelper.material.color.set(0x00ff66);
    this.skeletonHelper.material.transparent = true;
    this.skeletonHelper.material.opacity = 0.9;
    this.skeletonHelper.material.blending = THREE.AdditiveBlending;
    this.skeletonHelper.material.depthWrite = false;
    this.skeletonHelper.material.toneMapped = false;
    this.add(this.skeletonHelper);
    this._syncSkeletonHelperMatrix();
  }

  _syncSkeletonHelperMatrix() {
    if (!this.skeletonHelper || !this.rootBone) return;
    this._skeletonHelperMatrix.copy(this.matrixWorld).invert();
    this.skeletonHelper.matrix.copy(
      this._skeletonHelperMatrix.multiply(this.rootBone.matrixWorld)
    );
  }
}
