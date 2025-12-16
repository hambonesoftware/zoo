// src/animals/bodyParts/NeckGenerator.js
import * as THREE from 'three';
import { createRing, bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

export function generateNeckGeometry(skeleton, options = {}) {
  const sides = options.sides || 8;
  const yOffset = options.yOffset || 0;

  // Caps
  const capBase = options.capBase !== false; // default: add base cap
  const capTip = options.capTip !== false;   // default: add tip taper/cap (NEW)

  const neckChain =
    Array.isArray(options.bones) && options.bones.length > 0
      ? options.bones
      : ['spine_mid', 'spine_neck'];

  const headBoneName = options.headBone || 'head';
  const neckTopName = options.neckTipBone || neckChain[neckChain.length - 1];

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => { boneIndexMap[bone.name] = idx; });
  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

  const getBoneIndex = (name) => {
    const idx = boneIndexMap[name];
    if (idx === undefined) throw new Error(`Missing bone index for: ${name}`);
    return idx;
  };

  const getPos = (name) => {
    const idx = getBoneIndex(name);
    const bone = skeleton.bones[idx];
    if (!bone) throw new Error(`Missing bone: ${name}`);
    return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
  };

  const neckPoints = neckChain.map(getPos);

  const baseRadius = options.baseRadius || 0.12;
  const neckRadius = options.neckRadius || 0.08;

  const radiiSource =
    Array.isArray(options.radii) && options.radii.length > 0
      ? options.radii
      : [baseRadius, neckRadius];

  const ringsPerSegment = Math.max(1, options.ringsPerSegment || 1);

  const radii = neckChain.map((_, idx) =>
    radiiSource[Math.min(idx, radiiSource.length - 1)]
  );

  // Build ring entries (centers along chain + radii + skin weights between boneA/boneB)
  const ringEntries = [];
  for (let i = 0; i < neckPoints.length - 1; i++) {
    const start = neckPoints[i];
    const end = neckPoints[i + 1];
    const r0 = radii[i];
    const r1 = radii[i + 1];

    for (let step = 0; step < ringsPerSegment; step++) {
      const t = step / ringsPerSegment;
      ringEntries.push({
        center: start.clone().lerp(end, t),
        radius: THREE.MathUtils.lerp(r0, r1, t),
        boneA: neckChain[i],
        boneB: neckChain[i + 1],
        weightA: 1 - t,
        weightB: t
      });
    }
  }

  ringEntries.push({
    center: neckPoints[neckPoints.length - 1].clone(),
    radius: radii[radii.length - 1],
    boneA: neckChain[neckChain.length - 1],
    boneB: neckChain[neckChain.length - 1],
    weightA: 1,
    weightB: 0
  });

  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];
  const ringAxes = [];

  // Rings
  for (let i = 0; i < ringEntries.length; i++) {
    const ringEntry = ringEntries[i];
    const center = ringEntry.center;

    const prev = i === 0 ? ringEntry.center : ringEntries[i - 1].center;
    const next = i === ringEntries.length - 1 ? ringEntry.center : ringEntries[i + 1].center;

    let axis = next.clone().sub(prev).normalize();
    if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3(0, 1, 0);
    ringAxes.push(axis.clone());

    const up = Math.abs(axis.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);

    const ring = createRing(center, axis, ringEntry.radius, sides, up);

    ringStarts.push(positions.length / 3);

    for (let j = 0; j < ring.length; j++) {
      const v = ring[j];

      positions.push(v.x, v.y + yOffset, v.z);

      const norm = v.clone().sub(center).normalize();
      normals.push(norm.x, norm.y, norm.z);

      uvs.push(j / sides, i / Math.max(1, ringEntries.length - 1));

      const boneA = getBoneIndex(ringEntry.boneA);
      const boneB = getBoneIndex(ringEntry.boneB);

      skinIndices.push(boneA, boneB, 0, 0);
      skinWeights.push(ringEntry.weightA, ringEntry.weightB, 0, 0);
    }
  }

  // Bridge rings
  for (let seg = 0; seg < ringEntries.length - 1; seg++) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  // Base cap (fan from center to first ring)
  if (capBase) {
    const baseStart = ringStarts[0];

    const baseAxis = ringAxes[0] ? ringAxes[0].clone() : new THREE.Vector3(0, 1, 0);
    const baseNormal = baseAxis.negate();

    // IMPORTANT: use the actual first ring center (not neckPoints[0]) for perfect alignment
    const baseCenter = ringEntries[0].center.clone();
    baseCenter.y += yOffset;

    positions.push(baseCenter.x, baseCenter.y, baseCenter.z);
    normals.push(baseNormal.x, baseNormal.y, baseNormal.z);
    uvs.push(0.5, 0);

    const baseBone = getBoneIndex(neckChain[0]);
    skinIndices.push(baseBone, baseBone, 0, 0);
    skinWeights.push(1, 0, 0, 0);

    const baseCenterIdx = positions.length / 3 - 1;

    for (let j = 0; j < sides; j++) {
      const a = baseStart + j;
      const b = baseStart + ((j + 1) % sides);
      indices.push(baseCenterIdx, b, a);
    }
  }

  // Tip taper/cap (THIS is what creates the "cap" at the top of the neck)
  // NEW: can be disabled with options.capTip = false
  if (capTip) {
    const rimStartIdx = ringStarts[ringStarts.length - 1];

    // Rim verts already include yOffset in positions (we stored v.y + yOffset above)
    const rimVerts = [];
    for (let j = 0; j < sides; j++) {
      rimVerts.push(new THREE.Vector3(
        positions[(rimStartIdx + j) * 3 + 0],
        positions[(rimStartIdx + j) * 3 + 1],
        positions[(rimStartIdx + j) * 3 + 2]
      ));
    }

    const neckTop = getPos(neckTopName);
    const headPos = getPos(headBoneName);

    // Build an apex partway toward the head.
    // NOTE: yOffset must be applied to all cap vertices, otherwise the cap intersects the neck and causes seams/clipping.
    const tipLerp = (typeof options.tipLerp === 'number') ? options.tipLerp : 0.5;
    const apex = neckTop.clone().lerp(headPos, tipLerp);
    apex.y += yOffset;

    const capSegments = Math.max(1, options.capSegments || 2);

    const neckTopIdx = getBoneIndex(neckTopName);
    const headIdx = getBoneIndex(headBoneName);

    // Add taper rings
    for (let seg = 1; seg <= capSegments; seg++) {
      const t = seg / capSegments;

      // Center of this taper ring (interpolates from rim ring center toward apex)
      // Use the average rim center to keep things stable even if the last ring isn't perfectly circular.
      const rimCenter = new THREE.Vector3();
      for (let j = 0; j < sides; j++) rimCenter.add(rimVerts[j]);
      rimCenter.multiplyScalar(1 / sides);

      const ringCenter = rimCenter.clone().lerp(apex, t);

      for (let j = 0; j < sides; j++) {
        const rimVert = rimVerts[j];

        // Simple taper toward apex
        const v = rimVert.clone().lerp(apex, t);
        positions.push(v.x, v.y, v.z);

        // Normal: outward from this taper ring center (better than apex->rim which causes weird shading)
        let n = v.clone().sub(ringCenter);
        if (n.lengthSq() < 1e-8) n = ringAxes[ringAxes.length - 1].clone();
        n.normalize();
        normals.push(n.x, n.y, n.z);

        uvs.push(j / sides, 1); // keep simple; neck body already has good UVs

        // Skin blend from neckTop -> head across the taper
        const wa = 1 - t;
        const wb = t;
        skinIndices.push(neckTopIdx, headIdx, 0, 0);
        skinWeights.push(wa, wb, 0, 0);
      }
    }

    // Apex vertex
    positions.push(apex.x, apex.y, apex.z);

    const tipAxis = ringAxes[ringAxes.length - 1] ? ringAxes[ringAxes.length - 1].clone() : new THREE.Vector3(0, 1, 0);
    tipAxis.normalize();
    normals.push(tipAxis.x, tipAxis.y, tipAxis.z);

    uvs.push(0.5, 1);

    skinIndices.push(headIdx, headIdx, 0, 0);
    skinWeights.push(1, 0, 0, 0);

    const apexIdx = positions.length / 3 - 1;

    // Connect last neck ring -> taper rings
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

    // Connect last taper ring -> apex
    const lastRingStart = base + sides * capSegments;
    for (let j = 0; j < sides; j++) {
      const a = lastRingStart + j;
      const b = lastRingStart + ((j + 1) % sides);
      indices.push(apexIdx, a, b);
    }
  }

  let geometry = buildBufferGeometry({
    positions,
    normals,
    skinIndices,
    skinWeights,
    uvs,
    indices
  });

  if (geometry.index) geometry = geometry.toNonIndexed();
  return geometry;
}
