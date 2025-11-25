
// src/animals/bodyParts/FurStrand.js
import * as THREE from 'three';

export class FurStrand {
  constructor(rootPos, rootNormal, length) {
    this.root = rootPos.clone();
    this.normal = rootNormal.clone().normalize();
    this.length = length;
    this.tip = this.root.clone().addScaledVector(this.normal, length);
    this.velocity = new THREE.Vector3(0, 0, 0);
  }
  update(newRoot, newNormal, dt, params = {}) {
    const gravity = params.gravity || new THREE.Vector3(0, -2.5, 0);
    const stiffness = params.stiffness ?? 36;
    const damping = params.damping ?? 8;
    let dir = this.tip.clone().sub(newRoot).normalize();
    let target = newRoot.clone().addScaledVector(newNormal, this.length);
    let spring = target.clone().sub(this.tip).multiplyScalar(stiffness);
    let damp = this.velocity.clone().multiplyScalar(-damping);
    let force = spring.add(damp).add(gravity);
    this.velocity.add(force.multiplyScalar(dt));
    this.tip.add(this.velocity.clone().multiplyScalar(dt));
    let curLen = this.tip.distanceTo(newRoot);
    if (curLen > 0) {
      let toTip = this.tip.clone().sub(newRoot).normalize();
      this.tip.copy(newRoot).addScaledVector(toTip, this.length);
    }
    this.root.copy(newRoot);
    this.normal.copy(newNormal);
  }
}
