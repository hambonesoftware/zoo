// src/physics/CatPhysics.js

import * as CANNON from 'cannon-es';

export class CatPhysics {
  /**
   * Creates Cannon-es physics bodies for the cat creature's bones.
   * @param {object} catCreature The cat creature instance with skeleton.
   * @param {CANNON.World} world The physics world to add bodies and constraints.
   * @param {object} options Optional parameters: mass, damping, etc.
   */
  constructor(catCreature, world, options = {}) {
    this.catCreature = catCreature;
    this.world = world;
    this.options = options;

    this.bodies = {}; // Map bone name to Cannon body
    this.joints = []; // Array of constraints (joints)

    this.mass = options.mass || 1;
    this.damping = options.damping || 0.01;

    this.initBodies();
    this.initJoints();
  }

  /**
   * Initialize physics bodies for each bone.
   * Uses simple capsules or boxes approximating the bone size.
   */
  initBodies() {
    const skeleton = this.catCreature.animal.skeleton;
    const sizes = this.catCreature.animal.definition.sizes || {};

    skeleton.bones.forEach(bone => {
      // Approximate size from definition, fallback if missing
      const size = sizes[bone.name] || [0.2, 0.2, 0.2];
      const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);

      // Create a box shape approximating the bone volume
      const shape = new CANNON.Box(halfExtents);

      // Create body with mass and damping
      const body = new CANNON.Body({
        mass: this.mass,
        shape: shape,
        linearDamping: this.damping,
        angularDamping: this.damping,
      });

      // Position body at bone world position initially
      const worldPos = new CANNON.Vec3();
      const boneWorldPos = new THREE.Vector3();
      bone.getWorldPosition(boneWorldPos);
      worldPos.set(boneWorldPos.x, boneWorldPos.y, boneWorldPos.z);

      body.position.copy(worldPos);

      // Store the body
      this.bodies[bone.name] = body;

      // Add body to physics world
      this.world.addBody(body);
    });
  }

  /**
   * Initialize joints (constraints) between parent and child bones' physics bodies.
   */
  initJoints() {
    const skeleton = this.catCreature.animal.skeleton;

    skeleton.bones.forEach(bone => {
      if (bone.parent && this.bodies[bone.name] && this.bodies[bone.parent.name]) {
        const childBody = this.bodies[bone.name];
        const parentBody = this.bodies[bone.parent.name];

        // Create a ConeTwistConstraint for flexible joint with limits
        const constraint = new CANNON.ConeTwistConstraint(parentBody, childBody, {
          pivotA: new CANNON.Vec3(0, 0, 0),
          pivotB: new CANNON.Vec3(0, 0, 0),
          axisA: new CANNON.Vec3(0, 1, 0),
          axisB: new CANNON.Vec3(0, 1, 0),
          angle: Math.PI / 4,
          twistAngle: Math.PI / 8,
        });

        this.joints.push(constraint);
        this.world.addConstraint(constraint);
      }
    });
  }

  /**
   * Synchronize Three.js skeleton bone positions and rotations with Cannon bodies.
   * Call this every frame after physics step.
   */
  update() {
    const skeleton = this.catCreature.animal.skeleton;

    skeleton.bones.forEach(bone => {
      const body = this.bodies[bone.name];
      if (!body) return;

      // Copy position
      bone.position.set(body.position.x, body.position.y, body.position.z);

      // Copy rotation quaternion
      bone.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    });

    // Update skeleton matrix
    skeleton.pose();
  }
}
