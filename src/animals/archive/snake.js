// src/creatures/snake.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCreature } from './BaseCreature.js';
import { StateMachine } from '../utils/stateMachine.js';
import { addConeTwist, addCapsuleToBody } from '../utils/physics/rigHelpers.js';
import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';

/**
 * Snake creature class.
 * Multi-segmented, physics-driven, with procedural slithering animation.
 */
export class Snake extends BaseCreature {
  /**
   * @param {CANNON.World} world - Cannon-es physics world
   * @param {THREE.Scene} scene  - Three.js scene
   * @param {{x:number, y:number, z:number}} position - World position of snake
   * @param {AnimationSystem=} animationSystem - Animation system (optional)
   */
  constructor(world, scene, position, animationSystem = null) {
    super(world, scene, position, animationSystem);

    // Build state machine (idle, slithering, running)
    this.states = new StateMachine(
      {
        idle:      { enter: this.onIdleEnter.bind(this),      update: this.updateIdle.bind(this) },
        slithering:{ enter: this.onSlitherEnter.bind(this),   update: this.updateSlither.bind(this) },
        running:   { enter: this.onRunEnter.bind(this),       update: this.updateRun.bind(this) }
      },
      'idle'
    );

    // Set up multi-segmented skeleton
    this.setupSkeleton();

    // Set up mesh, one per body segment
    this.setupMesh();

    // AnimationSystem hook (if keyframed blends needed)
    if (this.animationSystem && typeof this.animationSystem.add === 'function') {
      this.animationSystem.add(this.mesh, []);
    }

    // Internal: per-segment phase for procedural animation
    this._segmentPhases = new Array(this._segmentCount).fill(0);

    // Initial sync
    this.update(0);
  }

  /**
   * Set up the snake's physics skeleton: multi-segmented capsule bodies connected with cone twist constraints.
   */
  setupSkeleton() {
    // --- CONFIG ---
    this._segmentCount = 9;
    const segLength = 0.34;
    const segRadius = 0.10;
    const segMass = 0.9;
    const startX = this.position.x;
    const startY = this.position.y + 0.28;
    const startZ = this.position.z;

    // --- SEGMENTS ---
    this._segments = [];
    let lastBody = null;
    for (let i = 0; i < this._segmentCount; ++i) {
      // Body segment (capsule aligned X-axis)
      const body = new CANNON.Body({ mass: segMass });
      addCapsuleToBody(body, segRadius, segLength, 'x');
      body.position.set(startX - i * segLength * 0.92, startY, startZ);
      body.linearDamping = 0.18;
      body.angularDamping = 0.19;
      this.bodies.push(body);
      this._segments.push(body);

      // Connect with cone twist (joint) if not first segment
      if (lastBody) {
        const ctw = addConeTwist(
          lastBody, body,
          {
            pivotA: new CANNON.Vec3(-segLength / 2, 0, 0),
            pivotB: new CANNON.Vec3(segLength / 2, 0, 0),
            axisA:  new CANNON.Vec3(-1, 0, 0),
            axisB:  new CANNON.Vec3(1, 0, 0),
            angle: Math.PI / 4,
            twistAngle: Math.PI / 8
          }
        );
        this.constraints.push(ctw);
      }
      lastBody = body;
    }

    // --- HEAD (sphere) ---
    const headRadius = 0.14;
    const headMass = 1.3;
    const head = new CANNON.Body({ mass: headMass });
    head.addShape(new CANNON.Sphere(headRadius));
    head.position.set(
      this._segments[0].position.x + segLength * 0.58,
      this._segments[0].position.y,
      this._segments[0].position.z
    );
    head.linearDamping = 0.15;
    head.angularDamping = 0.14;
    this.bodies.push(head);
    this._head = head;

    // --- HEAD/NECK CONSTRAINT ---
    const neck = addConeTwist(
      head, this._segments[0],
      {
        pivotA: new CANNON.Vec3(-headRadius * 0.82, 0, 0),
        pivotB: new CANNON.Vec3(segLength / 2, 0, 0),
        axisA:  new CANNON.Vec3(-1, 0, 0),
        axisB:  new CANNON.Vec3(1, 0, 0),
        angle: Math.PI / 5,
        twistAngle: Math.PI / 10
      }
    );
    this.constraints.push(neck);
  }

  /**
   * Set up the snake's visual mesh: a capsule mesh for each segment and a sphere for the head.
   */
  setupMesh() {
    this.mesh.clear();
    const bodyMat = MaterialManager.get('snakeScales');

    // Body segments
    for (let i = 0; i < this._segmentCount; ++i) {
      const segmentMesh = MeshBuilder.createCapsule(0.10, 0.34, bodyMat, 8);
      segmentMesh.castShadow = true;
      segmentMesh.receiveShadow = true;
      this.mesh.add(segmentMesh);
    }

    // Head mesh
    const headMat = MaterialManager.get('snakeScales');
    const headMesh = MeshBuilder.createSphere(0.14, headMat, 18);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.mesh.add(headMesh);

    // (Optionally: Add eyes/tongue as small meshes here)
  }

  /**
   * Per-frame update: syncs mesh with physics, then runs procedural animation and state logic.
   * @param {number} dt - Delta time (seconds)
   */
  update(dt) {
    // Sync mesh to physics
    for (let i = 0; i < this._segmentCount; ++i) {
      const segBody = this._segments[i];
      const meshPart = this.mesh.children[i];
      if (segBody && meshPart) {
        meshPart.position.copy(segBody.position);
        meshPart.quaternion.copy(segBody.quaternion);
      }
    }
    // Head
    const headMesh = this.mesh.children[this._segmentCount];
    if (this._head && headMesh) {
      headMesh.position.copy(this._head.position);
      headMesh.quaternion.copy(this._head.quaternion);
    }

    // Animate body
    this.animateBody(dt);

    // State machine: idle/slithering/running
    if (this.states) this.states.update(dt);
  }

  /**
   * Procedural body animation for idle breathing, slithering, running.
   */
  animateBody(dt) {
    // Parameters for animation
    const idleFreq = 0.8, idleMag = 0.04;
    const slitherFreq = 2.9, slitherMag = 0.18;
    const runFreq = 5.4, runMag = 0.32;
    let freq = idleFreq, mag = idleMag, speed = 0;
    switch (this.states.current) {
      case 'slithering':
        freq = slitherFreq;
        mag = slitherMag;
        speed = 0.9;
        break;
      case 'running':
        freq = runFreq;
        mag = runMag;
        speed = 1.6;
        break;
      case 'idle':
      default:
        freq = idleFreq;
        mag = idleMag;
        speed = 0.05;
        break;
    }

    // Animate the segments as a sinusoidal wave along the Y/Z axes
    for (let i = 0; i < this._segmentCount; ++i) {
      this._segmentPhases[i] += dt * freq;
      // Optionally: Use Perlin noise or small random offsets for realism
      const phase = this._segmentPhases[i] + i * 0.41;
      const sway = Math.sin(phase) * mag * (1 - i / this._segmentCount);

      // Apply a small force/torque to the segment for wiggling
      const segBody = this._segments[i];
      if (segBody) {
        // Sway in Z and a little up/down
        segBody.applyForce(
          new CANNON.Vec3(0, Math.sin(phase) * mag * 2, sway * 1.1),
          segBody.position
        );
        // Advance snake forward a bit (move head/segments)
        if (speed > 0 && i === 0) {
          segBody.applyForce(
            new CANNON.Vec3(speed * 1.25, 0, 0), // X direction
            segBody.position
          );
        }
      }
    }
    // Optionally: You can orient the head based on first segment for realism
  }

  // --- State machine logic ---

  onIdleEnter()    { /* Could slow/stop wave, do subtle breathing */ }
  updateIdle(dt)   { /* Low-magnitude wiggle, no movement */ }

  onSlitherEnter() { /* Could trigger sound or start particle trail */ }
  updateSlither(dt){ /* Advance wave and add slow forward force */ }

  onRunEnter()     { /* Could play fast sound, dash particle */ }
  updateRun(dt)    { /* Faster wave, greater amplitude, faster forward */ }

  /**
   * Cleanup all physics and mesh resources. Called by Pen or scene manager.
   */
  remove() {
    super.remove();
    if (this.animationSystem && typeof this.animationSystem.remove === 'function') {
      this.animationSystem.remove(this.mesh);
    }
    this.states = null;
    this._segments = null;
    this._segmentPhases = null;
    this._head = null;
  }
}
