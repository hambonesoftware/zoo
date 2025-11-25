// src/pens/PenManager.js

import { QuadrupedPen }   from './quadrupedPen.js';
//import { BipedPen }       from './bipedPen.js';
//import { MultiarmedPen }  from './multiarmedPen.js';
//import { NoleggedPen }    from './noleggedPen.js';
//import { TentacledPen }   from './tentacledPen.js';
//import * as THREE from 'three';
/**
 * PenManager
 * ----------
 * Manages all animal pens in the zoo scene.
 * Handles pen creation, updating, removal, and lookup.
 */
export class PenManager {
  /**
   * @param {CANNON.World} world      - Cannon-es physics world.
   * @param {THREE.Scene} scene       - THREE.js scene.
   * @param {AnimationSystem} animationSystem - Animation system to coordinate creature animation.
   */
  constructor(world, scene, animationSystem) {
    this.world = world;
    this.scene = scene;
    this.animationSystem = animationSystem;

    /** @type {Map<string, object>} */
    this.pens = new Map();

    /**
     * Registry of pen types.
     * Add new pen types here!
     */
    this.penTypes = {
      quadruped:  { class: QuadrupedPen,   offset: { x:   0, y:0, z:   0 } } };

    this.penCount = 0;
    console.info('[PenManager] Initialized.');
  }

  /**
   * Create a new pen of a specified type.
   * @param {string} type - The pen type (quadruped, biped, etc).
   * @param {object=} positionOverride - Optional: override default offset.
   * @returns {object|null} Returns the created pen, or null if type is invalid.
   */
  createPen(type, positionOverride = null) {
    const config = this.penTypes[type];
    if (!config || typeof config.class !== 'function') {
      console.error(`[PenManager] Invalid pen type: ${type}`);
      return null;
    }
    // Defensive: ensure offset is an object
    const offset = positionOverride || { ...config.offset };
    const safeOffset = { x: offset.x, y: offset.y, z: offset.z };

    let penInstance;
    try {
      penInstance = new config.class(
        this.world,
        this.scene,
        this.animationSystem,
        safeOffset
      );
    } catch (err) {
      console.error(`[PenManager] Failed to instantiate ${type} pen:`, err);
      return null;
    }

    penInstance.id = `${type}_${this.penCount++}`;
    this.pens.set(penInstance.id, penInstance);

    console.info(`[PenManager] Created pen: ${penInstance.id} at (${safeOffset.x}, ${safeOffset.y}, ${safeOffset.z})`);
    return penInstance;
  }

  /**
   * Remove a pen by ID (removes all objects from scene and world).
   * @param {string} penId
   * @returns {boolean} True if removed, false if not found.
   */
  removePen(penId) {
    const pen = this.pens.get(penId);
    if (!pen) {
      console.warn(`[PenManager] Attempted to remove non-existent pen: ${penId}`);
      return false;
    }
    if (typeof pen.remove === 'function') {
      pen.remove();
    } else if (Array.isArray(pen.objects)) {
      pen.objects.forEach(obj => {
        // Remove mesh from scene
        if (obj.mesh && this.scene && typeof this.scene.remove === 'function') {
          this.scene.remove(obj.mesh);
        }
        // Remove physics body/bodies
        if (obj.body && this.world && typeof this.world.removeBody === 'function') {
          this.world.removeBody(obj.body);
        }
        if (obj.bodies) {
          const bodiesArray = Array.isArray(obj.bodies) ? obj.bodies : Object.values(obj.bodies);
          for (const body of bodiesArray) {
            try { this.world.removeBody(body); } catch {}
          }
        }
        // Custom cleanup
        if (typeof obj.remove === 'function' && obj !== pen) {
          obj.remove();
        }
      });
    }
    this.pens.delete(penId);
    console.info(`[PenManager] Removed pen: ${penId}`);
    return true;
  }

  /**
   * Update all pens (call each pen's update with delta time).
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    for (const pen of this.pens.values()) {
      if (typeof pen.update === 'function') {
        pen.update(dt);
      }
    }
  }

  /**
   * Retrieve a pen by ID.
   * @param {string} penId
   * @returns {object|null}
   */
  getPen(penId) {
    return this.pens.get(penId) || null;
  }

  /**
   * Get all pen IDs.
   * @returns {Array<string>}
   */
  getPenIds() {
    return Array.from(this.pens.keys());
  }

  /**
   * Remove all pens from the scene/world.
   */
  clear() {
    for (const penId of this.getPenIds()) {
      this.removePen(penId);
    }
    console.info('[PenManager] All pens cleared.');
  }
}
