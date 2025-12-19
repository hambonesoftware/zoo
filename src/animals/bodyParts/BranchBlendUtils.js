// src/animals/bodyParts/BranchBlendUtils.js

import * as THREE from 'three';

export function sampleTorsoRingSurface(geometry, ringData, ringIndex) {
  const ringStart = ringData.ringStarts[ringIndex] ?? 0;
  const segments = ringData.segments ?? 0;
  const center = ringData.ringCenters[ringIndex]?.clone() || new THREE.Vector3();
  const normal = ringData.ringNormals[ringIndex]?.clone() || new THREE.Vector3(1, 0, 0);
  const binormal = ringData.ringBinormals[ringIndex]?.clone() || new THREE.Vector3(0, 1, 0);
  const tangent = ringData.ringTangents[ringIndex]?.clone() || new THREE.Vector3(0, 0, 1);

  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');

  const positions = [];
  const normals = [];
  let radiusSum = 0;

  for (let i = 0; i < segments; i += 1) {
    const index = ringStart + i;
    const position = new THREE.Vector3().fromBufferAttribute(positionAttr, index);
    positions.push(position);
    if (normalAttr) {
      normals.push(new THREE.Vector3().fromBufferAttribute(normalAttr, index));
    }
    radiusSum += position.distanceTo(center);
  }

  const radius = segments > 0 ? radiusSum / segments : 0;

  return {
    center,
    normal,
    binormal,
    tangent,
    ringStart,
    segments,
    positions,
    normals,
    radius
  };
}

function projectPointToCylinderAlongDirection(origin, direction, center, axis, radius) {
  const dir = direction.clone().normalize();
  const axisDir = axis.clone().normalize();
  const dp = origin.clone().sub(center);

  const dirPerp = dir.clone().sub(axisDir.clone().multiplyScalar(dir.dot(axisDir)));
  const dpPerp = dp.clone().sub(axisDir.clone().multiplyScalar(dp.dot(axisDir)));

  const a = dirPerp.lengthSq();
  const b = 2 * dpPerp.dot(dirPerp);
  const c = dpPerp.lengthSq() - radius * radius;

  if (a < 1e-6) {
    return null;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  let t = null;
  if (t1 >= 0 && t2 >= 0) {
    t = Math.min(t1, t2);
  } else if (t1 >= 0) {
    t = t1;
  } else if (t2 >= 0) {
    t = t2;
  }

  if (t === null) {
    return null;
  }

  return origin.clone().add(dir.multiplyScalar(t));
}

export function projectLegRootRingVertices(
  legGeometry,
  legRootIndices,
  torsoRing,
  direction,
  outwardOffset = 0
) {
  const positionAttr = legGeometry.getAttribute('position');
  if (!positionAttr) return;

  const safeDirection =
    direction && direction.lengthSq() > 1e-6
      ? direction.clone().normalize()
      : torsoRing.normal.clone().normalize();

  const center = torsoRing.center;
  const axis = torsoRing.tangent.lengthSq() > 1e-6
    ? torsoRing.tangent.clone().normalize()
    : new THREE.Vector3(0, 0, 1);
  const radius = Math.max(0.0001, torsoRing.radius || 0.0001);

  legRootIndices.forEach((index) => {
    const origin = new THREE.Vector3().fromBufferAttribute(positionAttr, index);
    let projected = projectPointToCylinderAlongDirection(
      origin,
      safeDirection,
      center,
      axis,
      radius
    );

    if (!projected) {
      const axisOffset = center.clone().add(
        axis.clone().multiplyScalar(origin.clone().sub(center).dot(axis))
      );
      const radial = origin.clone().sub(axisOffset);
      if (radial.lengthSq() > 1e-6) {
        projected = axisOffset.clone().add(radial.normalize().multiplyScalar(radius));
      } else {
        projected = center.clone().add(torsoRing.normal.clone().normalize().multiplyScalar(radius));
      }
    }

    if (outwardOffset !== 0) {
      const axisOffset = center.clone().add(
        axis.clone().multiplyScalar(projected.clone().sub(center).dot(axis))
      );
      const radial = projected.clone().sub(axisOffset);
      if (radial.lengthSq() > 1e-6) {
        projected = projected.clone().add(radial.normalize().multiplyScalar(outwardOffset));
      }
    }

    positionAttr.setXYZ(index, projected.x, projected.y, projected.z);
  });

  positionAttr.needsUpdate = true;
}
