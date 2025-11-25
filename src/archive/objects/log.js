// src/objects/log.js
import * as THREE from 'three';

import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';
import * as CANNON from 'cannon-es';
import { addCapsuleToBody } from '../utils/physics/rigHelpers.js';

/**
 * Log enrichment object.
 * Physics capsule (sideways) and visible mesh.
 */
export class Log {
  /**
   * @param {CANNON.World} world
   * @param {THREE.Scene} scene
   * @param {{x:number, y:number, z:number}} position
   * @param {number=} length
   * @param {number=} radius
   */
  constructor(world, scene, position, length = 2, radius = 0.13) {
    this.world = world;
    this.scene = scene;

    this.body = new CANNON.Body({
      mass: 4.2,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.18,
      angularDamping: 0.20
    });

    // Add capsule shape, aligned along X axis
    addCapsuleToBody(this.body, radius, length, 'x');

    world.addBody(this.body);

    // Visual mesh (must match orientation!)
    this.mesh = MeshBuilder.createCapsule(radius, length, MaterialManager.get('log'));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
	console.log("[DEBUG] About to add to scene:", this.mesh, this.mesh instanceof THREE.Object3D, this.mesh?.type);
    scene.add(this.mesh);
  }

  /** Sync mesh to body. Call every frame. */
  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  /** Remove from scene/world. */
  remove() {
    if (this.scene && this.mesh) this.scene.remove(this.mesh);
    if (this.world && this.body) this.world.removeBody(this.body);
  }
}
