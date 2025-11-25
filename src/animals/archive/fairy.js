import * as THREE from 'three';
import { FairyBehavior } from '../behavior/fairyBehavior.js';

export class Fairy extends THREE.Group {
  constructor(opts = {}) {
    super();

    // Parameters
    const color = opts.color ?? 0xf6b0e9;
    const wingColor = opts.wingColor ?? 0xffffff;
    const wingOutlineColor = opts.wingOutlineColor ?? 0x66ccff;
    const scale = opts.scale ?? 1.0;
    this.penBounds = opts.penBounds ?? {
      minX: -3, maxX: 3, minY: 0.2, maxY: 3, minZ: -3, maxZ: 3
    };
    this.baseColor = new THREE.Color(color);

    // --- Body (stretchable) ---
    const bodyGeo = new THREE.SphereGeometry(0.17 * scale, 24, 20);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.28,
      metalness: 0.32,
      transparent: true,
      opacity: 0.96
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.position.y = 0.19 * scale;
    this.add(this.bodyMesh);

    // --- Head (rotates independently) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.13 * scale;
    this.bodyMesh.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.09 * scale, 20, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf8eaea,
      roughness: 0.17,
      metalness: 0.18
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 0.13 * scale;
    this.headGroup.add(this.headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.018 * scale, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x23232c });
    for (let dx of [-0.024, 0.024]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(dx, 0.022 * scale, 0.075 * scale);
      this.headMesh.add(eye);
    }

    // --- Wings: positioned straight out, flap up/down (around Z) ---
    // Geometry for wing mesh and outline
    const wingGeo = new THREE.PlaneGeometry(0.26 * scale, 0.18 * scale, 1, 12);
    const wingMat = new THREE.MeshStandardMaterial({
      color: wingColor,
      transparent: true,
      opacity: 0.36,
      metalness: 0.08,
      roughness: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Outline geometry
    const outlineShape = new THREE.Shape();
    const w = 0.13 * scale, h = 0.09 * scale;
    outlineShape.moveTo(-w, -h);
    outlineShape.lineTo(w, -h);
    outlineShape.lineTo(w, h);
    outlineShape.lineTo(-w, h);
    outlineShape.lineTo(-w, -h);
    const outlinePoints = outlineShape.getPoints(24);
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePoints);

    // --- Left wing group: positioned straight out, pivot for up/down flap ---
    this.leftWingPivot = new THREE.Group();
    this.leftWingPivot.position.set(-0.17 * scale, 0.22 * scale, 0);
    // No initial rotation needed: points straight left
    this.bodyMesh.add(this.leftWingPivot);

    this.leftWing = new THREE.Group();
    this.leftWing.rotation.z = 0; // Flap axis!
    this.leftWingPivot.add(this.leftWing);

    const leftWingMesh = new THREE.Mesh(wingGeo, wingMat.clone());
    leftWingMesh.material.opacity = 0.33 + Math.random() * 0.08;
    this.leftWing.add(leftWingMesh);

    const leftWingOutline = new THREE.Line(
      outlineGeom,
      new THREE.LineBasicMaterial({
        color: wingOutlineColor,
        linewidth: 2,
        opacity: 0.92,
        transparent: true
      })
    );
    leftWingOutline.position.z = 0.001;
    this.leftWing.add(leftWingOutline);

    // --- Right wing group: positioned straight out, pivot for up/down flap ---
    this.rightWingPivot = new THREE.Group();
    this.rightWingPivot.position.set(0.17 * scale, 0.22 * scale, 0);
    // No initial rotation needed: points straight right
    this.bodyMesh.add(this.rightWingPivot);

    this.rightWing = new THREE.Group();
    this.rightWing.rotation.z = 0; // Flap axis!
    this.rightWingPivot.add(this.rightWing);

    const rightWingMesh = new THREE.Mesh(wingGeo, wingMat.clone());
    rightWingMesh.material.opacity = 0.33 + Math.random() * 0.08;
    this.rightWing.add(rightWingMesh);

    const rightWingOutline = new THREE.Line(
      outlineGeom,
      new THREE.LineBasicMaterial({
        color: wingOutlineColor,
        linewidth: 2,
        opacity: 0.92,
        transparent: true
      })
    );
    rightWingOutline.position.z = 0.001;
    this.rightWing.add(rightWingOutline);

    // Sparkle system function (optional)
    this.sparkleSystem = opts.sparkleSystem || null;

    // Stretching
    this.baseScale = scale;
    this.stretchTarget = 1.0;
    this.currentStretch = 1.0;

    // Behavior
    this.behavior = new FairyBehavior(this, {
      penBounds: this.penBounds
    });

    // For click events
    this.bodyMesh.userData.parentFairy = this;

    // Highlight for hover
    this._highlight = false;

    // Name
    this.name = "Fairy";
  }

  /**
   * Animation update: called every frame.
   */
  update(dt = 1 / 60) {
    // Animate stretch
    if (Math.abs(this.currentStretch - this.stretchTarget) > 0.01) {
      this.currentStretch += (this.stretchTarget - this.currentStretch) * 0.23;
    }
    this.bodyMesh.scale.set(1, this.currentStretch, 1);

    // --- Wing flap (up/down, ±30° from outstretched) ---
    const t = performance.now() * 0.001;
    const flap = Math.sin(t * 13) * (Math.PI / 6); // ±30°
    this.leftWing.rotation.z = flap;
    this.rightWing.rotation.z = -flap;

    // --- Head rotation (±45°, relative to facing) ---
    this.headGroup.rotation.y = Math.sin(t * 1.2) * (Math.PI / 4);

    // --- Rotate to face movement direction (handled by behavior) ---
    if (this.behavior && this.behavior.lastMoveAngle !== undefined) {
      this.rotation.y = this.behavior.lastMoveAngle;
    }

    // Behavior update (position, wandering, etc)
    if (this.behavior) this.behavior.update(dt);

    // Highlight color if needed
    this.bodyMat.emissive.setRGB(this._highlight ? 0.32 : 0, this._highlight ? 0.22 : 0, this._highlight ? 0.34 : 0);
    this.bodyMat.emissiveIntensity = this._highlight ? 0.24 : 0;
  }

  setStretch(amt = 1.0) {
    this.stretchTarget = THREE.MathUtils.clamp(amt, 0.9, 1.37);
  }
  
  
  /**
 * Poof into a smoke cloud, then teleport to a new random spot inside the pen.
 */
	/**
 * Poof into a smoke cloud at the click spot, then teleport to a new random spot inside the pen.
 */
	poofAndTeleport() {
	  // Get the current world position of the fairy's body mesh
	  const poofOrigin = new THREE.Vector3();
	  this.bodyMesh.getWorldPosition(poofOrigin);

	  // 1. Spawn a smoke cloud effect at original position
	  const cloudCount = 18 + Math.floor(Math.random() * 8);
	  for (let i = 0; i < cloudCount; ++i) {
		const angle = Math.random() * Math.PI * 2;
		const radius = 0.12 + Math.random() * 0.22;
		const offset = new THREE.Vector3(
		  Math.cos(angle) * radius,
		  (Math.random() - 0.5) * 0.19,
		  Math.sin(angle) * radius
		);
		const cloud = new THREE.Mesh(
		  new THREE.SphereGeometry(0.10 + Math.random() * 0.09, 12, 9),
		  new THREE.MeshStandardMaterial({
			color: 0xeaefff,
			transparent: true,
			opacity: 0.43 + Math.random() * 0.26,
			metalness: 0.13,
			roughness: 0.52,
			emissive: 0xffffff,
			emissiveIntensity: 0.33 + Math.random() * 0.25,
			depthWrite: false
		  })
		);
		cloud.position.copy(poofOrigin).add(offset);
		cloud.position.y += 0.14 + Math.random() * 0.13;
		// Add to top-level scene
		let root = this;
		while (root.parent) root = root.parent;
		if (root && root.isScene) {
		  root.add(cloud);
		} else {
		  this.parent.add(cloud);
		}

		// Animate: fade out and scale up, then remove
		const startScale = cloud.scale.clone();
		const DURATION = 0.5 + Math.random() * 0.3;
		let start = null;
		const animateCloud = (now) => {
		  if (!start) start = now;
		  const elapsed = (now - start) / 1000;
		  const t = Math.min(1, elapsed / DURATION);

		  cloud.material.opacity = Math.max(0, (0.7 - t * 0.8));
		  cloud.scale.copy(startScale).multiplyScalar(1 + t * 1.1);

		  if (t < 1) {
			requestAnimationFrame(animateCloud);
		  } else {
			if (cloud.parent) cloud.parent.remove(cloud);
			cloud.geometry.dispose();
			cloud.material.dispose();
		  }
		};
		requestAnimationFrame(animateCloud);
	  }

	  // 2. After a short delay, teleport fairy to a new random spot in the pen
	  setTimeout(() => {
		// Use FairyBehavior's randomTarget to get a new position
		const target = this.behavior.randomTarget();
		this.position.copy(target);
		this.behavior.target = this.behavior.randomTarget(); // New wander target after teleport
		this.behavior.velocity.set(0, 0, 0); // Stop velocity on teleport
	  }, 180);
	}




  sparkleBurst() {
	  // Big, party-sized, cloud sparkle!
	  const SPARKLE_COUNT = 48; // Big cloud!
	  const BASE_RADIUS = 0.36; // How far from the fairy
	  const RADIUS_VARIANCE = 0.44; // Adds randomness for cloud look
	  const SIZE_MIN = 0.09;
	  const SIZE_MAX = 0.18;
	  const DURATION = 1.2; // Seconds

	  for (let i = 0; i < SPARKLE_COUNT; ++i) {
		// Place sparkles in a large ball around the fairy
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);
		const r = BASE_RADIUS + Math.random() * RADIUS_VARIANCE;
		const sparkle = new THREE.Mesh(
		  new THREE.SphereGeometry(SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN), 10, 8),
		  new THREE.MeshStandardMaterial({
			color: new THREE.Color().setHSL(Math.random(), 0.55 + Math.random() * 0.4, 0.66 + Math.random() * 0.33),
			transparent: true,
			opacity: 0.97,
			emissive: 0xffffff,
			emissiveIntensity: 0.9 + Math.random() * 0.7,
			metalness: 0.44,
			roughness: 0.35
		  })
		);
		// Spherical placement
		sparkle.position.copy(this.bodyMesh.position);
		sparkle.position.x += Math.sin(phi) * Math.cos(theta) * r;
		sparkle.position.y += Math.cos(phi) * r + 0.08; // slight lift
		sparkle.position.z += Math.sin(phi) * Math.sin(theta) * r;
		sparkle.scale.multiplyScalar(1.3 + Math.random() * 0.5);

		this.add(sparkle);

		// Animate fade-out, expansion, and removal
		const initialScale = sparkle.scale.clone();
		const fade = (elapsed = 0) => {
		  const t = elapsed / DURATION;
		  sparkle.material.opacity = Math.max(0, 0.97 - t * 1.15);
		  sparkle.scale.copy(initialScale).multiplyScalar(1 + t * 2.1); // get much bigger
		  if (elapsed < DURATION) {
			requestAnimationFrame(() => fade(elapsed + 1 / 60));
		  } else {
			this.remove(sparkle);
		  }
		};
		fade();
	  }
	}


  setHighlight(on) {
    this._highlight = !!on;
  }
  
  sparkle() {
  if (this.behavior && typeof this.behavior.sparkle === 'function') {
    this.behavior.sparkle();
  }
}
}
