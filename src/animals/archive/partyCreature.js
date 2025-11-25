// src/creatures/partyCreature.js
import * as THREE from 'three';
import { PartyCreatureBehavior } from '../behavior/partyCreatureBehavior.js';

export class PartyCreature extends THREE.Group {
  /**
   * @param {object} opts
   *  - scale, bodyColor, headColor, legColor, tailColor, behavior (optional)
   */
  constructor(opts = {}) {
    super();

    const scale = opts.scale ?? 1.0;
    const bodyColor = opts.bodyColor ?? 0xaaddff;
    const headColor = opts.headColor ?? 0xffe0c2;
    const legColor = opts.legColor ?? 0x7fb37f;
    const tailColor = opts.tailColor ?? 0xeeeeee;

    // ---- Body ----
    const bodyGeo = new THREE.SphereGeometry(0.15 * scale, 28, 22);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.37, metalness: 0.18 });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
	this.body.userData.parentPartyCreature = this;

    this.body.position.set(0, 0.32 * scale, 0);
    this.add(this.body);

    // ---- Head (rotates, attached to body) ----
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.31 * scale, 0.25 * scale); // above body, slightly forward
    this.body.add(this.headPivot);

    const headGeo = new THREE.SphereGeometry(0.15 * scale, 20, 14);
    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.19, metalness: 0.21 });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.headPivot.add(this.head);

    // --- Eyes (simple, optional) ---
    const eyeGeo = new THREE.SphereGeometry(0.024 * scale, 12, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let dx of [-0.042, 0.042]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(dx, 0.018 * scale, 0.13 * scale);
      this.head.add(eye);
    }

    // ---- Tail ----
	this.tailPivot = new THREE.Group();
	this.tailPivot.position.set(0, 0.19 * scale, -0.29 * scale); // low and back
	this.body.add(this.tailPivot);

	const tailLen = 0.36 * scale;
	const tailGeo = new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, tailLen, 8);
	// Cylinder's default center is at the mesh center, so position the mesh so the *top* attaches to the pivot:
	const tailMat = new THREE.MeshStandardMaterial({ color: tailColor, roughness: 0.29, metalness: 0.18 });
	this.tail = new THREE.Mesh(tailGeo, tailMat);
	// Position the tail so its top (not center) matches the pivot
	this.tail.position.y = -tailLen / 2;
	this.tail.rotation.x = Math.PI / 2;
	this.tailPivot.add(this.tail);


    // ---- Legs (4), each with upper and lower segment ----
    this.legs = [];
    const legAttachPoints = [
      [-0.13, 0,  0.13],  // front left
      [ 0.13, 0,  0.13],  // front right
      [-0.13, 0, -0.13],  // back left
      [ 0.13, 0, -0.13],  // back right
    ];
    for (let i = 0; i < 4; ++i) {
      const [x, y, z] = legAttachPoints[i].map(v => v * scale);
      // Hip/shoulder joint group
      const legGroup = new THREE.Group();
      legGroup.position.set(x, -0.09 * scale, z);
      this.body.add(legGroup);

      // Upper leg (thigh/shoulder)
      const upperLegLen = 0.19 * scale;
      const upperLegGeo = new THREE.CylinderGeometry(0.033 * scale, 0.041 * scale, upperLegLen, 10);
      const upperLegMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.24, metalness: 0.15 });
      const upperLeg = new THREE.Mesh(upperLegGeo, upperLegMat);
      upperLeg.position.y = -upperLegLen / 2;
      legGroup.add(upperLeg);

      // Lower leg (shin/forearm)
      const lowerLegLen = 0.17 * scale;
      const lowerLegGeo = new THREE.CylinderGeometry(0.028 * scale, 0.036 * scale, lowerLegLen, 10);
      const lowerLegMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.18, metalness: 0.12 });
      const lowerLeg = new THREE.Mesh(lowerLegGeo, lowerLegMat);
      lowerLeg.position.y = -upperLegLen / 2 - lowerLegLen / 2;
      upperLeg.add(lowerLeg);

      this.legs.push({ legGroup, upperLeg, lowerLeg });
    }

    // --- Behavior integration ---
    this.t = 0;
    // Use provided behavior, or default to new behavior
    if (opts.behavior) {
      this.behavior = opts.behavior;
    } else {
      this.behavior = new PartyCreatureBehavior(this, opts.behaviorOptions || {});
    }

    // Track active sparkles for cleanup
    this.activeSparkles = [];
  }

  /**
   * Animation update: call every frame.
   * Delegates to .behavior if present, else does default idle animation.
   */
  update(dt = 1 / 60) {
    this.t += dt;
    
    // Update behavior
    if (this.behavior && typeof this.behavior.update === "function") {
      this.behavior.update(dt);
    } else {
      // --- Default fallback animation: idle wag and walk in place
      const t = this.t;
      this.headPivot.rotation.y = Math.sin(t * 1.11) * 0.42;
      this.tailPivot.rotation.y = Math.sin(t * 3.5) * 0.85;
      for (let i = 0; i < 4; ++i) {
        const phase = (i % 2 === 0 ? 1 : -1) * t * 2.3;
        this.legs[i].legGroup.rotation.x = Math.sin(phase) * 0.6;
        this.legs[i].upperLeg.rotation.x = Math.max(-0.7, Math.sin(phase + 0.6) * 0.42 - 0.15);
        this.legs[i].lowerLeg.rotation.x = Math.max(-0.9, Math.sin(phase + 1.4) * 0.46 - 0.17);
      }
    }

    // Update active sparkles
    this.updateSparkles(dt);
  }

  /**
   * Update and clean up sparkle effects
   */
  updateSparkles(dt) {
    for (let i = this.activeSparkles.length - 1; i >= 0; i--) {
      const sparkleData = this.activeSparkles[i];
      sparkleData.elapsed += dt;
      
      const progress = sparkleData.elapsed / sparkleData.duration;
      if (progress >= 1.0) {
        // Remove completed sparkle
        this.remove(sparkleData.sparkle);
        this.activeSparkles.splice(i, 1);
      } else {
        // Update sparkle animation
        const fadeAmount = 1.2;
        sparkleData.sparkle.material.opacity = Math.max(0, 0.95 - progress * fadeAmount);
        sparkleData.sparkle.scale.copy(sparkleData.initialScale).multiplyScalar(1.0 + progress * 0.8);
        
        // Add some floating motion
        sparkleData.sparkle.position.y += dt * 0.5;
        sparkleData.sparkle.rotation.x += dt * 2.0;
        sparkleData.sparkle.rotation.y += dt * 1.5;
      }
    }
  }

  /**
   * Optional: party sparkle effect, call from behavior or externally.
   */
 /**
 * PARTY SPARKLE: Hundreds of tiny, multicolored, transparent sparkles!
 */
	sparkleBurst() {
	  const SPARKLE_COUNT = 75 * 4;  // 4x more
	  const BASE_RADIUS = 1.5;
	  const RADIUS_VARIANCE = 0.76;
	  const SIZE_MIN = 0.015;        // 1/4 previous minimum
	  const SIZE_MAX = 0.035;        // 1/4 previous maximum
	  const DURATION = 0.9 + Math.random() * 0.9; // Each sparkle lasts a bit

	  for (let i = 0; i < SPARKLE_COUNT; ++i) {
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);
		const r = BASE_RADIUS + Math.random() * RADIUS_VARIANCE;
		const size = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);

		// Multicolor: random HSL, bright, fully saturated, random lightness
		const h = Math.random();
		const s = 0.85 + Math.random() * 0.14;
		const l = 0.56 + Math.random() * 0.32;

		const sparkle = new THREE.Mesh(
		  new THREE.SphereGeometry(size, 8, 6),
		  new THREE.MeshStandardMaterial({
			color: new THREE.Color().setHSL(h, s, l),
			transparent: true,
			opacity: 0.43 + Math.random() * 0.19,
			emissive: 0xffffff,
			emissiveIntensity: 0.68 + Math.random() * 0.44,
			metalness: 0.38,
			roughness: 0.33,
			depthWrite: false
		  })
		);

		sparkle.position.copy(this.body.position);
		sparkle.position.x += Math.sin(phi) * Math.cos(theta) * r;
		sparkle.position.y += Math.cos(phi) * r + 0.05;
		sparkle.position.z += Math.sin(phi) * Math.sin(theta) * r;
		sparkle.scale.multiplyScalar(1 + Math.random() * 0.37);

		this.add(sparkle);

		// Animate fade-out, expansion, and removal
		const initialScale = sparkle.scale.clone();
		let start = null;
		const animateSparkle = (now) => {
		  if (!start) start = now;
		  const elapsed = (now - start) / 1000;
		  const t = Math.min(1, elapsed / DURATION);

		  sparkle.material.opacity = Math.max(0, (0.62 - t * 0.72)); // fade to zero
		  sparkle.scale.copy(initialScale).multiplyScalar(1 + t * 1.15);

		  if (t < 1) {
			requestAnimationFrame(animateSparkle);
		  } else {
			if (sparkle.parent) sparkle.parent.remove(sparkle);
			sparkle.geometry.dispose();
			if (sparkle.material.map) sparkle.material.map.dispose();
			sparkle.material.dispose();
		  }
		};
		requestAnimationFrame(animateSparkle);
	  }
	}


  /**
   * Clean up method to remove all sparkles
   */
  dispose() {
    // Clean up any remaining sparkles
    for (const sparkleData of this.activeSparkles) {
      this.remove(sparkleData.sparkle);
    }
    this.activeSparkles = [];
  }
}