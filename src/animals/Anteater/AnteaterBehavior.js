// src/animals/Anteater/AnteaterBehavior.js
// Behavior shell that keeps the anteater's locomotion and activity state
// aligned with the YAML-defined behaviors.

import { AnteaterDefinition } from './AnteaterDefinition.js';
import { AnteaterLocomotion } from './AnteaterLocomotion.js';

export class AnteaterBehavior {
  constructor(options = {}) {
    this.definition = AnteaterDefinition;
    this.locomotion = new AnteaterLocomotion(options.locomotion || {});
    this.activeBehavior = 'idle';
  }

  setBehavior(name) {
    if (this.definition.getBehaviorNames().includes(name)) {
      this.activeBehavior = name;
      this.locomotion.setMode(name === 'forage' ? 'forage' : 'move');
    }
  }

  getBehaviorPlan() {
    return this.definition.behaviors.map((behavior) => ({
      ...behavior,
      capability_links: this.definition.capabilities
    }));
  }

  update(deltaSeconds = 0) {
    // Future simulation hooks will consider inputs/outputs. For now the
    // locomotion tick keeps speed in sync with the chosen activity.
    this.locomotion.update(deltaSeconds);
  }
}
