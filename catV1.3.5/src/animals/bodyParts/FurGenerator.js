
// src/animals/bodyParts/FurGenerator.js
import * as THREE from 'three';
import { FurStrand } from './FurStrand.js';

export function generateFurMesh(skinnedMesh, options = {}) {
  const geometry = skinnedMesh.geometry;
  const strandCount = options.strandCount || 1200;
  const strandLength = options.strandLength || 0.11;
  const lengthJitter = options.lengthJitter || 0.04;
  const color = options.color || 0x332210;
  const thickness = options.thickness || 0.012;

  const strandGeo = new THREE.CylinderGeometry(thickness, thickness * 0.5, 1.0, 5, 1, true);
  strandGeo.translate(0, 0.5, 0);

  const furMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.97,
    flatShading: true,
  });

  const furMesh = new THREE.InstancedMesh(strandGeo, furMat, strandCount);
  furMesh.castShadow = true;
  furMesh.receiveShadow = false;
  const strands = [];

  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const idxAttr = geometry.index;
  const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;

  const areas = [];
  let totalArea = 0;
  for (let i = 0; i < triCount; ++i) {
    const ia = idxAttr ? idxAttr.getX(i * 3) : i * 3;
    const ib = idxAttr ? idxAttr.getX(i * 3 + 1) : i * 3 + 1;
    const ic = idxAttr ? idxAttr.getX(i * 3 + 2) : i * 3 + 2;
    const a = new THREE.Vector3().fromBufferAttribute(posAttr, ia);
    const b = new THREE.Vector3().fromBufferAttribute(posAttr, ib);
    const c = new THREE.Vector3().fromBufferAttribute(posAttr, ic);
    const ab = b.clone().sub(a), ac = c.clone().sub(a);
    const area = ab.cross(ac).length() * 0.5;
    areas.push(area);
    totalArea += area;
  }

  function pickTri() {
    let r = Math.random() * totalArea;
    let acc = 0;
    for (let i = 0; i < areas.length; ++i) {
      acc += areas[i];
      if (r <= acc) return i;
    }
    return areas.length - 1;
  }

  for (let i = 0; i < strandCount; ++i) {
    const tri = pickTri();
    const ia = idxAttr ? idxAttr.getX(tri * 3) : tri * 3;
    const ib = idxAttr ? idxAttr.getX(tri * 3 + 1) : tri * 3 + 1;
    const ic = idxAttr ? idxAttr.getX(tri * 3 + 2) : tri * 3 + 2;

    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    const root = new THREE.Vector3(0,0,0)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(posAttr, ia), u)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(posAttr, ib), v)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(posAttr, ic), w);

    const normal = new THREE.Vector3(0,0,0)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normAttr, ia), u)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normAttr, ib), v)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normAttr, ic), w)
      .normalize();

    const len = strandLength + (Math.random() - 0.5) * lengthJitter;
    strands.push(new FurStrand(root, normal, len));
  }

  furMesh.userData.strands = strands;
  furMesh.userData.updateStrands = function (skinnedMesh, dt, params = {}) {
    for (let i = 0; i < strands.length; ++i) {
      const origRoot = strands[i].root;
      const origNorm = strands[i].normal;
      const skinnedRoot = origRoot.clone();
      skinnedMesh.boneTransform(0, skinnedRoot); 
      strands[i].update(skinnedRoot, origNorm, dt, params);
      const up = new THREE.Vector3(0, 1, 0);
      const toTip = strands[i].tip.clone().sub(strands[i].root).normalize();
      const len = strands[i].tip.distanceTo(strands[i].root);
      const q = new THREE.Quaternion().setFromUnitVectors(up, toTip);
      const mtx = new THREE.Matrix4();
      mtx.compose(strands[i].root, q, new THREE.Vector3(1, len, 1));
      furMesh.setMatrixAt(i, mtx);
    }
    furMesh.instanceMatrix.needsUpdate = true;
  };

  return furMesh;
}
