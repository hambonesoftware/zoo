// src/animals/Anteater/AnteaterCreature.js

import * as THREE from 'three';
import { AnteaterGenerator } from './AnteaterGenerator.js';
import { AnteaterLocation } from './AnteaterLocation.js';

export class AnteaterCreature extends THREE.Group {
  constructor(options = {}) {
    super();

    const { mesh, behavior } = AnteaterGenerator.generate(options);
    this.mesh = mesh;
    this.behavior = behavior;

    this.add(mesh);

    const position = options.position || AnteaterLocation.position.toArray();
    this.position.fromArray(position);

    const rotation = options.rotation || [
      AnteaterLocation.rotation.x,
      AnteaterLocation.rotation.y,
      AnteaterLocation.rotation.z
    ];
    this.rotation.set(...rotation);

    const scale = options.scale ?? AnteaterLocation.scale;
    this.scale.setScalar(scale);
  }

  update(deltaSeconds) {
    if (this.behavior) {
      this.behavior.update(deltaSeconds);
    }
  }
}
