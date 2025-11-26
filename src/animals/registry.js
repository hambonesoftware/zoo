// src/animals/registry.js
//
// Central registry of all known animal types in the zoo. This allows the
// Zoo and the development studio UI to discover animals without hard-
// coding specific classes all over the codebase.

import { CatCreature } from './Cat/CatCreature.js';
import { CatPen } from './Cat/CatPen.js';
import { ElephantCreature } from './Elephant/ElephantCreature.js';
import { ElephantPen } from './Elephant/ElephantPen.js';

export const animalsRegistry = {
  cat: {
    id: 'cat',
    label: 'Cat',
    createPen(scene, options = {}) {
      return new CatPen(scene, options);
    },
    createCreature(options = {}) {
      return new CatCreature(options);
    }
  },

  elephant: {
    id: 'elephant',
    label: 'Elephant',
    createPen(scene, options = {}) {
      return new ElephantPen(scene, options);
    },
    createCreature(options = {}) {
      return new ElephantCreature(options);
    }
  }
};

// Returns the list of discovered animal IDs in a stable order.
export function getDiscoveredAnimals() {
  return Object.keys(animalsRegistry);
}
