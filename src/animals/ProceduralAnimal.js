// src/animals/ProceduralAnimal.js

import * as THREE from 'three';

/**
 * Helper: Creates a THREE.Bone with a name and optional parent.
 */
function makeBone(name, parent = null, position = [0, 0, 0]) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.fromArray(position);
  if (parent) parent.add(bone);
  return bone;
}

/**
 * ProceduralAnimal
 * - Generic procedural quadruped/creature rig
 * - Accepts a definition: { bones, sizes }
 * - Builds bone hierarchy, mesh, and skeleton
 * - Returns mesh, bone map, and skeleton
 */
export class ProceduralAnimal {
  /**
   * @param {Object} definition - { bones: [...], sizes: { [name]: [x, y, z] } }
   * @param {Object} options    - { segmentsPerBone, circleVertices, material }
   */
  constructor(definition = {}, options = {}) {
    this.definition = definition;
    this.options = options;

    // === Build bone structure ===
    this.boneMap = {};
    this.boneList = [];

    // Step 1: Create all bones (by name, in order)
    for (const def of definition.bones) {
      const bone = makeBone(def.name, null, def.position);
      this.boneMap[def.name] = bone;
      this.boneList.push(bone);
    }
    // Step 2: Parent the bones
    for (const def of definition.bones) {
      if (def.parent && this.boneMap[def.parent]) {
        this.boneMap[def.parent].add(this.boneMap[def.name]);
      }
    }
    // Step 3: Find top/root bone (typically 'spine_base' or 'root')
    const rootBone = this.boneMap['spine_base'] || this.boneMap['root'] || this.boneList[0];

    // === Build the mesh (procedural tube between bones) ===
    this.mesh = this.buildMesh(rootBone, definition, options);

    // === Build skeleton ===
    this.skeleton = new THREE.Skeleton(this.boneList);

    // === Bind skeleton to mesh ===
    this.mesh.add(rootBone);
    this.mesh.bind(this.skeleton);

    // Optional: expose all for animation
    this.bones = this.boneMap;
  }

  /**
   * Build a simple procedural tube-mesh connecting main chain bones,
   * for demonstration purposes. Adjust this to your own geometry generators.
   */
  buildMesh(rootBone, definition, options = {}) {
    const { sizes = {}, bones = [] } = definition;
    const segmentsPerBone = options.segmentsPerBone || 8;
    const circleVertices = options.circleVertices || 8;

    const positions = [];
    const normals = [];
    const skinIndices = [];
    const skinWeights = [];
    const indices = [];
    let vertexCount = 0;

    // Helper: build a circle in XY plane
    function circle(radius, n) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
      }
      return pts;
    }

    // For each consecutive bone pair, build tube segment
    for (let i = 1; i < bones.length; i++) {
      const boneA = this.boneMap[bones[i - 1].name];
      const boneB = this.boneMap[bones[i].name];

      // Positions in local space (can be changed to world as needed)
      const posA = boneA.position;
      const posB = boneB.position;

      // Sizes
      const rA = (sizes[bones[i - 1].name] || [0.2, 0.2, 0.2])[0] / 2;
      const rB = (sizes[bones[i].name] || [0.2, 0.2, 0.2])[0] / 2;

      // Circles at each end
      const circleA = circle(rA, circleVertices);
      const circleB = circle(rB, circleVertices);

      // Build segment between A and B
      for (let seg = 0; seg <= segmentsPerBone; seg++) {
        const t = seg / segmentsPerBone;
        const px = posA.x + (posB.x - posA.x) * t;
        const py = posA.y + (posB.y - posA.y) * t;
        const pz = posA.z + (posB.z - posA.z) * t;
        for (let v = 0; v < circleVertices; v++) {
          const [cx, cy] = [
            circleA[v][0] + (circleB[v][0] - circleA[v][0]) * t,
            circleA[v][1] + (circleB[v][1] - circleA[v][1]) * t
          ];
          positions.push(px + cx, py + cy, pz);

          // Normals: radial out
          normals.push(cx, cy, 0);

          // Skin: blend between bone indices
          skinIndices.push(i - 1, i, 0, 0);
          skinWeights.push(1 - t, t, 0, 0);
        }
      }

      // Indices for triangles between segments
      for (let seg = 0; seg < segmentsPerBone; seg++) {
        for (let v = 0; v < circleVertices; v++) {
          const nextV = (v + 1) % circleVertices;
          const i0 = vertexCount + seg * circleVertices + v;
          const i1 = vertexCount + seg * circleVertices + nextV;
          const i2 = vertexCount + (seg + 1) * circleVertices + v;
          const i3 = vertexCount + (seg + 1) * circleVertices + nextV;
          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }
      vertexCount += (segmentsPerBone + 1) * circleVertices;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.setIndex(indices);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material =
      options.material ||
      new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        flatShading: true,
        metalness: 0.1,
        roughness: 0.8,
        skinning: true
      });

    const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;

    return skinnedMesh;
  }
}
