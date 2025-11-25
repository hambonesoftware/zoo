// src/pens/bipedPen.js

import { Humanoid } from '../../animals/archive/humanoid.js';
import { Ball, Box, Food, Log, PenWall } from '../objects/index.js';

/**
 * Represents a "biped" animal pen, currently home to a Humanoid and enrichment objects.
 * Handles its own contained objects' update logic.
 */
export class BipedPen {
  /**
   * @param {CANNON.World} world      - Cannon-es physics world
   * @param {THREE.Scene} scene       - Three.js scene
   * @param {AnimationSystem} animationSystem - Animation system for the creatures
   * @param {{x:number, y:number, z:number}} offset - World position for the pen center
   */
  constructor(world, scene, animationSystem, offset) {
    this.world = world;
    this.scene = scene;
    this.animationSystem = animationSystem;
    this.offset = { x: offset.x, y: offset.y, z: offset.z };

    /**
     * All objects managed by this pen. Must support .update(dt) (optional: .remove())
     * @type {Array<object>}
     */
    this.objects = [];

    // --- PenWall fence ---
    // Size: tune width and depth for animal and enrichment objects
    this.penWall = new PenWall(scene, world, {
      position: offset,         // Center of pen
      width: 5.0,               // Inner width (meters)
      depth: 5.0,               // Inner depth (meters)
      barSpacing: 0.33,         // Space between bars (meters)
      barHeight: 1.2,           // Height of bars above base (meters)
      baseHeight: 0.28          // Height of cement block base (meters)
    });
    this.objects.push(this.penWall);

    // --- Creature (Humanoid) ---
    this.humanoid = new Humanoid(world, scene, offset, animationSystem);
    this.objects.push(this.humanoid);

    // --- Enrichment Objects ---
    // Place all items within the pen and not colliding with the wall
    this.objects.push(
      new Ball(
        world,
        scene,
        { x: offset.x + 1.6, y: offset.y, z: offset.z },
        0.5 // radius
      ),
      new Box(
        world,
        scene,
        { x: offset.x - 1.6, y: offset.y, z: offset.z },
        { x: 1, y: 1, z: 1 } // size
      ),
      new Food(
        world,
        scene,
        { x: offset.x, y: offset.y, z: offset.z + 1.6 }
      ),
      new Log(
        world,
        scene,
        { x: offset.x, y: offset.y, z: offset.z - 1.6 },
        2 // length
      )
    );

    // Add an ID if set by PenManager (do not set here)
    this.id = null;

    // Log creation
    console.info(
      `[BipedPen] Created at (${offset.x}, ${offset.y}, ${offset.z}) with Humanoid, PenWall, and 4 enrichment objects.`
    );
  }

  /**
   * Update all objects (called every frame).
   * @param {number} dt - Delta time (seconds)
   */
  update(dt) {
    for (const obj of this.objects) {
      if (typeof obj.update === 'function') obj.update(dt);
    }
  }

  /**
   * Optional: Remove all objects in this pen from the scene and world.
   * PenManager will call this if defined.
   */
  remove() {
    for (const obj of this.objects) {
      // Remove mesh from scene if present
      if (obj.mesh && this.scene && typeof this.scene.remove === 'function') {
        this.scene.remove(obj.mesh);
      }
      // Remove body from physics world if present
      if (obj.body && this.world && typeof this.world.removeBody === 'function') {
        this.world.removeBody(obj.body);
      }
      // Custom cleanup hook
      if (typeof obj.remove === 'function' && obj !== this) {
        obj.remove();
      }
    }
    console.info(`[BipedPen] Removed all objects from pen ${this.id ?? ''}`);
  }
}
