
// src/animals/bodyParts/TailGenerator.js
import * as THREE from 'three';
import { createRing, bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

export function generateTailGeometry(skeleton, options = {}) {
  const tailBoneNames = options.bones || ['tail_base', 'tail_mid', 'tail_tip'];
  const sides = options.sides || 6;
  const baseRadius = options.baseRadius || 0.08;
  const midRadius  = options.midRadius  || 0.07;
  const tipRadius  = options.tipRadius  || 0.05;
  const yOffset = options.yOffset || 0;

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => {
    boneIndexMap[bone.name] = idx;
  });
  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

  const allTailBoneNames = ['spine_base', ...tailBoneNames];
  const tailPoints = allTailBoneNames.map(name => {
    const idx = boneIndexMap[name];
    if (idx === undefined) throw new Error(`Missing bone: ${name}`);
    return new THREE.Vector3().setFromMatrixPosition(skeleton.bones[idx].matrixWorld);
  });

  let radii;
  if (options.radii && Array.isArray(options.radii)) {
    radii = options.radii;
  } else if (allTailBoneNames.length === 4) { 
    radii = [baseRadius, baseRadius, midRadius, tipRadius];
  } else {
    radii = [];
    for (let i = 0; i < tailPoints.length; i++) {
      const t = i / (tailPoints.length - 1);
      radii.push(THREE.MathUtils.lerp(baseRadius, tipRadius, t));
    }
  }

  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];

  for (let i = 0; i < tailPoints.length; i++) {
    const center = tailPoints[i];
    const axis =
      (i === tailPoints.length - 1)
        ? center.clone().sub(tailPoints[i - 1]).normalize()
        : tailPoints[i + 1].clone().sub(center).normalize();

    const ring = createRing(center, axis, radii[i], sides);
    ringStarts.push(positions.length / 3);

    for (let j = 0; j < ring.length; j++) {
      const v = ring[j];
      positions.push(v.x, v.y + yOffset, v.z);
      const norm = v.clone().sub(center).normalize();
      normals.push(norm.x, norm.y, norm.z);
      uvs.push(j / sides, i / (tailPoints.length - 1));
      const mainBone = boneIndexMap[allTailBoneNames[i]];
      skinIndices.push(mainBone, mainBone, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
  }

  for (let seg = 0; seg < tailPoints.length - 1; seg++) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  let geometry = buildBufferGeometry({
    positions, normals, skinIndices, skinWeights, uvs, indices
  });

  if (geometry.index) geometry = geometry.toNonIndexed();
  return geometry;
}
