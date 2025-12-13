// src/animals/Cat/CatModule.js

import { CatCreature } from './CatCreature.js';

const DEFAULT_Y_OFFSET = 1.67; // padHeight (0.17) + cat base height (~1.5)

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

export const CatModule = {
  id: 'cat',
  label: 'Cat',

  build({ tuning = {} } = {}) {
    const defaults = this.getDefaultTuning();
    const merged = { ...defaults, ...tuning };

    const cat = new CatCreature({
      scale: merged.scale,
      showSkeleton: merged.showSkeleton,
      debug: merged.debug
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
      debug: false
    };
  },

  getTuningSchema() {
    return {
      scale: { min: 0.4, max: 1.4, step: 0.01, label: 'Scale' },
      rotationY: { min: -Math.PI, max: Math.PI, step: 0.01, label: 'Rotate Y' },
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
