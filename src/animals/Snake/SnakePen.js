// src/animals/Snake/SnakePen.js

import * as THREE from 'three';
import { AnimalStudioPen } from '../../pens/AnimalStudioPen.js';
import { SnakeCreature } from './SnakeCreature.js';

/**
 * SnakePen: studio-style pen that matches the Cat/Elephant environment while
 * mounting the segmented snake creature.
 */
export class SnakePen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Snake';

    this.pen = new AnimalStudioPen(scene, {
      radius: options.radius || 3.0,
      padHeight: options.padHeight || 0.2,
      markerRadius: options.markerRadius || 0.13,
      markerHeight: options.markerHeight || 0.13,
      markerColor: options.markerColor || 0x227bc4,
      lineColor: options.lineColor || 0x166597,
      position: options.position || new THREE.Vector3(0, 0, 0),
      turntable: options.turntable,
      showBoundingBox: options.showBoundingBox
    });

    this.group = this.pen.group;

    const snakeScale = typeof options.scale === 'number' ? options.scale : 1.0;

    this.Snake = new SnakeCreature({
      definitionOverride: options.definitionOverride,
      tuning: options.tuning
    });

    if (this.Snake.group) {
      this.Snake.group.scale.set(snakeScale, snakeScale, snakeScale);
    }

    const snakeLength = (this.Snake.definition.spineCount + 0.9) * this.Snake.definition.segmentLength;
    const yOffset = this.pen.padHeight + (this.Snake.definition.baseRadius || 0.1);

    this.Snake.group.position.set(0, yOffset, -snakeLength * 0.5);
    this.Snake.group.rotation.y =
      typeof options.rotationY === 'number' ? options.rotationY : Math.PI * 0.25;

    this.Snake.name = 'SnakeCreature';

    this.pen.mountAnimal(this.Snake);
  }

  getExportRoot() {
    return this.pen.getExportRoot();
  }

  update(dt) {
    this.pen.update(dt);
  }
}
