// src/animals/Snake/SnakeModule.js

import { SnakeCreature } from "./SnakeCreature.js";

/**
 * SnakeModule
 *
 * Intended to match the "Zoo-style studio" pattern:
 * - build() returns a creature object with update/applyTuning/schema methods.
 *
 * Integrate this into your AnimalRegistry / Studio selection list.
 */
export const SnakeModule = {
  key: "snake",
  displayName: "Snake",

  /**
   * @param {Object} opts
   * @param {Object} [opts.definitionOverride]
   * @param {Object} [opts.tuning]
   * @returns {SnakeCreature}
   */
  build(opts = {}) {
    return new SnakeCreature(opts);
  },
};
