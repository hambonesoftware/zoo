// src/creatures/humanoid.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCreature } from './BaseCreature.js';
import { StateMachine } from '../utils/stateMachine.js';
import { addHinge, addConeTwist, addCapsuleToBody } from '../utils/physics/rigHelpers.js';

/**
 * Humanoid creature class.
 * Physics-driven bipedal with full skeleton, mesh, state machine, and animation hooks.
 */
export class Humanoid extends BaseCreature {
  /**
   * @param {CANNON.World} world
   * @param {THREE.Scene} scene
   * @param {{x:number, y:number, z:number}} position
   * @param {AnimationSystem=} animationSystem
   */
  constructor(world, scene, position, animationSystem = null) {
    super(world, scene, position);

    this.animationSystem = animationSystem;
    this.states = new StateMachine(
      {
        idle:    { enter: this.onIdleEnter.bind(this),    update: this.updateIdle.bind(this) },
        walking: { enter: this.onWalkEnter.bind(this),    update: this.updateWalk.bind(this) },
        running: { enter: this.onRunEnter.bind(this),     update: this.updateRun.bind(this) }
      },
      'idle'
    );

    // Build all physics bodies and constraints
    this.setupSkeleton();

    // Build and attach all meshes
    this.setupMeshes();

    // Optionally register mesh with animation system
    if (this.animationSystem && typeof this.animationSystem.add === 'function') {
      this.animationSystem.add(this.meshParts[0], []);
    }
  }

  setupSkeleton() {
    // --- Torso ---
    const torsoLength = 1.08, torsoRadius = 0.19, torsoMass = 11;
    const torsoPos = { x: this.position.x, y: this.position.y + 0.93, z: this.position.z };
    const torso = new CANNON.Body({ mass: torsoMass });
    addCapsuleToBody(torso, torsoRadius, torsoLength, 'y');
    torso.position.set(torsoPos.x, torsoPos.y, torsoPos.z);
    torso.linearDamping = 0.16;
    torso.angularDamping = 0.21;
    this.addBodyPart(torso);

    // --- Head ---
    const headRadius = 0.16, headMass = 2.8;
    const head = new CANNON.Body({ mass: headMass });
    head.addShape(new CANNON.Sphere(headRadius));
    head.position.set(torsoPos.x, torsoPos.y + (torsoLength/2) + headRadius, torsoPos.z);
    head.linearDamping = 0.15;
    head.angularDamping = 0.16;
    this.addBodyPart(head);

    // --- Neck Constraint ---
    const neck = addConeTwist(
      torso, head,
      {
        pivotA: new CANNON.Vec3(0,  torsoLength / 2, 0),
        pivotB: new CANNON.Vec3(0, -headRadius, 0),
        axisA:  new CANNON.Vec3(0, 1, 0),
        axisB:  new CANNON.Vec3(0, -1, 0),
        angle: Math.PI / 6,
        twistAngle: Math.PI / 8
      }
    );
    this.addConstraint(neck);

    // --- Left and Right Arms ---
    this._addArm({
      side: 'left',
      torso,
      shoulderOffset: { x: -0.27, y: torsoLength / 2 - 0.12, z: 0.0 },
      upperLength: 0.38, lowerLength: 0.34,
      radius: 0.09, mass: 1.5
    });
    this._addArm({
      side: 'right',
      torso,
      shoulderOffset: { x: 0.27, y: torsoLength / 2 - 0.12, z: 0.0 },
      upperLength: 0.38, lowerLength: 0.34,
      radius: 0.09, mass: 1.5
    });

    // --- Left and Right Legs ---
    this._addLeg({
      side: 'left',
      torso,
      hipOffset: { x: -0.12, y: -torsoLength / 2 + 0.05, z: 0.0 },
      upperLength: 0.41, lowerLength: 0.40,
      radius: 0.11, mass: 2.2
    });
    this._addLeg({
      side: 'right',
      torso,
      hipOffset: { x: 0.12, y: -torsoLength / 2 + 0.05, z: 0.0 },
      upperLength: 0.41, lowerLength: 0.40,
      radius: 0.11, mass: 2.2
    });
  }

  _addArm({ side, torso, shoulderOffset, upperLength, lowerLength, radius, mass }) {
    // Upper Arm
    const upperArm = new CANNON.Body({ mass });
    addCapsuleToBody(upperArm, radius, upperLength, 'y');
    upperArm.position.set(
      torso.position.x + shoulderOffset.x,
      torso.position.y + shoulderOffset.y - upperLength / 2,
      torso.position.z + shoulderOffset.z
    );
    upperArm.linearDamping = 0.15;
    upperArm.angularDamping = 0.16;
    this.addBodyPart(upperArm);

    // Forearm
    const forearm = new CANNON.Body({ mass });
    addCapsuleToBody(forearm, radius * 0.92, lowerLength, 'y');
    forearm.position.set(
      upperArm.position.x,
      upperArm.position.y - upperLength / 2 - lowerLength / 2,
      upperArm.position.z
    );
    forearm.linearDamping = 0.15;
    forearm.angularDamping = 0.15;
    this.addBodyPart(forearm);

    // Shoulder (cone twist)
    const shoulder = addConeTwist(
      torso, upperArm,
      {
        pivotA: new CANNON.Vec3(shoulderOffset.x, shoulderOffset.y, shoulderOffset.z),
        pivotB: new CANNON.Vec3(0, upperLength / 2, 0),
        axisA:  new CANNON.Vec3(1, 0, 0),
        axisB:  new CANNON.Vec3(1, 0, 0),
        angle: Math.PI / 4,
        twistAngle: Math.PI / 8
      }
    );
    this.addConstraint(shoulder);

    // Elbow (hinge)
    const elbow = addHinge(
      upperArm, forearm,
      {
        pivotA: new CANNON.Vec3(0, -upperLength / 2, 0),
        axisA:  new CANNON.Vec3(1, 0, 0),
        pivotB: new CANNON.Vec3(0, lowerLength / 2, 0),
        axisB:  new CANNON.Vec3(1, 0, 0),
        collideConnected: false
      }
    );
    this.addConstraint(elbow);
  }

  _addLeg({ side, torso, hipOffset, upperLength, lowerLength, radius, mass }) {
    // Thigh
    const thigh = new CANNON.Body({ mass });
    addCapsuleToBody(thigh, radius, upperLength, 'y');
    thigh.position.set(
      torso.position.x + hipOffset.x,
      torso.position.y + hipOffset.y - upperLength / 2,
      torso.position.z + hipOffset.z
    );
    thigh.linearDamping = 0.18;
    thigh.angularDamping = 0.18;
    this.addBodyPart(thigh);

    // Shin
    const shin = new CANNON.Body({ mass });
    addCapsuleToBody(shin, radius * 0.94, lowerLength, 'y');
    shin.position.set(
      thigh.position.x,
      thigh.position.y - upperLength / 2 - lowerLength / 2,
      thigh.position.z
    );
    shin.linearDamping = 0.18;
    shin.angularDamping = 0.18;
    this.addBodyPart(shin);

    // Hip (cone twist)
    const hip = addConeTwist(
      torso, thigh,
      {
        pivotA: new CANNON.Vec3(hipOffset.x, hipOffset.y, hipOffset.z),
        pivotB: new CANNON.Vec3(0, upperLength / 2, 0),
        axisA:  new CANNON.Vec3(1, 0, 0),
        axisB:  new CANNON.Vec3(1, 0, 0),
        angle: Math.PI / 5,
        twistAngle: Math.PI / 9
      }
    );
    this.addConstraint(hip);

    // Knee (hinge)
    const knee = addHinge(
      thigh, shin,
      {
        pivotA: new CANNON.Vec3(0, -upperLength / 2, 0),
        axisA:  new CANNON.Vec3(1, 0, 0),
        pivotB: new CANNON.Vec3(0, lowerLength / 2, 0),
        axisB:  new CANNON.Vec3(1, 0, 0),
        collideConnected: false
      }
    );
    this.addConstraint(knee);
  }

  setupMeshes() {
    // Minimal placeholder: Attach a mesh to each physics body part.
    // You should use your MeshBuilder and MaterialManager as appropriate.
    for (let i = 0; i < this.bodyParts.length; ++i) {
      let mesh;
      // For demonstration, use a capsule for most, sphere for head
      if (i === 1) {
        // Head
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 24, 24),
          new THREE.MeshPhongMaterial({ color: 0xffe0c0 })
        );
      } else {
        // Body/limbs
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.15, 0.5, 12, 24),
          new THREE.MeshPhongMaterial({ color: 0xc09060 })
        );
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(this.bodyParts[i].position);
      mesh.quaternion.copy(this.bodyParts[i].quaternion);
      this.addMeshPart(mesh);
    }
  }

  update(dt) {
    super.syncMeshes();
    this.states.update(dt);
  }

  // --- State machine stubs (fill out as needed) ---
  onIdleEnter()    { }
  updateIdle(dt)   { }
  onWalkEnter()    { }
  updateWalk(dt)   { }
  onRunEnter()     { }
  updateRun(dt)    { }
}
