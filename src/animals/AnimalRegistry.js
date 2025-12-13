// src/animals/AnimalRegistry.js
//
// Minimal registry that exposes schema-driven animal modules compatible with
// AnimalStudioPen.

import { CatModule } from './Cat/CatModule.js';
import { ElephantModule } from './Elephant/ElephantModule.js';
import { GiraffeModule } from './Giraffe/GiraffeModule.js';
import { SnakeModule } from './Snake/SnakeModule.js';

export const AnimalRegistry = {
  cat: CatModule,
  elephant: ElephantModule,
  giraffe: GiraffeModule,
  snake: SnakeModule
};

export function getRegisteredAnimals() {
  return Object.keys(AnimalRegistry);
}
