// src/animals/Cat/CatModule.js

import { CatCreature } from './CatCreature.js';
import { CatDefinition } from './CatDefinition.js';

const DEFAULT_Y_OFFSET = 1.7; // padHeight (0.2) + cat base height (~1.5)
const TUNING_SCHEMA_VERSION = '1.0.0';
const BONE_OFFSET_PREFIX = 'boneOffset';

function applyTransform(creature, tuning) {
  if (!creature) return;
  if (typeof tuning.scale === 'number') {
    creature.scale.setScalar(tuning.scale);
  }
  if (typeof tuning.rotationY === 'number') {
    creature.rotation.y = tuning.rotationY;
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
  const definition = cloneDefinition(CatDefinition);
  for (const bone of definition.bones) {
    const keyBase = `${BONE_OFFSET_PREFIX}.${bone.name}`;
    const offset = {
      x: tuning[`${keyBase}.x`] ?? 0,
      y: tuning[`${keyBase}.y`] ?? 0,
      z: tuning[`${keyBase}.z`] ?? 0
    };
    applyOffsetToBone(definition.bones, bone.name, offset);
  }
  return definition;
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

export const CatModule = {
  id: 'cat',
  label: 'Cat',

  build({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const definition = buildDefinitionForSkeleton(merged);

    const cat = new CatCreature({
      scale: merged.scale,
      showSkeleton: merged.showSkeleton,
      debug: merged.debug,
      definition
    });

    cat.position.set(0, DEFAULT_Y_OFFSET, 0);
    applyTransform(cat, merged);

    return {
      root: cat,
      update: (dt) => cat.update?.(dt),
      dispose: () => disposeCreature(cat)
    };
  },

  getDefaultTuning() {
    return {
      scale: 0.75,
      rotationY: Math.PI * 0.3,
      showSkeleton: false,
      debug: false,
      ...buildBoneOffsetDefaults(CatDefinition)
    };
  },

  getTuningSchemaVersion() {
    return TUNING_SCHEMA_VERSION;
  },

  getTuningSchema() {
    const defaults = this.getDefaultTuning();
    const GROUP_ORDER = {
      Global: 0,
      Bones: 1,
      Debug: 2
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
      scale: make('scale', {
        min: 0.4,
        max: 1.4,
        step: 0.01,
        label: 'Scale',
        group: 'Global',
        groupOrder: GROUP_ORDER.Global,
        order: 0,
        tier: 'A',
        type: 'float'
      }),
      rotationY: make('rotationY', {
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        label: 'Rotate Y',
        group: 'Global',
        groupOrder: GROUP_ORDER.Global,
        order: 1,
        tier: 'A',
        type: 'float'
      }),
      showSkeleton: make('showSkeleton', {
        type: 'boolean',
        label: 'Show Skeleton',
        group: 'Debug',
        groupOrder: GROUP_ORDER.Debug,
        order: 0,
        tier: 'A',
        advanced: true
      })
    };

    const boneLabel = (name) => name.replace(/_/g, ' ');
    for (const bone of CatDefinition.bones) {
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
          min: -0.75,
          max: 0.75,
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
    if (animalInstance.root.position.y === 0) {
      animalInstance.root.position.y = DEFAULT_Y_OFFSET;
    }
  },

  shouldRebuildOnChange(key) {
    return typeof key === 'string' && key.startsWith(`${BONE_OFFSET_PREFIX}.`);
  },

  rebuild({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };
    const definition = buildDefinitionForSkeleton(merged);

    const cat = new CatCreature({
      scale: merged.scale,
      showSkeleton: merged.showSkeleton,
      debug: merged.debug,
      definition
    });

    cat.position.set(0, DEFAULT_Y_OFFSET, 0);
    applyTransform(cat, merged);

    return {
      root: cat,
      update: (dt) => cat.update?.(dt),
      dispose: () => disposeCreature(cat)
    };
  }
};
