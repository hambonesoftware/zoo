// src/ik/CatIK.js

import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

/**
 * CatIK class manages inverse kinematics for the cat skeleton
 * using Three.js's CCDIKSolver.
 */
export class CatIK {
  /**
   * Initializes CCDIKSolver for the cat skeleton using an IK definition.
   * @param {THREE.Skeleton} skeleton The skeleton to apply IK to.
   * @param {Object[]} ikDefinition Array describing IK chains (bones, targets, iteration counts).
   */
  constructor(skeleton, ikDefinition) {
    this.skeleton = skeleton;
    this.ikDefinition = ikDefinition;

    // Initialize the CCDIKSolver with skeleton bones and IK chains
    this.solver = new CCDIKSolver(skeleton.bones, ikDefinition);
  }

  /**
   * Update IK solver each frame.
   * @param {number} dt Delta time in seconds (unused here, but reserved for future use).
   */
  update(dt) {
    // Solve IK chains for smooth bone positioning
    this.solver.update();
  }
}
