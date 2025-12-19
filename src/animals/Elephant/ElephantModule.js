// src/animals/Elephant/ElephantModule.js

import * as THREE from 'three';
import { ElephantCreature } from './ElephantCreature.js';
import { ElephantDefinition } from './ElephantDefinition.js';

const DEFAULT_PAD_HEIGHT = 0.2;
const DEFAULT_PEN_RADIUS = 3.5;
const DEFAULT_Y_OFFSET = DEFAULT_PAD_HEIGHT + 1.2; // padHeight (0.2) + elephant base height (~1.2)
const TUNING_SCHEMA_VERSION = '1.1.0';
const BONE_OFFSET_PREFIX = 'boneOffset';

const LIMB_KEYS = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];

const DEFAULT_ENVIRONMENT = {
  enclosureCenter: [0, DEFAULT_PAD_HEIGHT, 0],
  enclosureRadius: DEFAULT_PEN_RADIUS,
  pondCenter: [0, DEFAULT_PAD_HEIGHT, 0],
  pondRadius: 0,
  obstacles: [],
  groundHeight: DEFAULT_PAD_HEIGHT
};

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

function toVector3(value, fallbackY = DEFAULT_PAD_HEIGHT) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3) return new THREE.Vector3(value[0], value[1], value[2]);
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    return new THREE.Vector3(value.x, value.y, value.z);
  }
  return new THREE.Vector3(0, fallbackY, 0);
}

function cloneEnvironment(env = DEFAULT_ENVIRONMENT) {
  const source = env || DEFAULT_ENVIRONMENT;
  const groundHeight = typeof source.groundHeight === 'number' ? source.groundHeight : DEFAULT_PAD_HEIGHT;
  return {
    enclosureCenter: toVector3(source.enclosureCenter, groundHeight),
    enclosureRadius:
      typeof source.enclosureRadius === 'number' ? source.enclosureRadius : DEFAULT_PEN_RADIUS,
    pondCenter: toVector3(source.pondCenter, groundHeight),
    pondRadius: typeof source.pondRadius === 'number' ? source.pondRadius : 0,
    obstacles: Array.isArray(source.obstacles) ? [...source.obstacles] : [],
    groundHeight
  };
}

function getDefaultEnvironment() {
  return cloneEnvironment(DEFAULT_ENVIRONMENT);
}

function applyScaleToBone(bones, name, scale) {
  if (!bones || !name || !scale || scale === 1) return;
  const bone = bones.find((b) => b.name === name);
  if (!bone || !Array.isArray(bone.position)) return;
  bone.position = bone.position.map((v) => v * scale);
}

function applyOffsetToBone(bones, name, offset = {}) {
  if (!bones || !name) return;
  const bone = bones.find((b) => b.name === name);
  if (!bone || !Array.isArray(bone.position)) return;
  const { x = 0, y = 0, z = 0 } = offset;
  bone.position = [
    bone.position[0] + x,
    bone.position[1] + y,
    bone.position[2] + z
  ];
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

  const trunkOffset = {
    x: getNumber(tuning['skeleton.trunkBaseOffsetX'], 0),
    y: getNumber(tuning['skeleton.trunkBaseOffsetY'], 0),
    z: getNumber(tuning['skeleton.trunkBaseOffsetZ'], 0)
  };

  if (trunkOffset.x || trunkOffset.y || trunkOffset.z) {
    applyOffsetToBone(def.bones, 'trunk_anchor', trunkOffset);
    applyOffsetToBone(def.bones, 'trunk_root', trunkOffset);
  }

  const tuskLenScale = getNumber(tuning['tusk.lengthScale'], 1);
  applyScaleToBone(def.bones, 'tusk_left_tip', tuskLenScale);
  applyScaleToBone(def.bones, 'tusk_right_tip', tuskLenScale);

  for (const bone of def.bones) {
    const baseKey = `${BONE_OFFSET_PREFIX}.${bone.name}`;
    const offset = {
      x: getNumber(tuning[`${baseKey}.x`], 0),
      y: getNumber(tuning[`${baseKey}.y`], 0),
      z: getNumber(tuning[`${baseKey}.z`], 0)
    };
    if (offset.x || offset.y || offset.z) {
      applyOffsetToBone(def.bones, bone.name, offset);
    }
  }

  return def;
}

function buildBoneOffsetDefaults(definition) {
  const defaults = {};
  for (const bone of definition.bones) {
    defaults[`${BONE_OFFSET_PREFIX}.${bone.name}.x`] = 0;
    defaults[`${BONE_OFFSET_PREFIX}.${bone.name}.y`] = 0;
    defaults[`${BONE_OFFSET_PREFIX}.${bone.name}.z`] = 0;
  }
  return defaults;
}

function resolveEnvironmentFromExisting(existing) {
  const candidate =
    existing?.behavior?.environment || existing?.root?.behavior?.environment || null;
  return cloneEnvironment(candidate || DEFAULT_ENVIRONMENT);
}

function configureCreatureEnvironment(creature, env, { startWander = false } = {}) {
  if (!creature?.behavior || typeof creature.behavior.configureEnvironment !== 'function') return;
  const environment = cloneEnvironment(env || DEFAULT_ENVIRONMENT);
  creature.behavior.configureEnvironment(environment);

  if (startWander) {
    if (creature.behavior?.locomotion?.setState) {
      creature.behavior.locomotion.setState('wander');
    } else if (typeof creature.behavior.setState === 'function') {
      creature.behavior.setState('wander');
    }
  }
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

function buildTorsoConfig(tuning) {
  return {
    ringsPerSegment: Math.max(0, Math.round(getNumber(tuning['torso.ringsPerSegment'], 0))),
    sides: getNumber(tuning['torso.sides'], 28),
    radiusScale: getNumber(tuning['torso.radiusScale'], 1),
    bulge: getNumber(tuning['torso.bulge'], 0.4)
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

  build({ tuning = {}, soundFontEngine } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const environment = getDefaultEnvironment();
    const ringsOverlay = buildRingsConfig(merged);
    const scale = getNumber(merged['global.scale'], merged.scale);
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;
    const limbMesh = buildLimbMeshConfig(merged);
    const torso = buildTorsoConfig(merged);
    const definition = buildDefinitionForSkeleton(merged);
    const walkInPlace = merged.walkInPlace ?? true;

    const creature = new ElephantCreature({
      scale,
      showSkeleton,
      debug: merged.debug,
      lowPoly: merged.lowPoly,
      bodyColor: merged.bodyColor,
      variantSeed: merged.variantSeed,
      debugRings: ringsOverlay,
      limbMesh,
      torso,
      headScale: getNumber(merged['skeleton.headScale'], 1),
      definition,
      walkInPlace,
      soundFontEngine
    });

    creature.position.set(0, DEFAULT_Y_OFFSET, 0);
    applyTransform(creature, merged);
    configureCreatureEnvironment(creature, environment, { startWander: true });

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
      'skeleton.trunkBaseOffsetX': 0,
      'skeleton.trunkBaseOffsetY': 0,
      'skeleton.trunkBaseOffsetZ': 0,
      'tusk.lengthScale': 1,
      'torso.ringsPerSegment': 0,
      'torso.sides': 28,
      'torso.radiusScale': 1,
      'torso.bulge': 0.4,
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

    return { ...base, ...buildBoneOffsetDefaults(ElephantDefinition) };
  },

  getTuningSchemaVersion() {
    return TUNING_SCHEMA_VERSION;
  },

  getTuningSchema() {
    const defaults = this.getDefaultTuning();
    const limbLabels = {
      frontLeft: 'Front Left',
      frontRight: 'Front Right',
      backLeft: 'Back Left',
      backRight: 'Back Right'
    };

    const GROUP_ORDER = {
      Global: 0,
      Skeleton: 1,
      Bones: 2,
      Torso: 3,
      Trunk: 4,
      Tusks: 5,
      Legs: 6,
      Materials: 7,
      Debug: 8,
      'Debug Rings': 9,
      Advanced: 10
    };

    const make = (key, { label, group = 'Global', order = 0, tier = 'A', type = 'float', groupOrder, ...rest }) => ({
      label,
      group,
      groupOrder,
      order,
      tier,
      type,
      default: defaults[key],
      ...rest
    });

    const schema = {
      'global.scale': make('global.scale', {
        label: 'Global Scale',
        min: 0.5,
        max: 1.2,
        step: 0.01,
        order: 0,
        tier: 'A',
        format: 3
      }),
      'global.rotateY': make('global.rotateY', {
        label: 'Rotate Y',
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        order: 1,
        tier: 'A',
        format: 3
      }),
      lowPoly: make('lowPoly', {
        label: 'Low Poly',
        type: 'boolean',
        group: 'Materials',
        groupOrder: GROUP_ORDER.Materials,
        order: 0,
        tier: 'B'
      }),
      bodyColor: make('bodyColor', {
        label: 'Body Color Hue',
        min: -1,
        max: 1,
        step: 0.01,
        type: 'float',
        group: 'Materials',
        groupOrder: GROUP_ORDER.Materials,
        order: 1,
        tier: 'B',
        format: 2
      }),
      variantSeed: make('variantSeed', {
        label: 'Variant Seed',
        type: 'int',
        min: 0,
        max: 9999,
        step: 1,
        group: 'Advanced',
        groupOrder: GROUP_ORDER.Advanced,
        order: 1,
        tier: 'B',
        advanced: true
      }),
      'debug.showSkeleton': make('debug.showSkeleton', {
        label: 'Show Skeleton',
        type: 'boolean',
        group: 'Debug',
        groupOrder: GROUP_ORDER.Debug,
        order: 0,
        tier: 'A',
        advanced: true
      }),
      'debugRings.enabled': make('debugRings.enabled', {
        label: 'Rings: Enabled',
        type: 'boolean',
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 0,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.radiusScale': make('debugRings.global.radiusScale', {
        label: 'Rings Radius ×',
        min: 0.25,
        max: 2,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 1,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.thickness': make('debugRings.global.thickness', {
        label: 'Rings Thickness',
        min: 0.005,
        max: 0.3,
        step: 0.005,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 2,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.offsetX': make('debugRings.global.offsetX', {
        label: 'Rings Offset X',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 3,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.offsetY': make('debugRings.global.offsetY', {
        label: 'Rings Offset Y',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 4,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.offsetZ': make('debugRings.global.offsetZ', {
        label: 'Rings Offset Z',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 5,
        tier: 'A',
        advanced: true
      }),
      'debugRings.global.opacity': make('debugRings.global.opacity', {
        label: 'Rings Opacity',
        min: 0.1,
        max: 1,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 6,
        tier: 'A',
        advanced: true
      }),
      ...(() => {
        const entries = {};
        const boneLabel = (name) => name.replace(/_/g, ' ');
        for (const bone of ElephantDefinition.bones) {
          const baseKey = `${BONE_OFFSET_PREFIX}.${bone.name}`;
          const baseLabel = boneLabel(bone.name);
          for (const axis of ['x', 'y', 'z']) {
            const key = `${baseKey}.${axis}`;
            entries[key] = make(key, {
              label: `${baseLabel} ${axis.toUpperCase()} Offset`,
              min: -1.5,
              max: 1.5,
              step: 0.01,
              group: 'Bones',
              groupOrder: GROUP_ORDER.Bones,
              order: 400 + Object.keys(entries).length,
              tier: 'B',
              format: 3
            });
          }
        }
        return entries;
      })(),
      'skeleton.spineLenScale': make('skeleton.spineLenScale', {
        label: 'Spine Len ×',
        min: 0.5,
        max: 1.5,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 0,
        tier: 'B'
      }),
      'skeleton.neckLenScale': make('skeleton.neckLenScale', {
        label: 'Neck Len ×',
        min: 0.5,
        max: 1.5,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 1,
        tier: 'B'
      }),
      'skeleton.headScale': make('skeleton.headScale', {
        label: 'Head Scale',
        min: 0.6,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 2,
        tier: 'B'
      }),
      'skeleton.front.upperLenScale': make('skeleton.front.upperLenScale', {
        label: 'Front Upper Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 3,
        tier: 'B'
      }),
      'skeleton.front.lowerLenScale': make('skeleton.front.lowerLenScale', {
        label: 'Front Lower Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 4,
        tier: 'B'
      }),
      'skeleton.front.footLenScale': make('skeleton.front.footLenScale', {
        label: 'Front Foot Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 5,
        tier: 'B'
      }),
      'skeleton.back.upperLenScale': make('skeleton.back.upperLenScale', {
        label: 'Back Upper Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 6,
        tier: 'B'
      }),
      'skeleton.back.lowerLenScale': make('skeleton.back.lowerLenScale', {
        label: 'Back Lower Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 7,
        tier: 'B'
      }),
      'skeleton.back.footLenScale': make('skeleton.back.footLenScale', {
        label: 'Back Foot Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 8,
        tier: 'B'
      }),
      'skeleton.trunkLenScale': make('skeleton.trunkLenScale', {
        label: 'Trunk Len ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Trunk',
        groupOrder: GROUP_ORDER.Trunk,
        order: 0,
        tier: 'B'
      }),
      'skeleton.trunkBaseOffsetX': make('skeleton.trunkBaseOffsetX', {
        label: 'Trunk Offset X',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Trunk',
        groupOrder: GROUP_ORDER.Trunk,
        order: 1,
        tier: 'B'
      }),
      'skeleton.trunkBaseOffsetY': make('skeleton.trunkBaseOffsetY', {
        label: 'Trunk Offset Y',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Trunk',
        groupOrder: GROUP_ORDER.Trunk,
        order: 2,
        tier: 'B'
      }),
      'skeleton.trunkBaseOffsetZ': make('skeleton.trunkBaseOffsetZ', {
        label: 'Trunk Offset Z',
        min: -0.6,
        max: 0.6,
        step: 0.01,
        group: 'Trunk',
        groupOrder: GROUP_ORDER.Trunk,
        order: 3,
        tier: 'B'
      }),
      'torso.ringsPerSegment': make('torso.ringsPerSegment', {
        label: 'Torso Rings/Segment',
        type: 'int',
        min: 0,
        max: 6,
        step: 1,
        group: 'Torso',
        groupOrder: GROUP_ORDER.Torso,
        order: 0,
        tier: 'B'
      }),
      'torso.sides': make('torso.sides', {
        label: 'Torso Sides',
        type: 'int',
        min: 6,
        max: 48,
        step: 1,
        group: 'Torso',
        groupOrder: GROUP_ORDER.Torso,
        order: 1,
        tier: 'B'
      }),
      'torso.radiusScale': make('torso.radiusScale', {
        label: 'Torso Radius ×',
        min: 0.6,
        max: 1.6,
        step: 0.01,
        group: 'Torso',
        groupOrder: GROUP_ORDER.Torso,
        order: 2,
        tier: 'B'
      }),
      'torso.bulge': make('torso.bulge', {
        label: 'Torso Bulge Depth',
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Torso',
        groupOrder: GROUP_ORDER.Torso,
        order: 3,
        tier: 'B'
      }),
      'tusk.lengthScale': make('tusk.lengthScale', {
        label: 'Tusk Length ×',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        group: 'Tusks',
        groupOrder: GROUP_ORDER.Tusks,
        order: 0,
        tier: 'B'
      }),
      'limbMesh.ringsPerSegment': make('limbMesh.ringsPerSegment', {
        label: 'Limb Rings/Segment',
        type: 'int',
        min: 3,
        max: 32,
        step: 1,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 0,
        tier: 'B'
      }),
      'limbMesh.sides': make('limbMesh.sides', {
        label: 'Limb Radial Sides',
        type: 'int',
        min: 6,
        max: 40,
        step: 1,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 1,
        tier: 'B'
      }),
      'limbMesh.ringBias': make('limbMesh.ringBias', {
        label: 'Limb Ring Bias',
        min: -1,
        max: 1,
        step: 0.05,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 2,
        tier: 'B'
      }),
      'limbMesh.startT': make('limbMesh.startT', {
        label: 'Limb Ring Start T',
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 3,
        tier: 'B'
      }),
      'limbMesh.endT': make('limbMesh.endT', {
        label: 'Limb Ring End T',
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 4,
        tier: 'B'
      })
    };

    for (const limb of LIMB_KEYS) {
      const label = limbLabels[limb];
      schema[`debugRings.${limb}.radiusScale`] = make(`debugRings.${limb}.radiusScale`, {
        label: `${label} Radius ×`,
        min: 0.25,
        max: 2,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 10,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.count`] = make(`debugRings.${limb}.count`, {
        label: `${label} Count`,
        min: 0,
        max: 24,
        step: 1,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 11,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.startT`] = make(`debugRings.${limb}.startT`, {
        label: `${label} Start T`,
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 12,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.endT`] = make(`debugRings.${limb}.endT`, {
        label: `${label} End T`,
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 13,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.bias`] = make(`debugRings.${limb}.bias`, {
        label: `${label} Bias`,
        min: -1,
        max: 1,
        step: 0.05,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 14,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.offsetX`] = make(`debugRings.${limb}.offsetX`, {
        label: `${label} Offset X`,
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 15,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.offsetY`] = make(`debugRings.${limb}.offsetY`, {
        label: `${label} Offset Y`,
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 16,
        tier: 'A',
        advanced: true
      });
      schema[`debugRings.${limb}.offsetZ`] = make(`debugRings.${limb}.offsetZ`, {
        label: `${label} Offset Z`,
        min: -0.5,
        max: 0.5,
        step: 0.01,
        group: 'Debug Rings',
        groupOrder: GROUP_ORDER['Debug Rings'],
        order: 17,
        tier: 'A',
        advanced: true
      });

      schema[`limbMesh.${limb}.upperRadius`] = make(`limbMesh.${limb}.upperRadius`, {
        label: `${label} Upper Radius`,
        min: 0.2,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 10,
        tier: 'B'
      });
      schema[`limbMesh.${limb}.kneeRadius`] = make(`limbMesh.${limb}.kneeRadius`, {
        label: `${label} Knee Radius`,
        min: 0.2,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 11,
        tier: 'B'
      });
      schema[`limbMesh.${limb}.ankleRadius`] = make(`limbMesh.${limb}.ankleRadius`, {
        label: `${label} Ankle Radius`,
        min: 0.2,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 12,
        tier: 'B'
      });
      schema[`limbMesh.${limb}.footRadius`] = make(`limbMesh.${limb}.footRadius`, {
        label: `${label} Foot Radius`,
        min: 0.2,
        max: 1,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 13,
        tier: 'B'
      });
      schema[`limbMesh.${limb}.footFlare`] = make(`limbMesh.${limb}.footFlare`, {
        label: `${label} Foot Flare`,
        min: 0.2,
        max: 1.4,
        step: 0.01,
        group: 'Legs',
        groupOrder: GROUP_ORDER.Legs,
        order: 14,
        tier: 'B'
      });
    }

    return schema;
  },

  applyTuning(animalInstance, tuning) {
    if (!animalInstance || !animalInstance.root) return;
    const creature = animalInstance.root;
    const environment = resolveEnvironmentFromExisting(creature);
    const merged = { ...this.getDefaultTuning(), ...tuning };
    applyTransform(creature, merged);
    if (creature.position.y === 0) {
      creature.position.y = DEFAULT_Y_OFFSET;
    }
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;
    if (typeof creature.setSkeletonVisible === 'function') {
      creature.setSkeletonVisible(Boolean(showSkeleton));
    }
    if (creature.ringsOverlay) {
      const ringsOverlay = buildRingsConfig(merged);
      creature.ringsOverlay.updateConfig(ringsOverlay);
    }
    configureCreatureEnvironment(creature, environment, { startWander: true });
  },

  shouldRebuildOnChange(key) {
    if (!key) return false;
    return (
      key.startsWith('skeleton.') ||
      key.startsWith(`${BONE_OFFSET_PREFIX}.`) ||
      key.startsWith('limbMesh.') ||
      key.startsWith('torso.') ||
      key.startsWith('tusk.') ||
      key === 'lowPoly' ||
      key === 'bodyColor'
    );
  },

  rebuild({ tuning = {}, existing, soundFontEngine } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };
    const definition = buildDefinitionForSkeleton(merged);
    const limbMesh = buildLimbMeshConfig(merged);
    const torso = buildTorsoConfig(merged);
    const ringsOverlay = buildRingsConfig(merged);
    const scale = getNumber(merged['global.scale'], merged.scale);
    const showSkeleton = merged['debug.showSkeleton'] ?? merged.showSkeleton;
    const environment = resolveEnvironmentFromExisting(existing || null);
    const walkInPlace = merged.walkInPlace ?? true;

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
        torso,
        headScale: getNumber(merged['skeleton.headScale'], 1),
        definition,
        walkInPlace,
        soundFontEngine
      });

      creature.position.set(0, DEFAULT_Y_OFFSET, 0);
      applyTransform(creature, merged);
      configureCreatureEnvironment(creature, environment, { startWander: true });

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
