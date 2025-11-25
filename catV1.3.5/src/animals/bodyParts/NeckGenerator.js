
// src/animals/bodyParts/NeckGenerator.js
import * as THREE from 'three';
import { createRing, bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

export function generateNeckGeometry(skeleton, options = {}) {
  const sides = options.sides || 8;
  const yOffset = options.yOffset || 0;
  const neckChain = ['spine_mid', 'spine_neck'];

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => { boneIndexMap[bone.name] = idx; });
  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

  const getPos = name => {
    const idx = boneIndexMap[name];
    const bone = skeleton.bones[idx];
    if (!bone) throw new Error(`Missing bone: ${name}`);
    return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
  };
  const neckPoints = neckChain.map(getPos);
  const baseRadius = options.baseRadius || 0.12; 
  const neckRadius = options.neckRadius || 0.08;
  const radii = [baseRadius, neckRadius];

  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];

  for (let i = 0; i < neckPoints.length; i++) {
    const center = neckPoints[i];
    const prev = (i === 0) ? neckPoints[i] : neckPoints[i - 1];
    const next = (i === neckPoints.length - 1) ? neckPoints[i] : neckPoints[i + 1];
    let axis = next.clone().sub(prev).normalize();
    if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3(0, 1, 0);
    const up = Math.abs(axis.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    
    // Use imported createRing
    const ring = createRing(center, axis, radii[i], sides, up);

    ringStarts.push(positions.length / 3);
    for (let j = 0; j < ring.length; j++) {
      const v = ring[j];
      positions.push(v.x, v.y + yOffset, v.z);
      const norm = v.clone().sub(center).normalize();
      normals.push(norm.x, norm.y, norm.z);
      uvs.push(j / sides, i / (neckPoints.length - 1));
      let boneA, boneB, wa, wb;
      if (i === 0) {
        boneA = boneIndexMap[neckChain[0]];
        boneB = boneA; wa = 1; wb = 0;
      } else if (i === neckPoints.length - 1) {
        boneA = boneIndexMap[neckChain[neckChain.length - 1]];
        boneB = boneA; wa = 1; wb = 0;
      } else {
        boneA = boneIndexMap[neckChain[i - 1]];
        boneB = boneIndexMap[neckChain[i]];
        wa = 0.5; wb = 0.5;
      }
      skinIndices.push(boneA, boneB, 0, 0);
      skinWeights.push(wa, wb, 0, 0);
    }
  }

  for (let seg = 0; seg < neckPoints.length - 1; seg++) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  const rimStartIdx = ringStarts[ringStarts.length - 1];
  const rimVerts = [];
  for (let j = 0; j < sides; j++) {
    rimVerts.push(new THREE.Vector3(
      positions[(rimStartIdx + j) * 3 + 0],
      positions[(rimStartIdx + j) * 3 + 1],
      positions[(rimStartIdx + j) * 3 + 2]
    ));
  }
  const neckTop = getPos('spine_neck');
  const headPos = getPos('head');
  const apex = neckTop.clone().lerp(headPos, 0.5);
  const capSegments = 2; 

  for (let seg = 1; seg <= capSegments; seg++) {
    const t = seg / capSegments;
    for (let j = 0; j < sides; j++) {
      const rimVert = rimVerts[j];
      const v = rimVert.clone().lerp(apex, t);
      positions.push(v.x, v.y, v.z);
      const normal = apex.clone().sub(rimVert).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(j / sides, t);
      let skinA = boneIndexMap['spine_neck'];
      let skinB = boneIndexMap['head'];
      let wa = 1 - t;
      let wb = t;
      skinIndices.push(skinA, skinB, 0, 0);
      skinWeights.push(wa, wb, 0, 0);
    }
  }
  positions.push(apex.x, apex.y, apex.z);
  normals.push(0, 0, 1);
  uvs.push(0.5, 1);
  skinIndices.push(boneIndexMap['head'], boneIndexMap['head'], 0, 0);
  skinWeights.push(1, 0, 0, 0);
  const apexIdx = positions.length / 3 - 1;

  const base = rimStartIdx;
  for (let seg = 0; seg < capSegments; seg++) {
    const ring0 = seg === 0 ? base : base + sides * seg;
    const ring1 = base + sides * (seg + 1);
    for (let j = 0; j < sides; j++) {
      const a = ring0 + j;
      const b = ring0 + ((j + 1) % sides);
      const c = ring1 + j;
      const d = ring1 + ((j + 1) % sides);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const lastRingStart = base + sides * capSegments;
  for (let j = 0; j < sides; j++) {
    const a = lastRingStart + j;
    const b = lastRingStart + ((j + 1) % sides);
    indices.push(apexIdx, a, b);
  }

  let geometry = buildBufferGeometry({
    positions, normals, skinIndices, skinWeights, uvs, indices
  });

  if (geometry.index) geometry = geometry.toNonIndexed();
  return geometry;
}
