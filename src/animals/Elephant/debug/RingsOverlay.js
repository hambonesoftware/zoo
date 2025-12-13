// src/animals/Elephant/debug/RingsOverlay.js
import * as THREE from 'three';
import { ElephantDefinition } from '../ElephantDefinition.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function biasT(t, bias) {
  if (!bias) return t;
  const magnitude = Math.abs(bias);
  // Steepen the curve as bias moves away from 0. Values >0 push toward 1, <0 toward 0.
  const exponent = 1 + magnitude * 4;
  if (bias > 0) {
    return Math.pow(t, exponent);
  }
  return 1 - Math.pow(1 - t, exponent);
}

function averageRadius(...vectors) {
  const values = vectors.map((v) => Array.isArray(v) && v.length ? v[0] : 0);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const LIMB_CONFIG = {
  frontLeft: {
    start: 'front_left_upper',
    end: 'front_left_foot',
    baseRadius: averageRadius(
      ElephantDefinition.sizes.front_left_upper,
      ElephantDefinition.sizes.front_left_lower,
      ElephantDefinition.sizes.front_left_foot
    )
  },
  frontRight: {
    start: 'front_right_upper',
    end: 'front_right_foot',
    baseRadius: averageRadius(
      ElephantDefinition.sizes.front_right_upper,
      ElephantDefinition.sizes.front_right_lower,
      ElephantDefinition.sizes.front_right_foot
    )
  },
  backLeft: {
    start: 'back_left_upper',
    end: 'back_left_foot',
    baseRadius: averageRadius(
      ElephantDefinition.sizes.back_left_upper,
      ElephantDefinition.sizes.back_left_lower,
      ElephantDefinition.sizes.back_left_foot
    )
  },
  backRight: {
    start: 'back_right_upper',
    end: 'back_right_foot',
    baseRadius: averageRadius(
      ElephantDefinition.sizes.back_right_upper,
      ElephantDefinition.sizes.back_right_lower,
      ElephantDefinition.sizes.back_right_foot
    )
  }
};

const DEFAULT_GLOBAL = {
  enabled: false,
  radiusScale: 1,
  thickness: 0.04,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  opacity: 0.7
};

const DEFAULT_LIMB = {
  radiusScale: 1,
  count: 6,
  startT: 0,
  endT: 1,
  bias: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0
};

export class RingsOverlay extends THREE.Group {
  constructor(skeleton) {
    super();
    this.skeleton = skeleton;
    this.boneLookup = new Map();
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff66cc,
      transparent: true,
      opacity: DEFAULT_GLOBAL.opacity,
      depthWrite: false,
      toneMapped: false
    });
    this.baseGeometry = this._createGeometry(DEFAULT_GLOBAL.thickness);
    this.currentThickness = DEFAULT_GLOBAL.thickness;
    this.params = {
      global: { ...DEFAULT_GLOBAL },
      limbs: {
        frontLeft: { ...DEFAULT_LIMB },
        frontRight: { ...DEFAULT_LIMB },
        backLeft: { ...DEFAULT_LIMB },
        backRight: { ...DEFAULT_LIMB }
      }
    };
    this.rings = {
      frontLeft: [],
      frontRight: [],
      backLeft: [],
      backRight: []
    };

    this.tempStart = new THREE.Vector3();
    this.tempEnd = new THREE.Vector3();
    this.tempDir = new THREE.Vector3();
    this.tempPos = new THREE.Vector3();

    this._ensureBoneLookup();
    this.visible = false;
  }

  updateConfig(config = {}) {
    const nextGlobal = { ...DEFAULT_GLOBAL, ...(config.global || {}) };
    this.params.global = nextGlobal;

    for (const limb of Object.keys(this.params.limbs)) {
      this.params.limbs[limb] = {
        ...DEFAULT_LIMB,
        ...(config.limbs && config.limbs[limb] ? config.limbs[limb] : {})
      };
    }

    const enabled = Boolean(config.enabled ?? nextGlobal.enabled);
    this.visible = enabled;

    if (enabled) {
      this._refreshThickness(nextGlobal.thickness);
      this.update();
    }
  }

  update() {
    if (!this.visible) return;

    this.updateMatrixWorld(true);
    const globalOffset = new THREE.Vector3(
      this.params.global.offsetX,
      this.params.global.offsetY,
      this.params.global.offsetZ
    );

    this.ringMaterial.opacity = this.params.global.opacity;

    for (const limbId of Object.keys(LIMB_CONFIG)) {
      this._updateLimb(limbId, globalOffset);
    }
  }

  _updateLimb(limbId, globalOffset) {
    const limbConfig = LIMB_CONFIG[limbId];
    const params = this.params.limbs[limbId] || DEFAULT_LIMB;
    const startBone = this.boneLookup.get(limbConfig.start);
    const endBone = this.boneLookup.get(limbConfig.end);
    if (!startBone || !endBone) return;

    startBone.getWorldPosition(this.tempStart);
    endBone.getWorldPosition(this.tempEnd);

    this.worldToLocal(this.tempStart);
    this.worldToLocal(this.tempEnd);

    this.tempDir.copy(this.tempEnd).sub(this.tempStart);
    const length = this.tempDir.length();
    if (length < 1e-5) return;
    this.tempDir.divideScalar(length);

    const count = Math.max(0, Math.floor(params.count));
    this._ensureRingCount(limbId, count);

    const startT = clamp01(params.startT);
    const endT = clamp01(params.endT);
    const tRange = Math.max(0.0001, endT - startT);

    const limbOffset = new THREE.Vector3(params.offsetX, params.offsetY, params.offsetZ);
    const offset = globalOffset.clone().add(limbOffset);

    const baseRadius = limbConfig.baseRadius;
    const finalRadius = baseRadius * (params.radiusScale ?? 1) * (this.params.global.radiusScale ?? 1);

    const rings = this.rings[limbId];
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const normalized = count <= 1 ? 0.5 : i / Math.max(1, count - 1);
      const biased = biasT(normalized, params.bias);
      const t = startT + biased * tRange;

      this.tempPos.copy(this.tempDir).multiplyScalar(t * length).add(this.tempStart).add(offset);
      ring.position.copy(this.tempPos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.tempDir);
      ring.scale.set(finalRadius, finalRadius, finalRadius);
      ring.visible = true;
    }
  }

  _ensureRingCount(limbId, desiredCount) {
    const rings = this.rings[limbId];
    while (rings.length < desiredCount) {
      const mesh = new THREE.Mesh(this.baseGeometry, this.ringMaterial);
      mesh.renderOrder = 2;
      rings.push(mesh);
      this.add(mesh);
    }
    while (rings.length > desiredCount) {
      const mesh = rings.pop();
      if (mesh) {
        this.remove(mesh);
      }
    }
  }

  _refreshThickness(thickness) {
    const safeThickness = Math.max(0.002, thickness || DEFAULT_GLOBAL.thickness);
    if (Math.abs(safeThickness - this.currentThickness) < 1e-5) return;
    this.currentThickness = safeThickness;
    this.baseGeometry?.dispose?.();
    this.baseGeometry = this._createGeometry(safeThickness);

    for (const limbId of Object.keys(this.rings)) {
      for (const mesh of this.rings[limbId]) {
        mesh.geometry = this.baseGeometry;
      }
    }
  }

  _createGeometry(thickness) {
    const tubeRadius = Math.max(0.002, thickness * 0.5);
    return new THREE.TorusGeometry(1, tubeRadius, 12, 32);
  }

  _ensureBoneLookup() {
    if (!this.skeleton || !this.skeleton.bones) return;
    this.skeleton.bones.forEach((bone) => {
      this.boneLookup.set(bone.name, bone);
    });
  }
}
