// src/animals/CatPen.js

import * as THREE from 'three';
import { AnimalStudioPen } from '../../pens/AnimalStudioPen.js';
import { CatCreature } from './CatCreature.js';

/**
 * CatPen: Precision platform with labeled axes, colored triad, origin marker,
 * numbered grids, a bounding box, and a CatCreature, all inside a studio
 * with soft, kid-friendly lighting so the animal is always clearly visible.
 */
export class CatPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Cat';

    this.pen = new AnimalStudioPen(scene, {
      radius: options.radius || 2.0,
      padHeight: options.padHeight || 0.17,
      markerRadius: options.markerRadius || 0.13,
      markerHeight: options.markerHeight || 0.13,
      markerColor: options.markerColor || 0x227bc4,
      lineColor: options.lineColor || 0x166597,
      position: options.position || new THREE.Vector3(0, 0, 0),
      turntable: options.turntable,
      showBoundingBox: options.showBoundingBox
    });

    this.group = this.pen.group;

    const catScale = typeof options.scale === 'number' ? options.scale : 0.75;

    this.Cat = new CatCreature({
      scale: catScale,
      debug: !!options.debugCat,
      showSkeleton: options.showSkeleton
    });

    const catY = this.pen.padHeight + 1.5;
    this.Cat.position.set(0, catY, 0);

    const defaultYaw = Math.PI * 0.3;
    this.Cat.rotation.y =
      typeof options.rotationY === 'number' ? options.rotationY : defaultYaw;

    this.Cat.name = 'CatCreature';

    if (this.Cat.mesh) {
      this.Cat.mesh.castShadow = true;
      this.Cat.mesh.receiveShadow = true;
    }

    this.pen.mountAnimal(this.Cat);
  }

  /**
   * Returns the root Object3D for OBJ export.
   */
  getExportRoot() {
    return this.pen.getExportRoot();
  }

  /**
   * Animation frame update: update CatCreature and bounding box.
   */
  update(dt) {
    this.pen.update(dt);
  }
}
