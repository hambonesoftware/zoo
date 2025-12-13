// src/animals/Snake/SnakeGeometry.js

import * as THREE from "three";

/**
 * A segmented "tube" mesh that follows a bone chain without skinning:
 * - For each adjacent pair of spine bones, we create a low-poly cylinder segment.
 * - Each frame we orient/position each segment between the current bone positions.
 *
 * This is intentionally simple and robust. You can later swap this for a true
 * skinned mesh or a dynamic tube surface if needed.
 */
export class SnakeSegmentedMesh {
  /**
   * @param {THREE.Object3D} rootObject  - root object to treat as "local space" for updates
   * @param {THREE.Bone[]} spineBones
   * @param {THREE.Bone} headBone
   * @param {THREE.Bone[]} tongueBones
   * @param {Object} params
   */
  constructor(rootObject, spineBones, headBone, tongueBones, params) {
    this.rootObject = rootObject;
    this.spineBones = spineBones;
    this.headBone = headBone;
    this.tongueBones = tongueBones;

    this.radialSegments = params.radialSegments ?? 8;

    this.group = new THREE.Group();
    this.group.name = "SnakeSegmentedMesh";

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpMid = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpUp = new THREE.Vector3(0, 1, 0);

    this._makeMaterials(params);
    this._buildBodySegments(params);
    this._buildHead(params);
    this._buildTongue(params);

    this.group.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  _makeMaterials(params) {
    const roughness = params.materialRoughness ?? 0.85;
    const metalness = params.materialMetalness ?? 0.0;

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: params.bodyColor ?? 0x3a6b3a,
      roughness,
      metalness,
      flatShading: true,
    });

    this.bellyMat = new THREE.MeshStandardMaterial({
      color: params.bellyColor ?? 0x9fc39f,
      roughness,
      metalness,
      flatShading: true,
    });

    this.tongueMat = new THREE.MeshStandardMaterial({
      color: params.tongueColor ?? 0xc13a6a,
      roughness: 0.65,
      metalness: 0.0,
      flatShading: true,
    });
  }

  _buildBodySegments(params) {
    // Unit cylinder along Y with radius=1 height=1; we'll scale to fit.
    const geom = new THREE.CylinderGeometry(1, 1, 1, this.radialSegments, 1, true);
    // Rotate so the cylinder "height axis" aligns with +Z (Zoo-ish forward).
    geom.rotateX(Math.PI / 2);

    const count = Math.max(1, this.spineBones.length);
    this.bodySegments = [];

    for (let i = 0; i < count - 1; i++) {
      // Alternate material a bit to suggest belly vs back (cheap).
      const mat = (i % 2 === 0) ? this.bodyMat : this.bellyMat;

      const seg = new THREE.Mesh(geom, mat);
      seg.name = `snake_body_seg_${i}`;
      seg.castShadow = true;
      seg.receiveShadow = true;

      this.group.add(seg);
      this.bodySegments.push(seg);
    }

    // Cache shaping params
    this.baseRadius = params.baseRadius ?? 0.11;
    this.taperToRadius = params.taperToRadius ?? 0.045;
  }

  _buildHead(params) {
    const headRadius = params.headRadius ?? 0.14;
    const geom = new THREE.IcosahedronGeometry(1, 1); // low-poly-ish
    const mesh = new THREE.Mesh(geom, this.bodyMat);
    mesh.name = "snake_head";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(headRadius, headRadius * 0.85, headRadius * 1.1);

    this.headMesh = mesh;
    this.group.add(mesh);
  }

  _buildTongue(params) {
    // Tongue is a chain of thin cylinders plus a fork at the end.
    const geom = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    geom.rotateX(Math.PI / 2);

    this.tongueSegments = [];
    const tCount = Math.max(1, this.tongueBones.length);

    for (let i = 0; i < tCount - 1; i++) {
      const seg = new THREE.Mesh(geom, this.tongueMat);
      seg.name = `snake_tongue_seg_${i}`;
      seg.castShadow = false;
      seg.receiveShadow = false;
      this.group.add(seg);
      this.tongueSegments.push(seg);
    }

    // Fork tips
    const tipGeom = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    tipGeom.rotateX(Math.PI / 2);

    this.tongueTipL = new THREE.Mesh(tipGeom, this.tongueMat);
    this.tongueTipR = new THREE.Mesh(tipGeom, this.tongueMat);
    this.tongueTipL.name = "snake_tongue_tip_L";
    this.tongueTipR.name = "snake_tongue_tip_R";

    this.group.add(this.tongueTipL);
    this.group.add(this.tongueTipR);

    this.tongueLength = params.tongueLength ?? 0.22;
    this.tongueForkLength = params.tongueForkLength ?? 0.075;
    this.tongueForkSpread = params.tongueForkSpread ?? 0.06;
  }

  /**
   * Update segment transforms to match bone positions.
   * Call this after any bone animation each frame.
   */
  updateFromBones(params) {
    if (params) {
      // Allow live updates for radii/length-like params.
      if (typeof params.baseRadius === "number") this.baseRadius = params.baseRadius;
      if (typeof params.taperToRadius === "number") this.taperToRadius = params.taperToRadius;

      if (typeof params.tongueLength === "number") this.tongueLength = params.tongueLength;
      if (typeof params.tongueForkLength === "number") this.tongueForkLength = params.tongueForkLength;
      if (typeof params.tongueForkSpread === "number") this.tongueForkSpread = params.tongueForkSpread;
    }

    // Ensure matrices are fresh for worldToLocal calls.
    this.rootObject.updateMatrixWorld(true);

    // Body segments
    const bodyCount = this.bodySegments.length;
    for (let i = 0; i < bodyCount; i++) {
      const boneA = this.spineBones[i];
      const boneB = this.spineBones[i + 1];

      boneA.getWorldPosition(this._tmpA);
      boneB.getWorldPosition(this._tmpB);

      // Convert to root-local space so meshes follow the root group.
      this.rootObject.worldToLocal(this._tmpA);
      this.rootObject.worldToLocal(this._tmpB);

      this._tmpMid.copy(this._tmpA).add(this._tmpB).multiplyScalar(0.5);
      this._tmpDir.copy(this._tmpB).sub(this._tmpA);

      const len = Math.max(1e-6, this._tmpDir.length());
      const dirN = this._tmpDir.multiplyScalar(1 / len);

      // Rotate from +Z axis (since we rotated cylinder to align along +Z).
      this._tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirN);

      // Radius taper along body
      const t = i / Math.max(1, bodyCount - 1);
      const radius = THREE.MathUtils.lerp(this.baseRadius, this.taperToRadius, t);

      const seg = this.bodySegments[i];
      seg.position.copy(this._tmpMid);
      seg.quaternion.copy(this._tmpQuat);
      seg.scale.set(radius, radius, len); // since cylinder axis is +Z now, scale Z = length
    }

    // Head
    this.headBone.getWorldPosition(this._tmpA);
    this.rootObject.worldToLocal(this._tmpA);

    this.headMesh.position.copy(this._tmpA);

    // Orient head roughly along last spine direction
    if (this.spineBones.length >= 2) {
      const lastA = this.spineBones[this.spineBones.length - 2];
      const lastB = this.spineBones[this.spineBones.length - 1];

      lastA.getWorldPosition(this._tmpA);
      lastB.getWorldPosition(this._tmpB);
      this.rootObject.worldToLocal(this._tmpA);
      this.rootObject.worldToLocal(this._tmpB);

      this._tmpDir.copy(this._tmpB).sub(this._tmpA);
      const headLen = Math.max(1e-6, this._tmpDir.length());
      const headDirN = this._tmpDir.multiplyScalar(1 / headLen);
      this._tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), headDirN);
      this.headMesh.quaternion.copy(this._tmpQuat);
    }

    // Tongue segments
    const tCount = this.tongueSegments.length;
    for (let i = 0; i < tCount; i++) {
      const boneA = this.tongueBones[i];
      const boneB = this.tongueBones[i + 1];

      boneA.getWorldPosition(this._tmpA);
      boneB.getWorldPosition(this._tmpB);
      this.rootObject.worldToLocal(this._tmpA);
      this.rootObject.worldToLocal(this._tmpB);

      this._tmpMid.copy(this._tmpA).add(this._tmpB).multiplyScalar(0.5);
      this._tmpDir.copy(this._tmpB).sub(this._tmpA);

      const len = Math.max(1e-6, this._tmpDir.length());
      const dirN = this._tmpDir.multiplyScalar(1 / len);
      this._tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirN);

      const seg = this.tongueSegments[i];
      seg.position.copy(this._tmpMid);
      seg.quaternion.copy(this._tmpQuat);

      const radius = Math.max(0.004, this.baseRadius * 0.10);
      seg.scale.set(radius, radius, len);
    }

    // Tongue fork tips (from last tongue bone forward)
    const tongueEnd = this.tongueBones[this.tongueBones.length - 1];

    tongueEnd.getWorldPosition(this._tmpA);
    this.rootObject.worldToLocal(this._tmpA);

    // Choose a forward direction based on head orientation.
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.headMesh.quaternion);
    forward.normalize();

    const baseTipPos = this._tmpA.clone().add(forward.clone().multiplyScalar(this.tongueForkLength * 0.5));

    const leftOffset = new THREE.Vector3(this.tongueForkSpread * 0.5, 0, 0).applyQuaternion(this.headMesh.quaternion);
    const rightOffset = new THREE.Vector3(-this.tongueForkSpread * 0.5, 0, 0).applyQuaternion(this.headMesh.quaternion);

    const tipLPos = baseTipPos.clone().add(leftOffset);
    const tipRPos = baseTipPos.clone().add(rightOffset);

    const tipLen = this.tongueForkLength;
    const tipRadius = Math.max(0.0035, this.baseRadius * 0.085);

    // Place tips (simple: keep oriented with head forward)
    const tipQuat = this.headMesh.quaternion.clone();

    this.tongueTipL.position.copy(tipLPos);
    this.tongueTipR.position.copy(tipRPos);
    this.tongueTipL.quaternion.copy(tipQuat);
    this.tongueTipR.quaternion.copy(tipQuat);
    this.tongueTipL.scale.set(tipRadius, tipRadius, tipLen);
    this.tongueTipR.scale.set(tipRadius, tipRadius, tipLen);
  }

  dispose() {
    // Geometries are shared; but we can dispose materials safely.
    if (this.bodyMat) this.bodyMat.dispose();
    if (this.bellyMat) this.bellyMat.dispose();
    if (this.tongueMat) this.tongueMat.dispose();
  }
}
