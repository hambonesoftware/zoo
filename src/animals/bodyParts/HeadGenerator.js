
// src/animals/bodyParts/HeadGenerator.js
import * as THREE from 'three';

export function generateHeadGeometry(skeleton, options = {}) {
  const neckBone = skeleton.bones.find(b => b.name === 'spine_neck');
  const headBone = skeleton.bones.find(b => b.name === 'head');
  if (!neckBone || !headBone) throw new Error('Missing spine_neck or head bone!');

  const neckPos = new THREE.Vector3().setFromMatrixPosition(neckBone.matrixWorld);
  const headPos = new THREE.Vector3().setFromMatrixPosition(headBone.matrixWorld);

  const mid = neckPos.clone().lerp(headPos, 0.5);
  const dir = headPos.clone().sub(neckPos).normalize();
  const length = neckPos.distanceTo(headPos);

  const baseRadius = options.radius || 0.13;
  const detail = options.detail !== undefined ? options.detail : 0; 
  let geo = new THREE.IcosahedronGeometry(1.0, detail); 

  geo.scale(1.2 * baseRadius, 1.0 * baseRadius, length / 2);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), dir
  );
  geo.applyQuaternion(quat);
  geo.translate(mid.x, mid.y, mid.z);

  if (geo.index) geo = geo.toNonIndexed();

  const vcount = geo.attributes.position.count;
  const skinIndices = new Uint16Array(vcount * 4);
  const skinWeights = new Float32Array(vcount * 4);
  const boneIdx = skeleton.bones.indexOf(headBone);
  for (let i = 0; i < vcount; i++) {
    skinIndices[i * 4] = boneIdx;
    skinWeights[i * 4] = 1.0;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  return geo;
}
