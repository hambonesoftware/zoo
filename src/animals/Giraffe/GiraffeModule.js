// src/animals/Giraffe/GiraffeModule.js

import { GiraffeCreature } from './GiraffeCreature.js';
import { GiraffeDefinition } from './GiraffeDefinition.js';

const DEFAULT_Y_OFFSET = 1.8;
const TUNING_SCHEMA_VERSION = '1.0.0';
const BONE_OFFSET_PREFIX = 'boneOffset';

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

function cloneDefinition(definition) {
  return {
    bones: definition.bones.map((bone) => ({ ...bone, position: [...bone.position] }))
  };
}

function applyScaleToBones(def, names, scale) {
  if (!scale || scale === 1) return;
  names.forEach((name) => {
    const bone = def.bones.find((b) => b.name === name);
    if (bone && Array.isArray(bone.position)) {
      bone.position = bone.position.map((v) => v * scale);
    }
  });
}

function applyOffsetToBone(bones, name, offset = {}) {
  if (!bones || !name) return;
  const bone = bones.find((b) => b.name === name);
  if (!bone || !Array.isArray(bone.position)) return;
  const { x = 0, y = 0, z = 0 } = offset;
  bone.position = [bone.position[0] + x, bone.position[1] + y, bone.position[2] + z];
}

function buildDefinitionForSkeleton(tuning) {
  const def = cloneDefinition(GiraffeDefinition);

  const neckScale = getNumber(tuning['skeleton.neckLenScale'], 1);
  const legScale = getNumber(tuning['skeleton.legLenScale'], 1);

  applyScaleToBones(def, ['neck_0', 'neck_1', 'neck_2', 'neck_3', 'neck_4', 'neck_5', 'neck_6', 'head'], neckScale);

  const legBones = [
    'front_left_upper',
    'front_left_lower',
    'front_left_foot',
    'front_right_upper',
    'front_right_lower',
    'front_right_foot',
    'back_left_upper',
    'back_left_lower',
    'back_left_foot',
    'back_right_upper',
    'back_right_lower',
    'back_right_foot'
  ];
  applyScaleToBones(def, legBones, legScale);

  for (const bone of def.bones) {
    const keyBase = `${BONE_OFFSET_PREFIX}.${bone.name}`;
    const offset = {
      x: getNumber(tuning[`${keyBase}.x`], 0),
      y: getNumber(tuning[`${keyBase}.y`], 0),
      z: getNumber(tuning[`${keyBase}.z`], 0)
    };
    applyOffsetToBone(def.bones, bone.name, offset);
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

export const GiraffeModule = {
  id: 'giraffe',
  label: 'Giraffe',

  build({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const definition = buildDefinitionForSkeleton(merged);

    const creature = new GiraffeCreature({
      scale: merged['global.scale'],
      showSkeleton: merged['debug.showSkeleton'],
      debug: { showSkeleton: merged['debug.showSkeleton'] },
      definition,
      torsoRadiusScale: merged['mesh.torsoRadiusScale'],
      neckRadiusScale: merged['mesh.neckRadiusScale'],
      legRadiusScale: merged['mesh.legRadiusScale'],
      ringsPerSegment: merged['mesh.ringsPerSegment'],
      sides: merged['mesh.sides'],
      idle: {
        swayAmount: merged['idle.swayAmount'],
        swaySpeed: merged['idle.swaySpeed']
      }
    });

    creature.position.set(0, DEFAULT_Y_OFFSET, 0);
    applyTransform(creature, merged);

    return {
      root: creature,
      update: (dt) => creature.update?.(dt),
      applyTuning: (nextTuning) => this.applyTuning({ root: creature }, nextTuning),
      rebuild: (nextTuning) => this.rebuild({ root: creature }, nextTuning),
      dispose: () => disposeCreature(creature)
    };
  },

  getDefaultTuning() {
    return {
      'global.scale': 1,
      'global.rotateY': Math.PI * 0.2,
      'skeleton.neckLenScale': 1,
      'skeleton.legLenScale': 1,
      'mesh.neckRadiusScale': 1,
      'mesh.legRadiusScale': 1,
      'mesh.torsoRadiusScale': 1,
      'mesh.ringsPerSegment': 2,
      'mesh.sides': 12,
      'idle.swayAmount': 0.16,
      'idle.swaySpeed': 0.55,
      'debug.showSkeleton': false,
      ...buildBoneOffsetDefaults(GiraffeDefinition)
    };
  },

  getTuningSchemaVersion() {
    return TUNING_SCHEMA_VERSION;
  },

  getTuningSchema() {
    const defaults = this.getDefaultTuning();
    const GROUP_ORDER = { Global: 0, Skeleton: 1, Mesh: 2, Idle: 3, Debug: 4, Bones: 5 };
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
        min: 0.4,
        max: 1.8,
        step: 0.01,
        label: 'Scale',
        groupOrder: GROUP_ORDER.Global,
        order: 0,
        tier: 'A'
      }),
      'global.rotateY': make('global.rotateY', {
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        label: 'Rotate Y',
        groupOrder: GROUP_ORDER.Global,
        order: 1,
        tier: 'A'
      }),
      'skeleton.neckLenScale': make('skeleton.neckLenScale', {
        label: 'Neck Length Scale',
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 0,
        min: 0.6,
        max: 1.4,
        step: 0.01,
        tier: 'B'
      }),
      'skeleton.legLenScale': make('skeleton.legLenScale', {
        label: 'Leg Length Scale',
        group: 'Skeleton',
        groupOrder: GROUP_ORDER.Skeleton,
        order: 1,
        min: 0.7,
        max: 1.3,
        step: 0.01,
        tier: 'B'
      }),
      'mesh.neckRadiusScale': make('mesh.neckRadiusScale', {
        label: 'Neck Radius Scale',
        group: 'Mesh',
        groupOrder: GROUP_ORDER.Mesh,
        order: 0,
        min: 0.6,
        max: 1.5,
        step: 0.01,
        tier: 'B'
      }),
      'mesh.legRadiusScale': make('mesh.legRadiusScale', {
        label: 'Leg Radius Scale',
        group: 'Mesh',
        groupOrder: GROUP_ORDER.Mesh,
        order: 1,
        min: 0.6,
        max: 1.5,
        step: 0.01,
        tier: 'B'
      }),
      'mesh.torsoRadiusScale': make('mesh.torsoRadiusScale', {
        label: 'Torso Radius Scale',
        group: 'Mesh',
        groupOrder: GROUP_ORDER.Mesh,
        order: 2,
        min: 0.7,
        max: 1.4,
        step: 0.01,
        tier: 'B'
      }),
      'mesh.ringsPerSegment': make('mesh.ringsPerSegment', {
        label: 'Rings per Segment',
        group: 'Mesh',
        groupOrder: GROUP_ORDER.Mesh,
        order: 3,
        min: 1,
        max: 6,
        step: 1,
        tier: 'B',
        type: 'int'
      }),
      'mesh.sides': make('mesh.sides', {
        label: 'Mesh Sides',
        group: 'Mesh',
        groupOrder: GROUP_ORDER.Mesh,
        order: 4,
        min: 6,
        max: 24,
        step: 1,
        tier: 'B',
        type: 'int'
      }),
      'idle.swayAmount': make('idle.swayAmount', {
        label: 'Idle Sway Amount',
        group: 'Idle',
        groupOrder: GROUP_ORDER.Idle,
        order: 0,
        min: 0,
        max: 0.5,
        step: 0.01,
        tier: 'A'
      }),
      'idle.swaySpeed': make('idle.swaySpeed', {
        label: 'Idle Sway Speed',
        group: 'Idle',
        groupOrder: GROUP_ORDER.Idle,
        order: 1,
        min: 0.1,
        max: 2,
        step: 0.01,
        tier: 'A'
      }),
      'debug.showSkeleton': make('debug.showSkeleton', {
        label: 'Show Skeleton',
        group: 'Debug',
        groupOrder: GROUP_ORDER.Debug,
        order: 0,
        tier: 'A',
        type: 'boolean',
        advanced: true
      })
    };

    const boneLabel = (name) => name.replace(/_/g, ' ');
    for (const bone of GiraffeDefinition.bones) {
      const baseLabel = boneLabel(bone.name);
      const baseKey = `${BONE_OFFSET_PREFIX}.${bone.name}`;
      for (const axis of ['x', 'y', 'z']) {
        const key = `${baseKey}.${axis}`;
        schema[key] = make(key, {
          label: `${baseLabel} ${axis.toUpperCase()} Offset`,
          group: 'Bones',
          groupOrder: GROUP_ORDER.Bones,
          order: 100 + Object.keys(schema).length,
          tier: 'B',
          min: -1,
          max: 1,
          step: 0.01,
          format: 3
        });
      }
    }

    return schema;
  },

  applyTuning(animalInstance, tuning) {
    if (!animalInstance || !animalInstance.root) return;
    const merged = { ...this.getDefaultTuning(), ...tuning };
    applyTransform(animalInstance.root, merged);

    const behavior = animalInstance.root.behavior;
    if (behavior?.applyIdleTuning) {
      behavior.applyIdleTuning({
        swayAmount: merged['idle.swayAmount'],
        swaySpeed: merged['idle.swaySpeed']
      });
    }

    if (animalInstance.root.setSkeletonVisible) {
      animalInstance.root.setSkeletonVisible(!!merged['debug.showSkeleton']);
    }
  },

  rebuild(animalInstance, tuning = {}) {
    if (!animalInstance || !animalInstance.root) return animalInstance;
    const merged = { ...this.getDefaultTuning(), ...tuning };

    const parent = animalInstance.root.parent;
    const position = animalInstance.root.position.clone();
    const rotation = animalInstance.root.rotation.clone();
    const scale = animalInstance.root.scale.x;

    animalInstance.dispose?.();

    const rebuilt = this.build({ tuning: merged });
    rebuilt.root.position.copy(position);
    rebuilt.root.rotation.copy(rotation);
    rebuilt.root.scale.setScalar(scale);

    if (parent) {
      parent.add(rebuilt.root);
    }

    return rebuilt;
  }
};
