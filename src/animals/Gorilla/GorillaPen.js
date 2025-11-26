// src/animals/Gorilla/GorillaPen.js

import * as THREE from 'three';
import { GorillaCreature } from './GorillaCreature.js';

/**
 * GorillaPen
 *
 * Lightweight studio setup that drops a GorillaCreature onto a pad with
 * simple lighting and a reference grid. Mirrors the structure of the Cat
 * and Elephant pens so it can slot into the registry without surprises.
 */
export class GorillaPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;

    this.radius = options.radius || 2.4;
    this.padHeight = options.padHeight || 0.2;
    this.position = options.position || new THREE.Vector3(0, 0, 0);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const grid = new THREE.GridHelper(this.radius * 2.2, 22, 0x333333, 0x777777);
    grid.position.set(0, 0.01, 0);
    grid.name = 'GridHelper';
    this.group.add(grid);

    const padGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.padHeight, 48);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x7a7a78, roughness: 0.7 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, this.padHeight / 2, 0);
    pad.receiveShadow = true;
    pad.name = 'Pad';
    this.group.add(pad);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    ambient.name = 'Ambient';
    this.group.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(2, 4, 2);
    keyLight.castShadow = true;
    keyLight.name = 'KeyLight';
    this.group.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-3, 3, -1);
    fillLight.name = 'FillLight';
    this.group.add(fillLight);

    this.creature = new GorillaCreature({ scale: options.scale || 1, debug: options.debug });
    this.creature.position.set(0, this.padHeight, 0);
    this.group.add(this.creature);

    this.scene.add(this.group);
  }

  update(delta) {
    if (this.creature && this.creature.update) {
      this.creature.update(delta);
    }
  }
}
