// src/animals/Elephant/ElephantModule.js

import * as THREE from 'three';
import { ElephantCreature } from './ElephantCreature.js';
import { ElephantDefinition } from './ElephantDefinition.js';

const DEFAULT_Y_OFFSET = 1.37; // padHeight (0.17) + elephant base height (~1.2)

const LIMB_KEYS = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];

function getNumber(value, fallback) {
  return typeof value === 'number' ? value : fallback;
}

function applyTransform(creature, tuning) {
  if (!creature) return;
  const scale = getNumber(tuning['global.scale'], tuning.scale);
  const rotationY = getNumber(tuning['global.rotateY'], tuning.rotationY);

  if (typeof scale === 'number') {
    creature.scale.setScalar(scale);
  }
  if (typeof rotationY === 'number') {
    creature.rotation.y = rotationY;
  }
}

function cloneDefinition(definition) {
  return {
    bones: definition.bones.map((bone) => ({ ...bone, position: [...bone.position] })),
    sizes: { ...definition.sizes }
  };
}

function applyScaleToBone(bones, name, scale) {
  if (!bones || !name || !scale || scale === 1) return;
  const bone = bones.find((b) => b.name === name);
  if (!bone || !Array.isArray(bone.position)) return;
  bone.position = bone.position.map((v) => v * scale);
}

function buildDefinitionForSkeleton(tuning) {
  const def = cloneDefinition(ElephantDefinition);

  const frontUpper = getNumber(tuning['skeleton.front.upperLenScale'], 1);
  const frontLower = getNumber(tuning['skeleton.front.lowerLenScale'], 1);
  const frontFoot = getNumber(tuning['skeleton.front.footLenScale'], 1);

  applyScaleToBone(def.bones, 'front_left_upper', frontUpper);
  applyScaleToBone(def.bones, 'front_right_upper', frontUpper);
  applyScaleToBone(def.bones, 'front_left_lower', frontLower);
  applyScaleToBone(def.bones, 'front_right_lower', frontLower);
  applyScaleToBone(def.bones, 'front_left_foot', frontFoot);
  applyScaleToBone(def.bones, 'front_right_foot', frontFoot);

  const backUpper = getNumber(tuning['skeleton.back.upperLenScale'], 1);
  const backLower = getNumber(tuning['skeleton.back.lowerLenScale'], 1);
  const backFoot = getNumber(tuning['skeleton.back.footLenScale'], 1);

  applyScaleToBone(def.bones, 'back_left_upper', backUpper);
  applyScaleToBone(def.bones, 'back_right_upper', backUpper);
  applyScaleToBone(def.bones, 'back_left_lower', backLower);
  applyScaleToBone(def.bones, 'back_right_lower', backLower);
  applyScaleToBone(def.bones, 'back_left_foot', backFoot);
  applyScaleToBone(def.bones, 'back_right_foot', backFoot);

  const spineLen = getNumber(tuning['skeleton.spineLenScale'], 1);
  applyScaleToBone(def.bones, 'spine_tail', spineLen);
  applyScaleToBone(def.bones, 'spine_mid', spineLen);

  const neckLen = getNumber(tuning['skeleton.neckLenScale'], 1);
  applyScaleToBone(def.bones, 'spine_neck', neckLen);
  applyScaleToBone(def.bones, 'spine_head', neckLen);

  const headScale = getNumber(tuning['skeleton.headScale'], 1);
  applyScaleToBone(def.bones, 'head', headScale);
  applyScaleToBone(def.bones, 'head_tip_1', headScale);
  applyScaleToBone(def.bones, 'head_tip_2', headScale);
  applyScaleToBone(def.bones, 'head_tip_3', headScale);
  applyScaleToBone(def.bones, 'head_tip_4', headScale);

  const trunkScale = getNumber(tuning['skeleton.trunkLenScale'], 1);
  applyScaleToBone(def.bones, 'trunk_anchor', trunkScale);
  applyScaleToBone(def.bones, 'trunk_root', trunkScale);
  applyScaleToBone(def.bones, 'trunk_base', trunkScale);
  applyScaleToBone(def.bones, 'trunk_mid1', trunkScale);
  applyScaleToBone(def.bones, 'trunk_mid2', trunkScale);
  applyScaleToBone(def.bones, 'trunk_tip', trunkScale);

  return def;
}

function buildLimbMeshConfig(tuning) {
  const limbDefaults = {
    frontLeft: {
      upperRadius: 0.5,
      kneeRadius: 0.45,
      ankleRadius: 0.4,
      footRadius: 0.38,
      footFlare: 0.43
    },
    frontRight: {
      upperRadius: 0.5,
      kneeRadius: 0.45,
      ankleRadius: 0.4,
      footRadius: 0.38,
      footFlare: 0.43
    },
    backLeft: {
      upperRadius: 0.55,
      kneeRadius: 0.5,
      ankleRadius: 0.42,
      footRadius: 0.38,
      footFlare: 0.44
    },
    backRight: {
      upperRadius: 0.55,
      kneeRadius: 0.5,
      ankleRadius: 0.42,
      footRadius: 0.38,
      footFlare: 0.44
    }
  };

  const limbs = {};
  for (const limb of LIMB_KEYS) {
    const defaults = limbDefaults[limb];
    limbs[limb] = {
      upperRadius: getNumber(tuning[`limbMesh.${limb}.upperRadius`], defaults.upperRadius),
      kneeRadius: getNumber(tuning[`limbMesh.${limb}.kneeRadius`], defaults.kneeRadius),
      ankleRadius: getNumber(tuning[`limbMesh.${limb}.ankleRadius`], defaults.ankleRadius),
      footRadius: getNumber(tuning[`limbMesh.${limb}.footRadius`], defaults.footRadius),
      footFlare: getNumber(tuning[`limbMesh.${limb}.footFlare`], defaults.footFlare)
    };
  }

  return {
    ringsPerSegment: Math.max(3, Math.round(getNumber(tuning['limbMesh.ringsPerSegment'], 5))),
    sides: getNumber(tuning['limbMesh.sides'], 9),
    ringBias: getNumber(tuning['limbMesh.ringBias'], 0),
    startT: Math.min(
      THREE.MathUtils.clamp(getNumber(tuning['limbMesh.startT'], 0), 0, 1),
      THREE.MathUtils.clamp(getNumber(tuning['limbMesh.endT'], 1), 0, 1)
    ),
    endT: Math.max(
      THREE.MathUtils.clamp(getNumber(tuning['limbMesh.startT'], 0), 0, 1),
      THREE.MathUtils.clamp(getNumber(tuning['limbMesh.endT'], 1), 0, 1)
    ),
    limbs
  };
}

function buildRingsConfig(tuning) {
  const limbs = {};
  for (const limb of LIMB_KEYS) {
    limbs[limb] = {
      radiusScale: getNumber(tuning[`debugRings.${limb}.radiusScale`], 1),
      count: getNumber(tuning[`debugRings.${limb}.count`], 6),
      startT: getNumber(tuning[`debugRings.${limb}.startT`], 0),
      endT: getNumber(tuning[`debugRings.${limb}.endT`], 1),
      bias: getNumber(tuning[`debugRings.${limb}.bias`], 0),
      offsetX: getNumber(tuning[`debugRings.${limb}.offsetX`], 0),
      offsetY: getNumber(tuning[`debugRings.${limb}.offsetY`], 0),
      offsetZ: getNumber(tuning[`debugRings.${limb}.offsetZ`], 0)
    };
  }

  return {
    enabled: Boolean(tuning['debugRings.enabled']),
    global: {
      radiusScale: getNumber(tuning['debugRings.global.radiusScale'], 1),
      thickness: getNumber(tuning['debugRings.global.thickness'], 0.04),
      offsetX: getNumber(tuning['debugRings.global.offsetX'], 0),
      offsetY: getNumber(tuning['debugRings.global.offsetY'], 0),
      offsetZ: getNumber(tuning['debugRings.global.offsetZ'], 0),
      opacity: getNumber(tuning['debugRings.global.opacity'], 0.7)
    },
    limbs
  };
}

function disposeCreature(creature) {
  if (!creature) return;
  creature.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose?.();
    }
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => mat.dispose?.());
      } else {
        node.material.dispose?.();
      }
    }
  });
}

export const ElephantModule = {
  id: 'elephant',
  label: 'Elephant',

  build({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const ringsOverlay = buildRingsConfig(merged);
    const scale = getNumber(merged['global.scale'], merged.scale);
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;
    const limbMesh = buildLimbMeshConfig(merged);
    const definition = buildDefinitionForSkeleton(merged);

    const creature = new ElephantCreature({
      scale,
      showSkeleton,
      debug: merged.debug,
      lowPoly: merged.lowPoly,
      bodyColor: merged.bodyColor,
      variantSeed: merged.variantSeed,
      debugRings: ringsOverlay,
      limbMesh,
      headScale: getNumber(merged['skeleton.headScale'], 1),
      definition
    });

    creature.position.set(0, DEFAULT_Y_OFFSET, 0);
    applyTransform(creature, merged);

    return {
      root: creature,
      update: (dt) => creature.update?.(dt),
      dispose: () => disposeCreature(creature)
    };
  },

  getDefaultTuning() {
    const base = {
      'global.scale': 0.75,
      'global.rotateY': Math.PI * 0.1,
      'debug.showSkeleton': false,
      'debugRings.enabled': false,
      'debugRings.global.radiusScale': 1,
      'debugRings.global.thickness': 0.04,
      'debugRings.global.offsetX': 0,
      'debugRings.global.offsetY': 0,
      'debugRings.global.offsetZ': 0,
      'debugRings.global.opacity': 0.7,
      'skeleton.front.upperLenScale': 1,
      'skeleton.front.lowerLenScale': 1,
      'skeleton.front.footLenScale': 1,
      'skeleton.back.upperLenScale': 1,
      'skeleton.back.lowerLenScale': 1,
      'skeleton.back.footLenScale': 1,
      'skeleton.spineLenScale': 1,
      'skeleton.neckLenScale': 1,
      'skeleton.headScale': 1,
      'skeleton.trunkLenScale': 1,
      'limbMesh.ringsPerSegment': 5,
      'limbMesh.sides': 9,
      'limbMesh.ringBias': 0,
      'limbMesh.startT': 0,
      'limbMesh.endT': 1,
      'limbMesh.frontLeft.upperRadius': 0.5,
      'limbMesh.frontLeft.kneeRadius': 0.45,
      'limbMesh.frontLeft.ankleRadius': 0.4,
      'limbMesh.frontLeft.footRadius': 0.38,
      'limbMesh.frontLeft.footFlare': 0.43,
      'limbMesh.frontRight.upperRadius': 0.5,
      'limbMesh.frontRight.kneeRadius': 0.45,
      'limbMesh.frontRight.ankleRadius': 0.4,
      'limbMesh.frontRight.footRadius': 0.38,
      'limbMesh.frontRight.footFlare': 0.43,
      'limbMesh.backLeft.upperRadius': 0.55,
      'limbMesh.backLeft.kneeRadius': 0.5,
      'limbMesh.backLeft.ankleRadius': 0.42,
      'limbMesh.backLeft.footRadius': 0.38,
      'limbMesh.backLeft.footFlare': 0.44,
      'limbMesh.backRight.upperRadius': 0.55,
      'limbMesh.backRight.kneeRadius': 0.5,
      'limbMesh.backRight.ankleRadius': 0.42,
      'limbMesh.backRight.footRadius': 0.38,
      'limbMesh.backRight.footFlare': 0.44,
      debug: false,
      lowPoly: true,
      bodyColor: undefined,
      variantSeed: undefined,
      // Legacy keys kept for compatibility with existing presets.
      scale: 0.75,
      rotationY: Math.PI * 0.1,
      showSkeleton: false
    };

    for (const limb of LIMB_KEYS) {
      base[`debugRings.${limb}.radiusScale`] = 1;
      base[`debugRings.${limb}.count`] = 6;
      base[`debugRings.${limb}.startT`] = 0;
      base[`debugRings.${limb}.endT`] = 1;
      base[`debugRings.${limb}.bias`] = 0;
      base[`debugRings.${limb}.offsetX`] = 0;
      base[`debugRings.${limb}.offsetY`] = 0;
      base[`debugRings.${limb}.offsetZ`] = 0;
    }

    return base;
  },

  getTuningSchema() {
    const limbLabels = {
      frontLeft: 'Front Left',
      frontRight: 'Front Right',
      backLeft: 'Back Left',
      backRight: 'Back Right'
    };

    const schema = {
      'global.scale': { min: 0.5, max: 1.2, step: 0.01, label: 'Global Scale' },
      'global.rotateY': {
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        label: 'Rotate Y'
      },
      lowPoly: { type: 'boolean', label: 'Low Poly' },
      'debug.showSkeleton': { type: 'boolean', label: 'Show Skeleton' },
      'debugRings.enabled': { type: 'boolean', label: 'Rings: Enabled' },
      'debugRings.global.radiusScale': {
        min: 0.25,
        max: 2,
        step: 0.01,
        label: 'Rings Radius ×'
      },
      'debugRings.global.thickness': {
        min: 0.005,
        max: 0.3,
        step: 0.005,
        label: 'Rings Thickness'
      },
      'debugRings.global.offsetX': {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: 'Rings Offset X'
      },
      'debugRings.global.offsetY': {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: 'Rings Offset Y'
      },
      'debugRings.global.offsetZ': {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: 'Rings Offset Z'
      },
      'debugRings.global.opacity': {
        min: 0.1,
        max: 1,
        step: 0.01,
        label: 'Rings Opacity'
      },
      'skeleton.front.upperLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Front Upper Len ×',
        group: 'Skeleton / Front Legs'
      },
      'skeleton.front.lowerLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Front Lower Len ×',
        group: 'Skeleton / Front Legs'
      },
      'skeleton.front.footLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Front Foot Len ×',
        group: 'Skeleton / Front Legs'
      },
      'skeleton.back.upperLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Back Upper Len ×',
        group: 'Skeleton / Back Legs'
      },
      'skeleton.back.lowerLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Back Lower Len ×',
        group: 'Skeleton / Back Legs'
      },
      'skeleton.back.footLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Back Foot Len ×',
        group: 'Skeleton / Back Legs'
      },
      'skeleton.spineLenScale': {
        min: 0.5,
        max: 1.5,
        step: 0.01,
        label: 'Spine Len ×',
        group: 'Skeleton / Body'
      },
      'skeleton.neckLenScale': {
        min: 0.5,
        max: 1.5,
        step: 0.01,
        label: 'Neck Len ×',
        group: 'Skeleton / Body'
      },
      'skeleton.headScale': {
        min: 0.6,
        max: 1.6,
        step: 0.01,
        label: 'Head Scale',
        group: 'Skeleton / Body'
      },
      'skeleton.trunkLenScale': {
        min: 0.5,
        max: 1.6,
        step: 0.01,
        label: 'Trunk Len ×',
        group: 'Skeleton / Body'
      },
      'limbMesh.ringsPerSegment': {
        type: 'int',
        min: 3,
        max: 32,
        step: 1,
        label: 'Limb Rings/Segment',
        group: 'Limb Mesh'
      },
      'limbMesh.sides': {
        type: 'int',
        min: 6,
        max: 40,
        step: 1,
        label: 'Limb Radial Sides',
        group: 'Limb Mesh'
      },
      'limbMesh.ringBias': {
        min: -1,
        max: 1,
        step: 0.05,
        label: 'Limb Ring Bias',
        group: 'Limb Mesh'
      },
      'limbMesh.startT': {
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Limb Ring Start T',
        group: 'Limb Mesh'
      },
      'limbMesh.endT': {
        min: 0,
        max: 1,
        step: 0.01,
        label: 'Limb Ring End T',
        group: 'Limb Mesh'
      }
    };

    for (const limb of LIMB_KEYS) {
      const label = limbLabels[limb];
      schema[`debugRings.${limb}.radiusScale`] = {
        min: 0.25,
        max: 2,
        step: 0.01,
        label: `${label} Radius ×`
      };
      schema[`debugRings.${limb}.count`] = {
        min: 0,
        max: 24,
        step: 1,
        label: `${label} Count`
      };
      schema[`debugRings.${limb}.startT`] = {
        min: 0,
        max: 1,
        step: 0.01,
        label: `${label} Start T`
      };
      schema[`debugRings.${limb}.endT`] = {
        min: 0,
        max: 1,
        step: 0.01,
        label: `${label} End T`
      };
      schema[`debugRings.${limb}.bias`] = {
        min: -1,
        max: 1,
        step: 0.05,
        label: `${label} Bias`
      };
      schema[`debugRings.${limb}.offsetX`] = {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: `${label} Offset X`
      };
      schema[`debugRings.${limb}.offsetY`] = {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: `${label} Offset Y`
      };
      schema[`debugRings.${limb}.offsetZ`] = {
        min: -0.5,
        max: 0.5,
        step: 0.01,
        label: `${label} Offset Z`
      };

      schema[`limbMesh.${limb}.upperRadius`] = {
        min: 0.2,
        max: 1,
        step: 0.01,
        label: `${label} Upper Radius`,
        group: `Limb Mesh / ${label}`
      };
      schema[`limbMesh.${limb}.kneeRadius`] = {
        min: 0.2,
        max: 1,
        step: 0.01,
        label: `${label} Knee Radius`,
        group: `Limb Mesh / ${label}`
      };
      schema[`limbMesh.${limb}.ankleRadius`] = {
        min: 0.2,
        max: 1,
        step: 0.01,
        label: `${label} Ankle Radius`,
        group: `Limb Mesh / ${label}`
      };
      schema[`limbMesh.${limb}.footRadius`] = {
        min: 0.2,
        max: 1,
        step: 0.01,
        label: `${label} Foot Radius`,
        group: `Limb Mesh / ${label}`
      };
      schema[`limbMesh.${limb}.footFlare`] = {
        min: 0.2,
        max: 1.4,
        step: 0.01,
        label: `${label} Foot Flare`,
        group: `Limb Mesh / ${label}`
      };
    }

    return schema;
  },

  applyTuning(animalInstance, tuning) {
    if (!animalInstance || !animalInstance.root) return;
    const merged = { ...this.getDefaultTuning(), ...tuning };
    applyTransform(animalInstance.root, merged);
    if (animalInstance.root.position.y === 0) {
      animalInstance.root.position.y = DEFAULT_Y_OFFSET;
    }
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;
    if (typeof animalInstance.root.setSkeletonVisible === 'function') {
      animalInstance.root.setSkeletonVisible(Boolean(showSkeleton));
    }
    if (animalInstance.root.ringsOverlay) {
      const ringsOverlay = buildRingsConfig(merged);
      animalInstance.root.ringsOverlay.updateConfig(ringsOverlay);
    }
  },

  shouldRebuildOnChange(key) {
    if (!key) return false;
    return (
      key.startsWith('skeleton.') ||
      key.startsWith('limbMesh.') ||
      key === 'lowPoly' ||
      key === 'bodyColor'
    );
  },

  rebuild({ tuning = {}, existing } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };
    const definition = buildDefinitionForSkeleton(merged);
    const limbMesh = buildLimbMeshConfig(merged);
    const ringsOverlay = buildRingsConfig(merged);
    const scale = getNumber(merged['global.scale'], merged.scale);
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;

    try {
      const creature = new ElephantCreature({
        scale,
        showSkeleton,
        debug: merged.debug,
        lowPoly: merged.lowPoly,
        bodyColor: merged.bodyColor,
        variantSeed: merged.variantSeed,
        debugRings: ringsOverlay,
        limbMesh,
        headScale: getNumber(merged['skeleton.headScale'], 1),
        definition
      });

      creature.position.set(0, DEFAULT_Y_OFFSET, 0);
      applyTransform(creature, merged);

      const instance = {
        root: creature,
        update: (dt) => creature.update?.(dt),
        dispose: () => disposeCreature(creature)
      };

      hideRebuildError();
      return instance;
    } catch (err) {
      console.error('[Elephant] Rebuild failed', err);
      showRebuildError('Elephant rebuild failed. Check console for details.');
      return null;
    }
  }
};

function ensureErrorOverlay() {
  let overlay = document.getElementById('zoo-error-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'zoo-error-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '16px';
    overlay.style.left = '16px';
    overlay.style.padding = '10px 14px';
    overlay.style.background = 'rgba(200,40,40,0.9)';
    overlay.style.color = '#fff';
    overlay.style.borderRadius = '6px';
    overlay.style.zIndex = '2000';
    overlay.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showRebuildError(message) {
  const overlay = ensureErrorOverlay();
  overlay.textContent = message;
  overlay.style.display = 'block';
}

function hideRebuildError() {
  const overlay = document.getElementById('zoo-error-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}
