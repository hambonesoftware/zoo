// src/animals/Elephant/ElephantModule.js

import { ElephantCreature } from './ElephantCreature.js';

const DEFAULT_Y_OFFSET = 1.37; // padHeight (0.17) + elephant base height (~1.2)

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

export const ElephantModule = {
  id: 'elephant',
  label: 'Elephant',

  build({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const creature = new ElephantCreature({
      scale: merged.scale,
      showSkeleton: merged.showSkeleton,
      debug: merged.debug,
      lowPoly: merged.lowPoly,
      bodyColor: merged.bodyColor,
      variantSeed: merged.variantSeed
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
    return {
      scale: 0.75,
      rotationY: Math.PI * 0.1,
      showSkeleton: false,
      debug: false,
      lowPoly: true,
      bodyColor: undefined,
      variantSeed: undefined
    };
  },

  getTuningSchema() {
    return {
      scale: { min: 0.5, max: 1.2, step: 0.01, label: 'Scale' },
      rotationY: { min: -Math.PI, max: Math.PI, step: 0.01, label: 'Rotate Y' },
      lowPoly: { type: 'boolean', label: 'Low Poly' },
      showSkeleton: { type: 'boolean', label: 'Show Skeleton' }
    };
  },

  applyTuning(animalInstance, tuning) {
    if (!animalInstance || !animalInstance.root) return;
    const merged = { ...this.getDefaultTuning(), ...tuning };
    applyTransform(animalInstance.root, merged);
    if (animalInstance.root.position.y === 0) {
      animalInstance.root.position.y = DEFAULT_Y_OFFSET;
    }
  }
};
