// src/zoo/Zoo.js

import * as THREE from 'three';
import { animalsRegistry } from '../animals/registry.js';

/**
 * Zoo
 * ----
 * Manages pens and animals inside the Three.js scene. This version is
 * animal-agnostic: it looks up animal types in `animalsRegistry` instead of
 * hard-coding CatPen or any specific species.
 */
export class Zoo {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to populate.
   * @param {object} options - Configuration options.
   *   - penCount: number of pens to create (default 1).
   *   - spacing: distance between pens along X axis (default 10).
   *   - animalType: key in animalsRegistry to spawn (default 'cat').
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.pens = [];

    const penCount = options.penCount ?? 1;
    const spacing = options.spacing ?? 10;
    const animalType = options.animalType || 'cat';

    this.setAnimalType(animalType, { penCount, spacing });
  }

  /**
   * Change the active animal type in the zoo. Existing pens are removed from
   * the scene and new pens are created using the requested animal type.
   *
   * @param {string} animalType - key in animalsRegistry.
   * @param {object} params - optional overrides for penCount / spacing.
   */
  setAnimalType(animalType, { penCount, spacing } = {}) {
    const penCountFinal = penCount ?? this.options.penCount ?? 1;
    const spacingFinal = spacing ?? this.options.spacing ?? 10;

    // Remove any existing pens from the scene.
    for (const pen of this.pens) {
      if (typeof pen.dispose === 'function') {
        pen.dispose();
      } else if (pen.group instanceof THREE.Object3D) {
        this.scene.remove(pen.group);
      }
    }
    this.pens = [];

    const entry = animalsRegistry[animalType];
    if (!entry) {
      console.warn(`Zoo.setAnimalType: unknown animal type '${animalType}'`);
      return;
    }

    for (let i = 0; i < penCountFinal; i++) {
      const position = new THREE.Vector3(i * spacingFinal, 0, 0);
      const pen = entry.createPen(this.scene, { position });
      this.pens.push(pen);
    }

    this.currentAnimalType = animalType;
    this.options.penCount = penCountFinal;
    this.options.spacing = spacingFinal;
  }

  /**
   * Aggregate debug information from the first pen (studio view).
   */
  getDebugInfo() {
    const pen = this.pens && this.pens.length > 0 ? this.pens[0] : null;
    let penInfo = {};
    if (pen && typeof pen.getDebugInfo === 'function') {
      penInfo = pen.getDebugInfo() || {};
    }

    return {
      animalType: this.currentAnimalType,
      penCount: this.pens ? this.pens.length : 0,
      bounds: penInfo.bounds || null,
      behavior: penInfo.behavior || null
    };
  }

  /**
   * Updates all pens and their animals.
   * Call once per animation frame.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    for (const pen of this.pens) {
      if (typeof pen.update === 'function') {
        pen.update(dt);
      }
    }
  }
}
