// src/utils/boneGraphBuilder.js

/**
 * Build a graph of bone parent -> children.
 */
export function buildBoneGraph(boneDefs) {
  const graph = new Map();
  for (const bone of boneDefs) {
    if (!graph.has(bone.name)) graph.set(bone.name, []);
    if (bone.parent && bone.parent !== 'root') {
      if (!graph.has(bone.parent)) graph.set(bone.parent, []);
      graph.get(bone.parent).push(bone.name);
    }
  }
  return graph;
}

/**
 * Build map: name -> boneDef
 */
export function mapBoneDefs(boneDefs) {
  const map = {};
  for (const b of boneDefs) map[b.name] = b;
  return map;
}
