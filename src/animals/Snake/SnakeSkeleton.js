// src/animals/Snake/SnakeSkeleton.js

import * as THREE from "three";

/**
 * Build a simple "NoPed" snake skeleton:
 * root -> spine_0 -> spine_1 -> ... -> spine_(N-1) -> head
 * head -> tongue_0 -> tongue_1 -> ... -> tongue_(M-1)
 *
 * We keep the rest pose mostly along +Z so it plays well with Zoo's conventions.
 *
 * @param {import("./SnakeDefinition.js").getDefaultSnakeDefinition} def
 * @returns {{
 *   root: THREE.Bone,
 *   spineBones: THREE.Bone[],
 *   head: THREE.Bone,
 *   tongueBones: THREE.Bone[],
 *   bonesByName: Map<string, THREE.Bone>
 * }}
 */
export function buildSnakeSkeleton(def) {
  const bonesByName = new Map();

  const root = new THREE.Bone();
  root.name = "root";
  bonesByName.set(root.name, root);

  const spineBones = [];
  let parent = root;

  for (let i = 0; i < def.spineCount; i++) {
    const b = new THREE.Bone();
    b.name = `spine_${i}`;
    // Rest pose along +Z.
    b.position.set(0, 0, def.segmentLength);
    parent.add(b);

    bonesByName.set(b.name, b);
    spineBones.push(b);
    parent = b;
  }

  const head = new THREE.Bone();
  head.name = "head";
  head.position.set(0, 0, def.segmentLength * 0.9);
  parent.add(head);
  bonesByName.set(head.name, head);

  // Tongue: smaller chain off head.
  const tongueBones = [];
  let tParent = head;
  const tSeg = def.tongueLength / Math.max(1, def.tongueCount);

  for (let i = 0; i < def.tongueCount; i++) {
    const tb = new THREE.Bone();
    tb.name = `tongue_${i}`;
    tb.position.set(0, 0, tSeg);
    tParent.add(tb);

    bonesByName.set(tb.name, tb);
    tongueBones.push(tb);
    tParent = tb;
  }

  return { root, spineBones, head, tongueBones, bonesByName };
}
