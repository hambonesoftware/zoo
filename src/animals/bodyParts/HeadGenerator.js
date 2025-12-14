
// src/animals/bodyParts/HeadGenerator.js
import * as THREE from 'three';

export function generateHeadGeometry(skeleton, options = {}) {
  const neckChain =
    Array.isArray(options.bones) && options.bones.length > 0
      ? options.bones
      : ['spine_mid', 'spine_neck'];
  // Visual/regression check: confirm the dome anchors to the last neck link when a multi-joint chain is supplied.
  const headBoneName = options.headBone || 'head';
  const neckSequenceExcludingHead = neckChain.filter(name => name !== headBoneName);
  const neckBoneName = options.neckBone
    || (neckSequenceExcludingHead.length > 0
      ? neckSequenceExcludingHead[neckSequenceExcludingHead.length - 1]
      : neckChain[neckChain.length - 1]);
  const neckBone = skeleton.bones.find(b => b.name === neckBoneName);
  const headBone = skeleton.bones.find(b => b.name === headBoneName);
  if (!neckBone || !headBone) throw new Error(`Missing ${neckBoneName} or ${headBoneName} bone!`);

  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

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
