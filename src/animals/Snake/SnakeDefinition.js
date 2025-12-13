// src/animals/Snake/SnakeDefinition.js

/**
 * SnakeDefinition
 *
 * This is intentionally small and "Zoo-style":
 * - A procedural bone chain (no legs / "NoPed").
 * - A segmented, low-poly tube mesh that follows the bone chain.
 * - A tongue chain attached to the head.
 *
 * IMPORTANT:
 * - This module is self-contained and does not import from existing Zoo animals.
 * - Integrate it by registering SnakeModule (see /snakeV1.0/INTEGRATION.md).
 */

/**
 * @typedef {Object} SnakeDefinition
 * @property {number} spineCount
 * @property {number} tongueCount
 * @property {number} segmentLength
 * @property {number} baseRadius
 * @property {number} taperToRadius
 * @property {number} headRadius
 * @property {number} tongueLength
 * @property {number} tongueForkLength
 * @property {number} tongueForkSpread
 * @property {number} radialSegments
 * @property {number} materialRoughness
 * @property {number} materialMetalness
 * @property {string|number} bodyColor
 * @property {string|number} bellyColor
 * @property {string|number} tongueColor
 */

/**
 * @returns {SnakeDefinition}
 */
export function getDefaultSnakeDefinition() {
  return {
    // Skeleton
    spineCount: 24,
    tongueCount: 5,
    segmentLength: 0.22,

    // Body shape
    baseRadius: 0.11,
    taperToRadius: 0.045,
    headRadius: 0.14,

    // Tongue
    tongueLength: 0.22,
    tongueForkLength: 0.075,
    tongueForkSpread: 0.06,

    // Mesh detail (keep low-poly to match Zoo style)
    radialSegments: 8,

    // Material
    materialRoughness: 0.85,
    materialMetalness: 0.0,

    // Colors (can be number like 0xRRGGBB, or CSS string)
    bodyColor: 0x3a6b3a,
    bellyColor: 0x9fc39f,
    tongueColor: 0xc13a6a,
  };
}
