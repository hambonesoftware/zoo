// src/animals/Snake/SnakePen_TEMPLATE.js
//
// TEMPLATE ONLY (not wired into Zoo automatically).
//
// Copy an existing pen (CatPen.js / ElephantPen.js) and replace its creature with Snake.
// This template shows the *minimum* responsibilities a pen usually has.
//
// If your Zoo has a Pen base class, adapt this accordingly.

import * as THREE from "three";
import { SnakeModule } from "./SnakeModule.js";

export class SnakePenTemplate {
  /**
   * @param {Object} opts
   * @param {THREE.Scene} opts.scene
   */
  constructor(opts) {
    this.scene = opts.scene;

    // Build creature
    this.snake = SnakeModule.build({
      // You can override definition/tuning here if desired.
      definitionOverride: {},
      tuning: {},
    });

    // Position it in the pen
    this.snake.group.position.set(0, 0.15, 0);
    this.scene.add(this.snake.group);

    // Example ground plane (optional)
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /**
   * Called per frame.
   * @param {number} dt seconds
   */
  update(dt) {
    if (this.snake) this.snake.update(dt);
  }

  dispose() {
    if (this.snake) this.snake.dispose();
  }
}
