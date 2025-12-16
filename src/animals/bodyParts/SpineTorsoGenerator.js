// src/animals/bodyParts/SpineTorsoGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from './TorsoGenerator.js';

/**
 * generateSpineTorsoGeometry
 *
 * Thin wrapper around generateTorsoGeometry that lets you treat the
 * spine (torso) and neck as a single continuous body tube.
 *
 * You can use it in two ways:
 *
 * 1) Direct mode (fully custom):
 *    - options.bones  = full ordered chain, e.g.
 *        ['spine_base','spine_mid','spine_upper','neck_0',...,'neck_6']
 *    - options.radii  = same-length radii array for those bones
 *    - All other generateTorsoGeometry options pass through unchanged.
 *
 * 2) Convenience mode (spine + neck split):
 *    - options.spineBones = ['spine_base','spine_mid','spine_upper']
 *    - options.neckBones  = ['neck_0',...,'neck_6']
 *    - options.spineRadii = [r0,r1,r2]
 *    - options.neckRadii  = [r3,...]
 *    These are concatenated into bones/radii internally.
 *
 * Any other options supported by TorsoGenerator (sides, ringsPerSegment,
 * lowPoly, extendRumpToRearLegs, rumpBulgeDepth, capStart, capEnd, etc.)
 * are forwarded as-is.
 */
export function generateSpineTorsoGeometry(skeleton, options = {}) {
  // If caller already provided a full bones/radii list, just forward it.
  let bones =
    Array.isArray(options.bones) && options.bones.length > 0
      ? options.bones.slice()
      : null;

  let radii =
    Array.isArray(options.radii) && options.radii.length > 0
      ? options.radii.slice()
      : null;

  // If no bones given, build them from spineBones + neckBones.
  if (!bones) {
    const spineBones = Array.isArray(options.spineBones)
      ? options.spineBones
      : ['spine_base', 'spine_mid', 'spine_upper'];

    const neckBones = Array.isArray(options.neckBones)
      ? options.neckBones
      : [];

    bones = [...spineBones, ...neckBones];
  }

  // If no radii given, build them from spineRadii + neckRadii.
  if (!radii) {
    const spineRadii = Array.isArray(options.spineRadii)
      ? options.spineRadii
      : [];

    const neckRadii = Array.isArray(options.neckRadii)
      ? options.neckRadii
      : [];

    radii = [...spineRadii, ...neckRadii];
  }

  // Defensive: if radii array is shorter than bones, pad by repeating last.
  if (radii.length < bones.length && radii.length > 0) {
    const last = radii[radii.length - 1];
    while (radii.length < bones.length) {
      radii.push(last);
    }
  }

  // Build an options object for TorsoGenerator, forwarding everything
  // but overriding bones/radii with our combined arrays.
  const forwardOptions = {
    ...options,
    bones,
    radii
  };

  // These are only used by this wrapper; they are not part of
  // generateTorsoGeometry's API, so we strip them to avoid confusion.
  delete forwardOptions.spineBones;
  delete forwardOptions.neckBones;
  delete forwardOptions.spineRadii;
  delete forwardOptions.neckRadii;

  return generateTorsoGeometry(skeleton, forwardOptions);
}
