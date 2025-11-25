// src/objects/penWall.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PenWall {
  /**
   * @param {THREE.Scene} scene
   * @param {CANNON.World} world
   * @param {object} opts
   *   - position: {x, y, z}
   *   - width: number (meters)
   *   - depth: number (meters)
   *   - barSpacing: number (meters)
   *   - barHeight: number (meters)
   *   - baseHeight: number (meters)
   */
  constructor(scene, world, opts = {}) {
    // Options
    const {
      position = { x: 0, y: 0, z: 0 },
      width = 5,
      depth = 5,
      barSpacing = 0.33,
      barHeight = 1.2,
      baseHeight = 0.18   // thinner, for just a lip
    } = opts;

    this.scene = scene;
    this.world = world;
    this.width = width;
    this.depth = depth;
    this.position = position;
    this.barSpacing = barSpacing;
    this.barHeight = barHeight;
    this.baseHeight = baseHeight;

    // Hold references for cleanup
    this.mesh = new THREE.Group();
    this.wallBodies = [];

    // Build visible mesh fence and lip
    this._buildFenceWithLip();
    this.scene.add(this.mesh);

    // Build invisible physics walls
    this._buildPhysicsWalls();
  }

  _buildFenceWithLip() {
    // Bar material
    const barMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.55, roughness: 0.45 });
    // Cement base/lip material
    const cementMaterial = new THREE.MeshStandardMaterial({ color: 0x888b8d, metalness: 0.2, roughness: 0.7 });

    // Bars along width (front/back)
    for (let side of [-1, 1]) {
      const z = this.position.z + (side * this.depth / 2);
      for (let x = -this.width / 2; x <= this.width / 2; x += this.barSpacing) {
        const barGeom = new THREE.CylinderGeometry(0.05, 0.05, this.barHeight, 8);
        const barMesh = new THREE.Mesh(barGeom, barMaterial);
        barMesh.position.set(this.position.x + x, this.position.y + this.barHeight / 2 + this.baseHeight, z);
        barMesh.castShadow = true;
        this.mesh.add(barMesh);
      }
    }

    // Bars along depth (left/right)
    for (let side of [-1, 1]) {
      const x = this.position.x + (side * this.width / 2);
      for (let z = -this.depth / 2; z <= this.depth / 2; z += this.barSpacing) {
        const barGeom = new THREE.CylinderGeometry(0.05, 0.05, this.barHeight, 8);
        const barMesh = new THREE.Mesh(barGeom, barMaterial);
        barMesh.position.set(x, this.position.y + this.barHeight / 2 + this.baseHeight, this.position.z + z);
        barMesh.castShadow = true;
        barMesh.rotateY(Math.PI / 2);
        this.mesh.add(barMesh);
      }
    }

    // Cement "lip" (thin base frame, not a floor)
    // Four border beams (rectangular cross-section)
    const lipThickness = 0.13;
    const lipHeight = this.baseHeight;
    const halfW = this.width / 2;
    const halfD = this.depth / 2;

    // Front edge
    const frontLipGeom = new THREE.BoxGeometry(this.width, lipHeight, lipThickness);
    const frontLip = new THREE.Mesh(frontLipGeom, cementMaterial);
    frontLip.position.set(this.position.x, this.position.y + lipHeight / 2, this.position.z - halfD - lipThickness / 2 + 0.01);
    frontLip.receiveShadow = true;
    this.mesh.add(frontLip);

    // Back edge
    const backLipGeom = new THREE.BoxGeometry(this.width, lipHeight, lipThickness);
    const backLip = new THREE.Mesh(backLipGeom, cementMaterial);
    backLip.position.set(this.position.x, this.position.y + lipHeight / 2, this.position.z + halfD + lipThickness / 2 - 0.01);
    backLip.receiveShadow = true;
    this.mesh.add(backLip);

    // Left edge
    const leftLipGeom = new THREE.BoxGeometry(lipThickness, lipHeight, this.depth + lipThickness * 2);
    const leftLip = new THREE.Mesh(leftLipGeom, cementMaterial);
    leftLip.position.set(this.position.x - halfW - lipThickness / 2 + 0.01, this.position.y + lipHeight / 2, this.position.z);
    leftLip.receiveShadow = true;
    this.mesh.add(leftLip);

    // Right edge
    const rightLipGeom = new THREE.BoxGeometry(lipThickness, lipHeight, this.depth + lipThickness * 2);
    const rightLip = new THREE.Mesh(rightLipGeom, cementMaterial);
    rightLip.position.set(this.position.x + halfW + lipThickness / 2 - 0.01, this.position.y + lipHeight / 2, this.position.z);
    rightLip.receiveShadow = true;
    this.mesh.add(rightLip);
  }

  _buildPhysicsWalls() {
    // Wall thickness/thinness—thick enough so joints can't sneak through!
    const thickness = 0.12;
    const height = this.barHeight + this.baseHeight + 0.12;

    const leftX   = this.position.x - this.width / 2 - thickness / 2;
    const rightX  = this.position.x + this.width / 2 + thickness / 2;
    const frontZ  = this.position.z - this.depth / 2 - thickness / 2;
    const backZ   = this.position.z + this.depth / 2 + thickness / 2;
    const y       = this.position.y + height / 2;

    // Create 4 static wall bodies (CANNON.Box)
    // LEFT WALL
    const leftWall = new CANNON.Body({ mass: 0 });
    leftWall.addShape(new CANNON.Box(new CANNON.Vec3(thickness / 2, height / 2, this.depth / 2 + thickness)));
    leftWall.position.set(leftX, y, this.position.z);
    this.world.addBody(leftWall);
    this.wallBodies.push(leftWall);

    // RIGHT WALL
    const rightWall = new CANNON.Body({ mass: 0 });
    rightWall.addShape(new CANNON.Box(new CANNON.Vec3(thickness / 2, height / 2, this.depth / 2 + thickness)));
    rightWall.position.set(rightX, y, this.position.z);
    this.world.addBody(rightWall);
    this.wallBodies.push(rightWall);

    // FRONT WALL
    const frontWall = new CANNON.Body({ mass: 0 });
    frontWall.addShape(new CANNON.Box(new CANNON.Vec3(this.width / 2 + thickness, height / 2, thickness / 2)));
    frontWall.position.set(this.position.x, y, frontZ);
    this.world.addBody(frontWall);
    this.wallBodies.push(frontWall);

    // BACK WALL
    const backWall = new CANNON.Body({ mass: 0 });
    backWall.addShape(new CANNON.Box(new CANNON.Vec3(this.width / 2 + thickness, height / 2, thickness / 2)));
    backWall.position.set(this.position.x, y, backZ);
    this.world.addBody(backWall);
    this.wallBodies.push(backWall);
  }

  /**
   * Remove wall meshes and CANNON bodies
   */
  remove() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    if (this.wallBodies && this.world) {
      for (const body of this.wallBodies) {
        this.world.removeBody(body);
      }
      this.wallBodies = [];
    }
  }
}
