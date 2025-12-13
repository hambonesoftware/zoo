// src/animals/AnimalRegistry.js
//
// Minimal registry that exposes schema-driven animal modules compatible with
// AnimalStudioPen.

import { CatModule } from './Cat/CatModule.js';
import { ElephantModule } from './Elephant/ElephantModule.js';

export const AnimalRegistry = {
  cat: CatModule,
  elephant: ElephantModule
};

export function getRegisteredAnimals() {
  return Object.keys(AnimalRegistry);
}
