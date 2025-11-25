// src/creatures/spider.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCreature } from './BaseCreature.js';
import { StateMachine } from '../utils/stateMachine.js';
import { addHinge, addConeTwist, addCapsuleToBody } from '../utils/physics/rigHelpers.js';
import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';

/**
 * Spider creature class.
 * Physics-driven multi-legged creature with full skeleton, mesh, state machine, and procedural animation.
 */
export class Spider extends BaseCreature {
  /**
   * @param {CANNON.World} world - Cannon-es physics world
   * @param {THREE.Scene} scene  - Three.js scene
   * @param {{x:number, y:number, z:number}} position - World position of spider
   * @param {AnimationSystem=} animationSystem - Animation system (optional)
   */
  constructor(world, scene, position, animationSystem = null) {
    super(world, scene, position, animationSystem);

    // Build state machine (idle, walking, running)
    this.states = new StateMachine(
      {
        idle:    { enter: this.onIdleEnter.bind(this),    update: this.updateIdle.bind(this) },
        walking: { enter: this.onWalkEnter.bind(this),    update: this.updateWalk.bind(this) },
        running: { enter: this.onRunEnter.bind(this),     update: this.updateRun.bind(this) }
      },
      'idle'
    );

    // Set up skeleton (bodies and constraints)
    this.setupSkeleton();

    // Set up mesh (attach mesh parts to bodies)
    this.setupMesh();

    // Register with AnimationSystem (if provided)
    if (this.animationSystem && typeof this.animationSystem.add === 'function') {
      // Pass mesh and [] (clip array) if you provide keyframed animations
      this.animationSystem.add(this.mesh, []);
    }

    // Internal for gait animation
    this._legAnimPhase = new Array(8).fill(0); // Phase for each leg

    // Sync on first frame
    this.update(0);
  }

  /**
   * Set up the spider's physics skeleton and constraints.
   */
  setupSkeleton() {
    // --- BODY (main segment) ---
    const bodyRadius = 0.23, bodyLength = 0.38, bodyMass = 6;
    const bodyPos = { x: this.position.x, y: this.position.y + 0.32, z: this.position.z };
    const body = new CANNON.Body({ mass: bodyMass });
    addCapsuleToBody(body, bodyRadius, bodyLength, 'x');
    body.position.set(bodyPos.x, bodyPos.y, bodyPos.z);
    body.linearDamping = 0.23;
    body.angularDamping = 0.18;
    this.bodies.push(body);
    this.mainBody = body;

    // --- HEAD (cephalothorax) ---
    const headRadius = 0.17, headMass = 2.1;
    const headPos = { x: bodyPos.x + 0.19, y: bodyPos.y + 0.06, z: bodyPos.z };
    const head = new CANNON.Body({ mass: headMass });
    head.addShape(new CANNON.Sphere(headRadius));
    head.position.set(headPos.x, headPos.y, headPos.z);
    head.linearDamping = 0.21;
    head.angularDamping = 0.19;
    this.bodies.push(head);

    // --- HEAD/BODY CONSTRAINT (short neck) ---
    const neck = addConeTwist(
      body, head,
      {
        pivotA: new CANNON.Vec3(0.18, 0.03, 0),
        pivotB: new CANNON.Vec3(-0.13, 0, 0),
        axisA:  new CANNON.Vec3(1, 0, 0),
        axisB:  new CANNON.Vec3(-1, 0, 0),
        angle: Math.PI / 6,
        twistAngle: Math.PI / 10
      }
    );
    this.constraints.push(neck);

    // --- LEGS (8 legs, each with 2 segments and 2 constraints) ---
    // Leg layout: four on each side, splayed radially
    const legParams = [
      //   angle, xOffset, zOffset, yBase
      { ang:  Math.PI / 4,   x: 0.11, z: 0.24,  y: 0.06 },
      { ang:  Math.PI / 8,   x: 0.07, z: 0.16,  y: 0.01 },
      { ang: -Math.PI / 8,   x: 0.07, z: -0.16, y: 0.01 },
      { ang: -Math.PI / 4,   x: 0.11, z: -0.24, y: 0.06 },
      { ang:  Math.PI - Math.PI / 4,   x: -0.11, z: 0.24,  y: 0.06 },
      { ang:  Math.PI - Math.PI / 8,   x: -0.07, z: 0.16,  y: 0.01 },
      { ang: -(Math.PI - Math.PI / 8), x: -0.07, z: -0.16, y: 0.01 },
      { ang: -(Math.PI - Math.PI / 4), x: -0.11, z: -0.24, y: 0.06 }
    ];
    this._legBodies = [];
    this._legConstraints = [];

    const upperLen = 0.38, upperRad = 0.055, upperMass = 0.25;
    const lowerLen = 0.32, lowerRad = 0.045, lowerMass = 0.13;

    for (let i = 0; i < 8; ++i) {
      const leg = legParams[i];
      // --- UPPER SEGMENT ---
      const upper = new CANNON.Body({ mass: upperMass });
      addCapsuleToBody(upper, upperRad, upperLen, 'x');
      // Place upper leg base at side of body
      upper.position.set(
        body.position.x + leg.x + Math.cos(leg.ang) * upperLen / 2,
        body.position.y + leg.y,
        body.position.z + leg.z + Math.sin(leg.ang) * upperLen / 2
      );
      upper.linearDamping = 0.18;
      upper.angularDamping = 0.19;
      this.bodies.push(upper);

      // --- LOWER SEGMENT ---
      const lower = new CANNON.Body({ mass: lowerMass });
      addCapsuleToBody(lower, lowerRad, lowerLen, 'x');
      lower.position.set(
        upper.position.x + Math.cos(leg.ang) * lowerLen / 1.8,
        upper.position.y - lowerLen / 2,
        upper.position.z + Math.sin(leg.ang) * lowerLen / 1.8
      );
      lower.linearDamping = 0.17;
      lower.angularDamping = 0.17;
      this.bodies.push(lower);

      // --- HIP (body to upper) ---
      const hip = addConeTwist(
        body, upper,
        {
          pivotA: new CANNON.Vec3(leg.x, leg.y, leg.z),
          pivotB: new CANNON.Vec3(-upperLen / 2, 0, 0),
          axisA:  new CANNON.Vec3(Math.cos(leg.ang), 0, Math.sin(leg.ang)),
          axisB:  new CANNON.Vec3(-1, 0, 0),
          angle: Math.PI / 5,
          twistAngle: Math.PI / 9
        }
      );
      this.constraints.push(hip);

      // --- KNEE (upper to lower) ---
      const knee = addHinge(
        upper, lower,
        {
          pivotA: new CANNON.Vec3(upperLen / 2, 0, 0),
          axisA:  new CANNON.Vec3(0, 0, 1),
          pivotB: new CANNON.Vec3(-lowerLen / 2, 0, 0),
          axisB:  new CANNON.Vec3(0, 0, 1),
          collideConnected: false
        }
      );
      this.constraints.push(knee);

      // Track leg bodies for animation
      this._legBodies.push({ upper, lower, ang: leg.ang });
      this._legConstraints.push({ hip, knee });
    }
  }

  /**
   * Set up the spider's visual mesh and attach to each physics body.
   */
  setupMesh() {
    this.mesh.clear();

    // --- BODY MESH ---
    const bodyMat = MaterialManager.get('spiderCarapace');
    const bodyMesh = MeshBuilder.createCapsule(0.23, 0.38, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    // --- HEAD MESH ---
    const headMat = MaterialManager.get('spiderCarapace');
    const headMesh = MeshBuilder.createSphere(0.17, headMat, 24);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.mesh.add(headMesh);

    // --- LEGS (8x2) ---
    const legMat = MaterialManager.get('spiderLeg');
    for (let i = 0; i < 8; ++i) {
      // Upper
      const upperLegMesh = MeshBuilder.createCapsule(0.055, 0.38, legMat);
      upperLegMesh.castShadow = true;
      upperLegMesh.receiveShadow = true;
      this.mesh.add(upperLegMesh);
      // Lower
      const lowerLegMesh = MeshBuilder.createCapsule(0.045, 0.32, legMat);
      lowerLegMesh.castShadow = true;
      lowerLegMesh.receiveShadow = true;
      this.mesh.add(lowerLegMesh);
    }
  }

  /**
   * Per-frame update: sync mesh with physics, then update gait/animation and state.
   * @param {number} dt - Delta time (seconds)
   */
  update(dt) {
    // --- Sync mesh with physics bodies (standard) ---
    super.update(dt);

    // --- Animate legs (procedural gait for walking/running) ---
    this.animateLegs(dt);

    // --- Update state machine (idle/walking/running, can trigger gait) ---
    if (this.states) this.states.update(dt);

    // --- (Extend: emit particles, trigger sounds, interact with environment, etc.) ---
  }

  /**
   * Animate legs using procedural gait based on state (idle/walking/running).
   * Modifies physics constraints for realistic motion.
   */
  animateLegs(dt) {
    // Gait timing parameters
    const walkSpeed = 2.2;
    const runSpeed = 4.1;
    const phaseOffset = Math.PI / 4; // Phase difference between legs

    // Choose anim speed based on state
    let gaitFreq = 0, swingMag = 0;
    switch (this.states.current) {
      case 'walking':
        gaitFreq = walkSpeed;
        swingMag = 0.18;
        break;
      case 'running':
        gaitFreq = runSpeed;
        swingMag = 0.31;
        break;
      case 'idle':
      default:
        gaitFreq = 0.3;
        swingMag = 0.08;
    }

    // Animate each leg
    for (let i = 0; i < 8; ++i) {
      const phase = (i % 2 === 0 ? 0 : phaseOffset); // Alternate legs
      this._legAnimPhase[i] += dt * gaitFreq;
      const swing = Math.sin(this._legAnimPhase[i] + phase) * swingMag;

      // Animate upper leg (hip) rotation around vertical axis
      const upper = this._legBodies[i].upper;
      if (upper) {
        // (Optional: Apply impulse or torque for visual swinging)
      }
      // Animate lower leg (knee): flexion/extension
      const lower = this._legBodies[i].lower;
      if (lower) {
        // (Optional: Apply additional swing)
      }
    }
    // If using AnimationSystem with keyframes, trigger clips based on state.
    // (Or blend keyframes with procedural)
  }

  // --- State machine: can extend for web spinning, attack, etc. ---

  onIdleEnter()    { /* Idle: minimal movement, random twitches? */ }
  updateIdle(dt)   { /* Idle gait: low-magnitude random walk in phase */ }

  onWalkEnter()    { /* Set up walking: maybe blend in walk anim, particles */ }
  updateWalk(dt)   { /* Walking gait: animate legs, advance body forward */ }

  onRunEnter()     { /* Running: faster gait, head bobs, etc. */ }
  updateRun(dt)    { /* Running gait: increase swing, increase speed */ }

  /**
   * Cleanup all physics and mesh resources. Called by Pen or scene manager.
   */
  remove() {
    super.remove();
    if (this.animationSystem && typeof this.animationSystem.remove === 'function') {
      this.animationSystem.remove(this.mesh);
    }
    this.states = null;
    this._legBodies = null;
    this._legConstraints = null;
    this._legAnimPhase = null;
  }
}
