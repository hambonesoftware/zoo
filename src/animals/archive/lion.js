// src/creatures/lion.js

import * as THREE from 'three';
import { LionBehavior } from '../behavior/lionBehavior.js';

// Utility for color palettes
function pickLionColors() {
  return {
    body: 0xf9b041,
    belly: 0xfdf4dd,
    mane: 0xbf7d3e,
    nose: 0x84491e,
    paw: 0xfbe3a5,
    ear: 0xecd29b,
    eye: 0xffffff,
    iris: 0x38240c,
  };
}

export class PartyLion extends THREE.Group {
  /**
   * @param {object} opts
   *   - position: {x, y, z}
   *   - scale: number (default 1)
   *   - penBounds: {minX, maxX, minZ, maxZ}
   *   - colors: object (overrides)
   */
  constructor(opts = {}) {
    super();

    const colors = Object.assign(pickLionColors(), opts.colors || {});
    const scale = opts.scale || 1.0;
    const baseY = opts.position?.y ?? 0;

    this.position.set(
      opts.position?.x ?? 0,
      baseY,
      opts.position?.z ?? 0
    );
    this.scale.setScalar(scale);

    // ----- BODY (shorter cavity for cuteness) -----
    const bodyRadius = 0.65;
    const bodyHeight = 0.72; // shorter, was 1.0+
    const bodyGeom = new THREE.CapsuleGeometry(bodyRadius, bodyHeight, 16, 24);
    const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.43, metalness: 0.1 });
    this.body = new THREE.Mesh(bodyGeom, bodyMat);
    this.body.position.set(0, 0.82, 0); // feet at y=0
    this.body.castShadow = true;
    this.add(this.body);

    // ----- BELLY -----
    const bellyGeom = new THREE.SphereGeometry(0.44, 20, 20);
    const bellyMat = new THREE.MeshStandardMaterial({ color: colors.belly, roughness: 0.5, metalness: 0.06 });
    const belly = new THREE.Mesh(bellyGeom, bellyMat);
    belly.position.set(0, 0.58, 0.19);
    belly.scale.y = 0.57;
    belly.castShadow = false;
    this.body.add(belly);

    // ----- HEAD -----
    const headGroup = new THREE.Group();
    this.headGroup = headGroup;
    headGroup.position.set(0, bodyHeight * 0.69 + 0.7, 0.14);
    this.add(headGroup);

    const headRadius = 0.41;
    const headGeom = new THREE.SphereGeometry(headRadius, 24, 20);
    const headMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.35, metalness: 0.09 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.castShadow = true;
    headGroup.add(head);

    // ----- MANE (petal cones, tilted back at 30 deg, not blocking eyes) -----
    const maneGroup = new THREE.Group();
    const maneR = headRadius * 1.07;
    const maneCount = 13;
    const angleBack = THREE.MathUtils.degToRad(32); // tilt back
    for (let i = 0; i < maneCount; ++i) {
      const theta = (i / maneCount) * Math.PI * 2;
      const mx = Math.sin(theta) * maneR;
      const mz = Math.cos(theta) * maneR;
      const petal = new THREE.Mesh(
        new THREE.ConeGeometry(0.17, 0.46, 16, 2),
        new THREE.MeshStandardMaterial({ color: colors.mane, roughness: 0.49 })
      );
      petal.position.set(mx, 0.03, mz);
      // Tilt each petal outward and back
      petal.rotation.x = angleBack;
      petal.lookAt(0, 0.02, 0); // aim at head center
      petal.castShadow = true;
      maneGroup.add(petal);
    }
    maneGroup.position.y = 0.08; // raise so bottom doesn't cover eyes
    headGroup.add(maneGroup);

    // ----- EARS -----
    this.ears = [
      this._makeEar(0.32, 0.15, 0.22, 0.07, colors.ear),
      this._makeEar(-0.32, 0.15, 0.22, 0.07, colors.ear),
    ];
    headGroup.add(this.ears[0], this.ears[1]);

    // ----- FACE/EYES -----
    this.eyes = [
      this._makeEye(0.17, 0.13, 0.39, colors.eye, colors.iris),
      this._makeEye(-0.17, 0.13, 0.39, colors.eye, colors.iris),
    ];
    headGroup.add(this.eyes[0].eye, this.eyes[1].eye);

    // ----- NOSE -----
    const noseGeom = new THREE.SphereGeometry(0.08, 16, 10);
    const noseMat = new THREE.MeshStandardMaterial({ color: colors.nose, roughness: 0.4 });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.set(0, -0.04, 0.43);
    nose.scale.set(1, 0.65, 1.08);
    nose.castShadow = false;
    headGroup.add(nose);

    // ----- LEGS -----
    this.legs = [];
    const pawY = 0.16;
    const legGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.7, 14, 2);
    const pawGeom = new THREE.SphereGeometry(0.16, 13, 10);
    const legYs = [0.33, 0.33, -0.31, -0.31];
    const legXs = [0.28, -0.28, 0.26, -0.26];
    const legZs = [0.32, 0.32, -0.23, -0.23];
    for (let i = 0; i < 4; ++i) {
      const leg = new THREE.Group();
      const bone = new THREE.Mesh(legGeom, bodyMat);
      bone.position.set(0, 0.33, 0);
      bone.castShadow = true;
      const paw = new THREE.Mesh(pawGeom, new THREE.MeshStandardMaterial({ color: colors.paw, roughness: 0.38 }));
      paw.position.set(0, pawY, 0);
      paw.castShadow = true;
      leg.add(bone, paw);
      leg.position.set(legXs[i], 0, legZs[i]);
      this.body.add(leg);
      this.legs.push(leg);
    }

    // ----- TAIL -----
    const tailGroup = new THREE.Group();
    const tailSegGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.48, 8);
    const tailSeg = new THREE.Mesh(tailSegGeom, bodyMat);
    tailSeg.position.y = -0.27;
    tailGroup.add(tailSeg);
    const tailTipGeom = new THREE.SphereGeometry(0.13, 8, 8);
    const tailTip = new THREE.Mesh(tailTipGeom, new THREE.MeshStandardMaterial({ color: colors.mane }));
    tailTip.position.y = -0.51;
    tailGroup.add(tailTip);
    tailGroup.position.set(0, 0.39, -0.7);
    tailGroup.rotation.x = -Math.PI / 5;
    this.body.add(tailGroup);
    this.tail = tailGroup;

    // ----- BEHAVIOR -----
    this.behavior = new LionBehavior(this, {
      walkSpeed: opts.walkSpeed || 1.1,
      penBounds: opts.penBounds,
      confettiBurst: opts.confettiBurst,
    });
  }

  /**
   * Helper to make an ear mesh.
   */
  _makeEar(x, y, z, s, color) {
    const g = new THREE.SphereGeometry(s, 14, 8);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
    const ear = new THREE.Mesh(g, m);
    ear.position.set(x, y, z);
    ear.castShadow = false;
    return ear;
  }

  /**
   * Helper to make an eye mesh with iris.
   * Returns {eye, iris}
   */
  _makeEye(x, y, z, eyeColor, irisColor) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 8),
      new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.17 })
    );
    eye.position.set(x, y, z + 0.015);
    eye.castShadow = false;
    // Iris as a black disk just in front of eye
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 6),
      new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.15 })
    );
    iris.position.set(0, 0, 0.08);
    eye.add(iris);
    return { eye, iris };
  }

  /**
   * Call on each animation frame.
   * @param {number} dt
   */
  update(dt) {
    this.behavior.update(dt);
  }
}
