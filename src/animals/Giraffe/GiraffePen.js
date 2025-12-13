// src/animals/Giraffe/GiraffePen.js

import * as THREE from 'three';
import { AnimalStudioPen } from '../../pens/AnimalStudioPen.js';
import { GiraffeCreature } from './GiraffeCreature.js';

/**
 * GiraffePen: studio shell plus the giraffe creature, mirroring the Cat/Gorilla
 * pens so it appears in the same preview environment.
 */
export class GiraffePen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Giraffe';

    this.pen = new AnimalStudioPen(scene, {
      radius: options.radius || 2.2,
      padHeight: options.padHeight || 0.2,
      markerRadius: options.markerRadius || 0.14,
      markerHeight: options.markerHeight || 0.14,
      markerColor: options.markerColor || 0xd08c3a,
      lineColor: options.lineColor || 0x9c6a2c,
      position: options.position || new THREE.Vector3(0, 0, 0),
      turntable: options.turntable,
      showBoundingBox: options.showBoundingBox
    });

    this.group = this.pen.group;

    const giraffeScale = typeof options.scale === 'number' ? options.scale : 1.15;

    this.giraffe = new GiraffeCreature({
      scale: giraffeScale,
      debug: !!options.debug,
      showSkeleton: options.showSkeleton
    });

    const giraffeY = this.pen.padHeight + 1.6;
    this.giraffe.position.set(0, giraffeY, 0);

    const defaultYaw = Math.PI * 0.2;
    this.giraffe.rotation.y = typeof options.rotationY === 'number' ? options.rotationY : defaultYaw;
    this.giraffe.name = 'GiraffeCreature';

    if (this.giraffe.mesh) {
      this.giraffe.mesh.castShadow = true;
      this.giraffe.mesh.receiveShadow = true;
    }

    this.pen.mountAnimal(this.giraffe);
  }

  getExportRoot() {
    return this.pen.getExportRoot();
  }

  update(dt) {
    this.pen.update(dt);
  }
}
