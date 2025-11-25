import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';
import * as CANNON from 'cannon-es';

import * as THREE from 'three';
/**
 * Ball enrichment object.
 * Physics sphere and visible mesh.
 */
export class Ball {
  /**
   * @param {CANNON.World} world
   * @param {THREE.Scene} scene
   * @param {{x:number,y:number,z:number}} position
   * @param {number} radius
   */
  constructor(world, scene, position, radius = 0.5) {
    this.world = world;
    this.scene = scene;
    this.body = new CANNON.Body({
      mass: 0.7,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.18,
      angularDamping: 0.16
    });
    world.addBody(this.body);

    this.mesh = MeshBuilder.createSphere(radius, MaterialManager.get('rubber'));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
	console.log("[DEBUG] About to add to scene:", this.mesh, this.mesh instanceof THREE.Object3D, this.mesh?.type);
    scene.add(this.mesh);
  }

  /** Sync mesh to body */
  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  /** Remove from world/scene */
  remove() {
    if (this.scene) this.scene.remove(this.mesh);
    if (this.world) this.world.removeBody(this.body);
  }
}
