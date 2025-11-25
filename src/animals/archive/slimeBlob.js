import * as THREE from 'three';
import { SlimeBehavior } from '../behavior/slimeBehavior.js';

function randomColor() {
  const h = Math.random();
  const s = 0.55 + Math.random() * 0.35;
  const l = 0.58 + Math.random() * 0.36;
  return new THREE.Color().setHSL(h, s, l);
}

export class SlimeBlob extends THREE.Group {
  constructor(opts = {}) {
    super();

    // --- Options ---
    const color = opts.color ?? 0x39ed7b;
    const eyeColor = opts.eyeColor ?? 0x2a2a2a;
    const scleraColor = opts.scleraColor ?? 0xffffff;
    const scale = opts.scale ?? 1.0;
    this.baseColor = new THREE.Color(color);
    this.irisColor = new THREE.Color(eyeColor);

    // --- Body mesh (wiggle anim, morphing) ---
    const geo = new THREE.SphereGeometry(0.75, 36, 26);
    this.material = new THREE.MeshStandardMaterial({
      color: this.baseColor,
      roughness: 0.22,
      metalness: 0.14,
      transparent: true,
      opacity: 0.93,
      emissive: 0x2cfa7c,
      emissiveIntensity: 0.08
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);
    this.scale.set(scale, scale, scale);

    // --- Save original vertices for morphing ---
    this.originalVerts = geo.attributes.position.array.slice();
    this.geo = geo;

    // --- Eyes ---
    this.eyes = [];
    for (let i = -1; i <= 1; i += 2) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 10),
        new THREE.MeshStandardMaterial({ color: scleraColor })
      );
      eye.position.set(i * 0.26, 0.22, 0.68);

      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 10, 8),
        new THREE.MeshStandardMaterial({ color: this.irisColor })
      );
      iris.position.set(0, 0, 0.085);
      eye.add(iris);

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.027, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x101010 })
      );
      pupil.position.set(0, 0, 0.032);
      iris.add(pupil);

      this.mesh.add(eye);
      this.eyes.push({ eye, iris, pupil });
    }

    // --- Behavior (wanders, rotates to travel) ---
    this.behavior = new SlimeBehavior(this, { penBounds: opts.penBounds });

    // --- State/animation vars ---
    this.t = 0;
    this.isCelebrating = false;
    this.celebrateTime = 0;
    this.celebrateColors = [randomColor(), randomColor(), randomColor()];
    this.celebrateColorIndex = 0;
    this.celebrateColorLerp = 0;
    this.blinkT = Math.random() * 2.0;
    this.eyeOpen = 1.0;
    this._highlight = false;

    // --- Actual 3D position: initialize (XZ wander) ---
    const pos = opts.position ?? { x: 0, y: 0.5, z: 0 };
    this.position.set(pos.x, pos.y, pos.z);

    this.mesh.userData.parentSlime = this;
    this.enablePointerEvents();
    this.name = "SlimeBlob";
  }

  /** Animation update, call every frame. */
  update(dt = 1 / 60) {
    this.t += dt;

    // Animate vertex "jiggle/wobble"
    const geo = this.geo;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; ++i) {
      const ox = this.originalVerts[i * 3];
      const oy = this.originalVerts[i * 3 + 1];
      const oz = this.originalVerts[i * 3 + 2];
      const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const theta = Math.atan2(oy, ox);
      const phi = Math.atan2(Math.sqrt(ox * ox + oy * oy), oz);
      let wiggle = 1 + 0.10 * Math.sin(this.t * 1.1 + theta * 2 + phi * 2.8)
                      + 0.035 * Math.sin(this.t * 4.1 + phi * 7.4 + i)
                      + 0.02 * Math.cos(this.t * 3.9 + theta * 3 - phi * 3);
      if (this.isCelebrating) {
        wiggle += 0.13 * Math.sin(this.celebrateTime * 9.1 + phi * 6);
      }
      pos.setXYZ(i, ox * wiggle, oy * wiggle, oz * wiggle);
    }
    pos.needsUpdate = true;

    // Animate hover highlight by color
    if (this._highlight) {
      this.material.emissive.setRGB(0.24, 0.38, 0.18);
      this.material.emissiveIntensity = 0.38 + Math.sin(this.t * 8) * 0.14;
    } else {
      this.material.emissive.setRGB(0, 0, 0);
      this.material.emissiveIntensity = 0;
    }

    // Animate eyes (blinking)
    this.blinkT += dt;
    if (this.blinkT > 2.1 + Math.random() * 2.1 && this.eyeOpen === 1.0) {
      this.eyeOpen = 0.0;
      this.blinkT = 0;
    }
    if (this.eyeOpen < 1.0) {
      this.eyeOpen += dt * 5.4;
      if (this.eyeOpen > 1.0) this.eyeOpen = 1.0;
    }
    for (const { eye, iris } of this.eyes) {
      eye.scale.y = iris.scale.y = this.eyeOpen;
    }

    // --- Animate celebration (bounce, color flash through multiple colors) ---
    if (this.isCelebrating) {
      this.celebrateTime += dt;
      this.mesh.position.y = 0.78 + Math.abs(Math.sin(this.celebrateTime * 7.4)) * 0.23;
      this.celebrateColorLerp += dt * 1.55;
      if (this.celebrateColorLerp >= 1.0) {
        this.celebrateColorLerp = 0;
        this.celebrateColorIndex = (this.celebrateColorIndex + 1) % this.celebrateColors.length;
        if (Math.random() < 0.36) {
          this.celebrateColors[this.celebrateColorIndex] = randomColor();
        }
      }
      const colA = this.celebrateColors[this.celebrateColorIndex];
      const colB = this.celebrateColors[(this.celebrateColorIndex + 1) % this.celebrateColors.length];
      this.material.color.lerpColors(colA, colB, this.celebrateColorLerp);

      if (this.celebrateTime > 2.0) {
        this.isCelebrating = false;
        this.celebrateTime = 0;
        this.material.color.copy(this.baseColor);
        this.mesh.position.y = 0.78;
      }
    }

    // Animate eyes (iris randomly "looks around")
    const lookX = Math.sin(this.t * 0.46) * 0.02;
    const lookY = Math.cos(this.t * 0.53) * 0.015;
    for (const { iris } of this.eyes) {
      iris.position.x += (lookX - iris.position.x) * 0.22;
      iris.position.y += (lookY - iris.position.y) * 0.22;
    }

    // Run slime behavior (movement, facing, and idle handled there)
    if (this.behavior) this.behavior.update(dt);
  }

  celebrate() {
    this.isCelebrating = true;
    this.celebrateTime = 0;
    this.celebrateColors = [randomColor(), randomColor(), randomColor()];
    this.celebrateColorIndex = 0;
    this.celebrateColorLerp = 0;
  }

  enablePointerEvents() {
    const mesh = this.mesh;
    if (!mesh.userData._pointerHandlerSet) {
      mesh.userData._pointerHandlerSet = true;
      // You can wire up your global click logic here.
    }
  }

  setHighlight(on) {
    this._highlight = !!on;
  }
}
