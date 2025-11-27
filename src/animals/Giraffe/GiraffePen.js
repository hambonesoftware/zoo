// src/animals/Giraffe/GiraffePen.js

import * as THREE from 'three';
import { GiraffeCreature } from './GiraffeCreature.js';
import { GiraffeLocation } from './GiraffeLocation.js';

export class GiraffePen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;

    this.radius = options.radius || 3.0;
    this.position = options.position || new THREE.Vector3(0, 0, 0);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const groundGeo = new THREE.CircleGeometry(this.radius, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c4, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const rimGeo = new THREE.RingGeometry(this.radius * 0.92, this.radius * 0.98, 48);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x7c6f64, side: THREE.DoubleSide });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.002;
    this.group.add(rim);

    const fillLight = new THREE.HemisphereLight(0xffffff, 0x888866, 0.5);
    fillLight.position.set(0, 6, 0);
    this.group.add(fillLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(3, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.camera.far = 30;
    this.group.add(keyLight);

    const giraffe = new GiraffeCreature({ scale: options.scale || 1.0 });
    giraffe.position.copy(GiraffeLocation.position);
    giraffe.rotation.copy(GiraffeLocation.rotation);
    giraffe.scale.multiplyScalar(GiraffeLocation.scale);

    this.group.add(giraffe);
    this.creature = giraffe;

    scene?.add(this.group);
  }

  update(dt) {
    if (this.creature && typeof this.creature.update === 'function') {
      this.creature.update(dt);
    }
  }
}
