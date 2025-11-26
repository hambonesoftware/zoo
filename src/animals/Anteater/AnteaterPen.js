// src/animals/Anteater/AnteaterPen.js
// Minimal pen that mirrors other animals' staging areas with simple lighting.

import * as THREE from 'three';
import { AnteaterCreature } from './AnteaterCreature.js';

export class AnteaterPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.group = new THREE.Group();

    const radius = options.radius || 2.5;

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 28),
      new THREE.MeshStandardMaterial({ color: 0x5f574f, roughness: 0.9 })
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    const rim = new THREE.RingGeometry(radius * 0.98, radius, 32);
    const rimMesh = new THREE.Mesh(
      rim,
      new THREE.MeshBasicMaterial({ color: 0xd9cbb5, side: THREE.DoubleSide })
    );
    rimMesh.rotation.x = -Math.PI / 2;
    this.group.add(rimMesh);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(3, 5, 2);
    keyLight.castShadow = true;
    this.group.add(keyLight);

    const fillLight = new THREE.AmbientLight(0x666666, 0.8);
    this.group.add(fillLight);

    this.creature = new AnteaterCreature(options.creature || {});
    this.creature.position.y = 0.05;
    this.group.add(this.creature);

    if (scene) {
      scene.add(this.group);
    }
  }
}
