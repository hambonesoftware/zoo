// src/creatures/BaseCreature.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Base class for all physical/visual creatures.
 * Handles storage and sync of body parts, meshes, and constraints.
 */
export class BaseCreature {
  /**
   * @param {CANNON.World} world
   * @param {THREE.Scene} scene
   * @param {{x: number, y: number, z: number}} position
   */
  constructor(world, scene, position) {
    this.world = world;
    this.scene = scene;
    this.position = position;

    /** @type {CANNON.Body[]} */
    this.bodyParts = [];
    /** @type {THREE.Mesh[]} */
    this.meshParts = [];
    /** @type {CANNON.Constraint[]} */
    this.constraints = [];

    // Animation sync
    this._isAlive = true;
    this._autoSync = true;
    this._sync = this._sync.bind(this);

    // Start mesh sync unless paused
    if (this._autoSync) this._sync();
  }

  /**
   * Add a physics body part and register it.
   * @param {CANNON.Body} body
   */
  addBodyPart(body) {
    this.bodyParts.push(body);
    if (this.world) this.world.addBody(body);
  }

  /**
   * Add a mesh part and register it.
   * @param {THREE.Mesh} mesh
   */
  addMeshPart(mesh) {
    this.meshParts.push(mesh);
    if (this.scene) this.scene.add(mesh);
  }

  /**
   * Add a constraint between two body parts.
   * @param {CANNON.Constraint} constraint
   */
  addConstraint(constraint) {
    this.constraints.push(constraint);
    if (this.world) this.world.addConstraint(constraint);
  }

  /**
   * Sync all mesh parts to their respective physics bodies.
   */
  syncMeshes() {
    for (let i = 0; i < this.bodyParts.length; ++i) {
      const body = this.bodyParts[i];
      const mesh = this.meshParts[i];
      if (body && mesh) {
       
