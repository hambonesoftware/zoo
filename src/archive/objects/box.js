import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';
import { createStripeTexture } from '../utils/graphics/createStripeTexture.js'; // <-- import
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class Box {
  constructor(world, scene, position, size = { x: 1, y: 1, z: 1 }, opts = {}) {
    this.world = world;
    this.scene = scene;
    this.size = size;

    this.body = new CANNON.Body({
      mass: 2.4,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.13,
      angularDamping: 0.19
    });
    const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
    this.body.addShape(new CANNON.Box(halfExtents));
    world.addBody(this.body);

    // --- Use striped texture ---
    let boxMat;
    if (opts.stripes) {
      const tex = createStripeTexture(256, 48);
      boxMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.34,
        metalness: 0.08,
      });
    } else {
      const matName = opts.material || 'wood';
      boxMat = MaterialManager.get(matName) || new THREE.MeshStandardMaterial({ color: 0x8c6640 });
    }

    this.mesh = MeshBuilder.createBox(size, boxMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update() {
    if (this.mesh && this.body) {
      this.mesh.position.copy(this.body.position);
      this.mesh.quaternion.copy(this.body.quaternion);
    }
  }

  remove() {
    if (this.scene && this.mesh) this.scene.remove(this.mesh);
    if (this.world && this.body) this.world.removeBody(this.body);
    this.mesh = null;
    this.body = null;
  }
}
