// src/creatures/octopus.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCreature } from './BaseCreature.js';
import { StateMachine } from '../utils/stateMachine.js';
import { addConeTwist, addCapsuleToBody } from '../utils/physics/rigHelpers.js';
import MaterialManager from '../materials/MaterialManager.js';
import MeshBuilder from '../utils/graphics/MeshBuilder.js';

/**
 * Octopus creature class.
 * Physics-driven, with 8 animated tentacles, procedural and state-driven animation.
 */
export class Octopus extends BaseCreature {
  /**
   * @param {CANNON.World} world - Cannon-es physics world
   * @param {THREE.Scene} scene  - Three.js scene
   * @param {{x:number, y:number, z:number}} position - World position of octopus
   * @param {AnimationSystem=} animationSystem - Animation system (optional)
   */
  constructor(world, scene, position, animationSystem = null) {
    super(world, scene, position, animationSystem);

    // State machine: idle, swimming, running
    this.states = new StateMachine(
      {
        idle:    { enter: this.onIdleEnter.bind(this),    update: this.updateIdle.bind(this) },
        swimming:{ enter: this.onSwimEnter.bind(this),    update: this.updateSwim.bind(this) },
        running: { enter: this.onRunEnter.bind(this),     update: this.updateRun.bind(this) }
      },
      'idle'
    );

    // Build skeleton: main body, head, and 8 tentacles with segments
    this.setupSkeleton();

    // Create visual mesh for each part
    this.setupMesh();

    // Register with animation system if provided
    if (this.animationSystem && typeof this.animationSystem.add === 'function') {
      this.animationSystem.add(this.mesh, []);
    }

    // Internal: tentacle wave phase per tentacle and per segment
    this._tentaclePhases = Array.from({length: 8}, () => new Array(this._segmentsPerTentacle).fill(0));

    // Sync on first frame
    this.update(0);
  }

  /**
   * Set up the octopus's physics skeleton.
   */
  setupSkeleton() {
    // Main mantle/body (sphere)
    const bodyRadius = 0.37;
    const bodyMass = 8.2;
    const mantlePos = { x: this.position.x, y: this.position.y + 0.42, z: this.position.z };
    const body = new CANNON.Body({ mass: bodyMass });
    body.addShape(new CANNON.Sphere(bodyRadius));
    body.position.set(mantlePos.x, mantlePos.y, mantlePos.z);
    body.linearDamping = 0.28;
    body.angularDamping = 0.25;
    this.bodies.push(body);
    this.mainBody = body;

    // Head/nape (smaller sphere for orientation)
    const headRadius = 0.18;
    const headMass = 2.5;
    const headPos = { x: mantlePos.x, y: mantlePos.y + 0.22, z: mantlePos.z };
    const head = new CANNON.Body({ mass: headMass });
    head.addShape(new CANNON.Sphere(headRadius));
    head.position.set(headPos.x, headPos.y, headPos.z);
    this.bodies.push(head);

    // Neck constraint (loose cone twist)
    const neck = addConeTwist(
      body, head,
      {
        pivotA: new CANNON.Vec3(0, bodyRadius * 0.8, 0),
        pivotB: new CANNON.Vec3(0, -headRadius * 0.7, 0),
        axisA:  new CANNON.Vec3(0, 1, 0),
        axisB:  new CANNON.Vec3(0, -1, 0),
        angle: Math.PI / 6,
        twistAngle: Math.PI / 7
      }
    );
    this.constraints.push(neck);

    // Tentacle config
    this._tentacleCount = 8;
    this._segmentsPerTentacle = 6;
    this._tentacleLength = 1.24;
    this._tentacleRadius = 0.07;
    this._tentacleBodies = [];
    this._tentacleConstraints = [];

    // Evenly distribute tentacle base positions around the body equator
    for (let t = 0; t < this._tentacleCount; ++t) {
      const angle = (t / this._tentacleCount) * Math.PI * 2;
      const baseX = Math.cos(angle) * bodyRadius * 0.92;
      const baseZ = Math.sin(angle) * bodyRadius * 0.92;
      let prevBody = body;
      let prevPivot = new CANNON.Vec3(baseX, -bodyRadius * 0.78, baseZ);
      let tentacleBodies = [];
      let tentacleConstraints = [];

      for (let s = 0; s < this._segmentsPerTentacle; ++s) {
        // Each segment is a capsule aligned downward and outward
        const segLen = this._tentacleLength / this._segmentsPerTentacle;
        const segRad = this._tentacleRadius * (1 - s / (this._segmentsPerTentacle * 1.9));
        const segMass = 0.3 + (0.04 * s);
        // Position segment tip out along tentacle arc
        const segFrac = (s + 1) / this._segmentsPerTentacle;
        const segX = baseX * (1 + segFrac * 0.52);
        const segY = mantlePos.y - bodyRadius * 0.84 - (segLen * (s + 0.5));
        const segZ = baseZ * (1 + segFrac * 0.52);

        const segBody = new CANNON.Body({ mass: segMass });
        addCapsuleToBody(segBody, segRad, segLen, 'y');
        segBody.position.set(mantlePos.x + segX, segY, mantlePos.z + segZ);
        segBody.linearDamping = 0.19;
        segBody.angularDamping = 0.18;
        this.bodies.push(segBody);
        tentacleBodies.push(segBody);

        // Attach segment to previous segment (or to body if base)
        const ctw = addConeTwist(
          prevBody, segBody,
          {
            pivotA: prevPivot,
            pivotB: new CANNON.Vec3(0, segLen / 2, 0),
            axisA:  new CANNON.Vec3(0, -1, 0),
            axisB:  new CANNON.Vec3(0, 1, 0),
            angle: Math.PI / 5 + 0.1 * (1 - s / this._segmentsPerTentacle),
            twistAngle: Math.PI / 9 + 0.05 * (1 - s / this._segmentsPerTentacle)
          }
        );
        this.constraints.push(ctw);
        tentacleConstraints.push(ctw);

        prevBody = segBody;
        prevPivot = new CANNON.Vec3(0, -segLen / 2, 0);
      }
      this._tentacleBodies.push(tentacleBodies);
      this._tentacleConstraints.push(tentacleConstraints);
    }
  }

  /**
   * Create visual mesh for each segment of the octopus (mantle, head, all tentacles).
   */
  setupMesh() {
    this.mesh.clear();

    // Mantle/body mesh
    const bodyMat = MaterialManager.get('octopusSkin');
    const bodyMesh = MeshBuilder.createSphere(0.37, bodyMat, 28);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    // Head mesh
    const headMat = MaterialManager.get('octopusSkin');
    const headMesh = MeshBuilder.createSphere(0.18, headMat, 20);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.mesh.add(headMesh);

    // Tentacle meshes
    for (let t = 0; t < this._tentacleCount; ++t) {
      for (let s = 0; s < this._segmentsPerTentacle; ++s) {
        const segRad = this._tentacleRadius * (1 - s / (this._segmentsPerTentacle * 1.9));
        const segLen = this._tentacleLength / this._segmentsPerTentacle;
        const tentacleMat = MaterialManager.get('octopusSkin');
        const tentacleMesh = MeshBuilder.createCapsule(segRad, segLen, tentacleMat, 8);
        tentacleMesh.castShadow = true;
        tentacleMesh.receiveShadow = true;
        this.mesh.add(tentacleMesh);
      }
    }
    // (Optionally: Add small meshes for eyes, or add texture UVs for more detail)
  }

  /**
   * Per-frame update: syncs mesh with physics, then runs procedural animation and state logic.
   * @param {number} dt - Delta time (seconds)
   */
  update(dt) {
    // Sync mesh parts to physics bodies
    let meshIdx = 0;
    // Mantle/body
    if (this.mainBody && this.mesh.children[meshIdx]) {
      this.mesh.children[meshIdx].position.copy(this.mainBody.position);
      this.mesh.children[meshIdx].quaternion.copy(this.mainBody.quaternion);
    }
    meshIdx++;
    // Head
    const headIdx = meshIdx;
    if (this.mesh.children[headIdx] && this.bodies[1]) {
      this.mesh.children[headIdx].position.copy(this.bodies[1].position);
      this.mesh.children[headIdx].quaternion.copy(this.bodies[1].quaternion);
    }
    meshIdx++;
    // Tentacle segments
    for (let t = 0; t < this._tentacleCount; ++t) {
      for (let s = 0; s < this._segmentsPerTentacle; ++s) {
        const segBody = this._tentacleBodies[t][s];
        const meshPart = this.mesh.children[meshIdx];
        if (segBody && meshPart) {
          meshPart.position.copy(segBody.position);
          meshPart.quaternion.copy(segBody.quaternion);
        }
        meshIdx++;
      }
    }

    // Animate tentacles
    this.animateTentacles(dt);

    // Update state machine (swim, run, etc)
    if (this.states) this.states.update(dt);
  }

  /**
   * Animate tentacles procedurally: idle waving, swimming propulsion, fast running.
   */
  animateTentacles(dt) {
    // Animation params by state
    let freq = 0.5, amp = 0.09, swimPush = 0;
    switch (this.states.current) {
      case 'idle':
      default:
        freq = 0.5; amp = 0.09; swimPush = 0;
        break;
      case 'swimming':
        freq = 1.7; amp = 0.22; swimPush = 0.7;
        break;
      case 'running':
        freq = 3.2; amp = 0.41; swimPush = 1.55;
        break;
    }

    for (let t = 0; t < this._tentacleCount; ++t) {
      for (let s = 0; s < this._segmentsPerTentacle; ++s) {
        // Calculate wave phase for procedural motion
        this._tentaclePhases[t][s] += dt * freq * (1 + s * 0.22);
        const wave = Math.sin(this._tentaclePhases[t][s] + t * 0.39 + s * 0.3) * amp * (1 - s / this._segmentsPerTentacle);

        // For base segments, add a swimming force (optional: only on swimming/running)
        if (swimPush > 0 && s === 0) {
          const segBody = this._tentacleBodies[t][s];
          if (segBody) {
            // Propel body in "opposite" direction for realistic swim
            segBody.applyForce(
              new CANNON.Vec3(
                Math.cos(t * Math.PI / 4) * swimPush,
                Math.abs(wave) * 0.7,
                Math.sin(t * Math.PI / 4) * swimPush
              ),
              segBody.position
            );
          }
        }
        // Add random/sinusoidal impulse to each segment for waving
        const segBody = this._tentacleBodies[t][s];
        if (segBody) {
          segBody.applyForce(
            new CANNON.Vec3(
              Math.sin(wave) * 0.17 * (1 - s / this._segmentsPerTentacle),
              0,
              Math.cos(wave) * 0.14 * (1 - s / this._segmentsPerTentacle)
            ),
            segBody.position
          );
        }
      }
    }
  }

  // --- State machine: idle (waving), swimming (tentacle crawl), running (propel fast) ---

  onIdleEnter()    { /* Subtle waving, color pulsing if desired */ }
  updateIdle(dt)   { /* Idle animation: waving tentacles */ }

  onSwimEnter()    { /* Can bubble, particle, start swim sound */ }
  updateSwim(dt)   { /* Active tentacle waving and swim force */ }

  onRunEnter()     { /* More intense wave, jet burst */ }
  updateRun(dt)    { /* Maximum tentacle amplitude/freq, body motion */ }

  /**
   * Cleanup all physics and mesh resources. Called by Pen or scene manager.
   */
  remove() {
    super.remove();
    if (this.animationSystem && typeof this.animationSystem.remove === 'function') {
      this.animationSystem.remove(this.mesh);
    }
    this.states = null;
    this._tentacleBodies = null;
    this._tentacleConstraints = null;
    this._tentaclePhases = null;
  }
}
