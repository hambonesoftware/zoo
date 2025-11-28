// src/animals/bodyParts/NoseGenerator.js

import { generateTailGeometry } from './TailGenerator.js';

const DEFAULT_ROOTS = ['head_tip_2', 'head_tip_1', 'head'];

function resolveRootBoneName(skeleton, preferredRoot, fallbackRoots) {
  const candidates = preferredRoot
    ? [preferredRoot, ...fallbackRoots.filter((name) => name !== preferredRoot)]
    : [...fallbackRoots];

  return candidates.find((name) => skeleton.bones.some((bone) => bone.name === name)) || null;
}

/**
 * generateNoseGeometry
 *
 * Wraps the tail generator with defaults that keep nose-attached meshes (e.g.
 * trunks, tusks) anchored to the head tip instead of the spine. If the
 * preferred root bone is missing, we fall back through the common head tip
 * chain so rigs that omit optional anchors still render noses in the right
 * place.
 */
export function generateNoseGeometry(skeleton, options = {}) {
  const fallbackRoots =
    Array.isArray(options.fallbackRoots) && options.fallbackRoots.length > 0
      ? options.fallbackRoots
      : DEFAULT_ROOTS;

  const rootBoneName = resolveRootBoneName(skeleton, options.rootBone, fallbackRoots);

  if (!rootBoneName) {
    throw new Error(
      `[generateNoseGeometry] No suitable nose root bone found. Checked: ${[
        options.rootBone,
        ...fallbackRoots
      ]
        .filter(Boolean)
        .join(', ')}`
    );
  }

  return generateTailGeometry(skeleton, {
    ...options,
    rootBone: rootBoneName
  });
}
