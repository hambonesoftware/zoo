import zipfile
import os
import io

# Define file contents
geometry_builder_code = """
import * as THREE from 'three';

/**
 * Creates a ring of vertices around a center point, oriented along an axis.
 * @param {THREE.Vector3} center - Center of the ring.
 * @param {THREE.Vector3} axis - Direction the ring faces (normal to the plane).
 * @param {number} radius - Radius of the ring.
 * @param {number} sides - Number of segments.
 * @param {THREE.Vector3} [up] - Optional up vector to stabilize rotation.
 * @returns {THREE.Vector3[]} Array of vertex positions.
 */
export function createRing(center, axis, radius, sides, up = new THREE.Vector3(0, 1, 0)) {
  // Orthonormal basis
  let tangent = new THREE.Vector3().crossVectors(axis, up).normalize();
  // If axis and up are parallel, fallback to X
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  let bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize();
  
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const theta = (i / sides) * Math.PI * 2;
    const v = new THREE.Vector3()
      .copy(tangent).multiplyScalar(Math.cos(theta) * radius)
      .addScaledVector(bitangent, Math.sin(theta) * radius)
      .add(center);
    verts.push(v);
  }
  return verts;
}

/**
 * Generates triangle indices to bridge two rings of vertices.
 * @param {number} ringA - Start index of the first ring.
 * @param {number} ringB - Start index of the second ring.
 * @param {number} sides - Number of segments in the rings.
 * @param {number[]} indices - Array to push indices into.
 */
export function bridgeRings(ringA, ringB, sides, indices) {
  for (let j = 0; j < sides; j++) {
    const nextJ = (j + 1) % sides;
    const a = ringA + j;
    const b = ringA + nextJ;
    const c = ringB + j;
    const d = ringB + nextJ;
    // Two triangles per quad
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
}

/**
 * Helper to build a BufferGeometry from standard arrays.
 */
export function buildBufferGeometry({ positions, normals, skinIndices, skinWeights, uvs, indices }) {
  const geometry = new THREE.BufferGeometry();
  if (positions && positions.length > 0) geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals && normals.length > 0) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (skinIndices && skinIndices.length > 0) geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  if (skinWeights && skinWeights.length > 0) geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  if (uvs && uvs.length > 0) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (indices && indices.length > 0) geometry.setIndex(indices);
  
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
"""

elephant_generator_code = """
// src/animals/ElephantGenerator.js

import * as THREE from 'three';
import { generateTorsoGeometry } from '../bodyParts/TorsoGenerator.js';
import { generateNeckGeometry } from '../bodyParts/NeckGenerator.js';
import { generateHeadGeometry } from '../bodyParts/HeadGenerator.js';
import { generateTailGeometry } from '../bodyParts/TailGenerator.js';
import { generateLimbGeometry } from '../bodyParts/LimbGenerator.js';
import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
import { ElephantBehavior } from './ElephantBehavior.js';

import { createElephantSkinMaterial } from './ElephantSkinNode.js';

/**
 * Utility: Converts geometry to non-indexed, strips smooth normals,
 * and recomputes them to create a hard-edged "Low Poly / Flat Shaded" look.
 */
function makeFlat(geometry) {
  // 1. Convert to non-indexed (triangle soup) so vertices aren't shared across faces
  let flatGeo = geometry.toNonIndexed();
  
  // 2. Delete existing smooth normals (if any)
  flatGeo.deleteAttribute('normal');
  
  // 3. Compute new normals based on flat faces
  flatGeo.computeVertexNormals();
  
  return flatGeo;
}

export class ElephantGenerator {
  static generate(skeleton, options = {}) {
    // Make sure all bone world matrices are current before sampling.
    skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

    const seed = typeof options.variantSeed === 'number' ? options.variantSeed : 0.5;
    const random01 = (s) => Math.abs(Math.sin(s * 43758.5453)) % 1;
    const variantFactor = random01(seed);

    const legScale    = 1.0 + (variantFactor - 0.5) * 0.2;
    const tuskScale   = 1.0 + (variantFactor - 0.5) * 0.3;
    const headScale   = 1.0 + (0.5 - variantFactor) * 0.15;

    // === 1. TORSO (Decagonal Prism) ===
    // Reduced sides from 28 to 10 for blocky look
    const torsoGeometry = makeFlat(generateTorsoGeometry(skeleton, {
      bones: ['spine_base', 'spine_mid', 'spine_neck', 'head'],
      radii: [1.15 * headScale, 1.35, 1.15, 0.9 * headScale],
      sides: 10 
    }));

    // === 2. HEAD (Low Poly Icosahedron) ===
    // Reduced detail significantly
    const headGeometry = makeFlat(generateHeadGeometry(skeleton, {
      parentBone: 'head',
      radius: 0.95 * headScale,
      detail: 0, // 0 subdivisions = 20 faces total (Icosahedron)
      sides: 1   // (Passed but mostly ignored by Icosahedron logic, kept for safety)
    }));

    // === 3. TRUNK (Hexagonal Tube) ===
    const trunkGeometry = makeFlat(generateTailGeometry(skeleton, {
      bones: ['trunk_base', 'trunk_mid1', 'trunk_mid2', 'trunk_tip'],
      sides: 6, // Hexagon
      baseRadius: 0.35,
      tipRadius: 0.1
    }));

    // === 4. TUSKS (Pentagonal) ===
    const leftTusk = makeFlat(generateTailGeometry(skeleton, {
      bones: ['tusk_left', 'tusk_left_tip'],
      sides: 5,
      baseRadius: 0.12,
      tipRadius: 0.02,
      lengthScale: tuskScale
    }));

    const rightTusk = makeFlat(generateTailGeometry(skeleton, {
      bones: ['tusk_right', 'tusk_right_tip'],
      sides: 5,
      baseRadius: 0.12,
      tipRadius: 0.02,
      lengthScale: tuskScale
    }));

    // === 5. EARS (Blocky Flaps) ===
    const leftEar = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['ear_left', 'ear_left_tip'],
      radii: [0.65, 0.35],
      sides: 4 // Square/Diamond cross section
    }));

    const rightEar = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['ear_right', 'ear_right_tip'],
      radii: [0.65, 0.35],
      sides: 4
    }));

    // === 6. TAIL (Pentagonal) ===
    const tailGeometry = makeFlat(generateTailGeometry(skeleton, {
      bones: ['tail_base', 'tail_mid', 'tail_tip'],
      sides: 5,
      baseRadius: 0.15,
      tipRadius: 0.05
    }));

    // === 7. LEGS (Hexagonal Pillars) ===
    const legConfig = { sides: 6 };

    const fl = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['front_left_collarbone', 'front_left_upper', 'front_left_lower', 'front_left_foot'],
      radii: [0.5 * legScale, 0.45 * legScale, 0.4 * legScale, 0.38 * legScale, 0.43 * legScale],
      ...legConfig
    }));

    const fr = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['front_right_collarbone', 'front_right_upper', 'front_right_lower', 'front_right_foot'],
      radii: [0.5 * legScale, 0.45 * legScale, 0.4 * legScale, 0.38 * legScale, 0.43 * legScale],
      ...legConfig
    }));

    const bl = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['back_left_pelvis', 'back_left_upper', 'back_left_lower', 'back_left_foot'],
      radii: [0.55 * legScale, 0.5 * legScale, 0.42 * legScale, 0.38 * legScale, 0.44 * legScale],
      ...legConfig
    }));

    const br = makeFlat(generateLimbGeometry(skeleton, {
      bones: ['back_right_pelvis', 'back_right_upper', 'back_right_lower', 'back_right_foot'],
      radii: [0.55 * legScale, 0.5 * legScale, 0.42 * legScale, 0.38 * legScale, 0.44 * legScale],
      ...legConfig
    }));

    // === Merge ===
    const mergedGeometry = mergeGeometries(
      [
        torsoGeometry,
        headGeometry,
        trunkGeometry,
        leftTusk,
        rightTusk,
        leftEar,
        rightEar,
        tailGeometry,
        fl,
        fr,
        bl,
        br
      ],
      false
    );

    // === Material (Node-based elephant skin) ===
    const material = createElephantSkinMaterial({
      bodyColor: options.bodyColor
    });

    const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);

    const behavior = new ElephantBehavior(skeleton, mesh);

    return { mesh, behavior };
  }
}
"""

elephant_skin_node_code = """
// src/animals/Elephant/ElephantSkinNode.js

import * as THREE from 'three'; 
import { texture, uv, positionLocal, color, float } from '../../../libs/three.tsl.js';
import { MeshStandardNodeMaterial } from '../../../libs/three.webgpu.js';
import { elephantSkinCanvasTexture } from './ElephantSkinTexture.js';

/**
 * ElephantSkinNode (v1.2 Low Poly / Matte Edition)
 *
 * Modified for a "MetaMask" style:
 * - High roughness (Matte/Paper/Clay look)
 * - Reduced texture noise intensity (so geometry facets are the hero)
 */
export function createElephantSkinMaterial(options = {}) {
  const baseColorHex =
    options.bodyColor !== undefined ? options.bodyColor : 0x999b9f;

  const material = new MeshStandardNodeMaterial({
    skinning: true
  });

  // 1. Low-frequency shading (simplified)
  const p = positionLocal.mul(0.22);
  const verticalBands = p.y.mul(3.0).sin().abs(); 
  const horizontalBands = p.x.mul(2.0).sin().abs();
  
  // Reduced intensity of bands for cleaner look
  const macroMask = verticalBands.add(horizontalBands).mul(0.3); 

  const baseCol = color(baseColorHex);
  // Less contrast in the macro color
  let macroColor = baseCol.mul(macroMask.mul(0.1).add(0.9));

  // 2. Texture Detail (Greatly Reduced for Low Poly style)
  const uvDetail = uv(); 
  const canvasSample = texture(elephantSkinCanvasTexture, uvDetail);
  const canvasRGB = canvasSample.rgb;
  
  // Make the texture very subtle, mostly just a slight grain
  const canvasBoost = canvasRGB.mul(0.15).add(0.9);

  // 3. Underside Darkening (Subtle AO)
  const undersideRaw = positionLocal.y.mul(-0.5);
  const undersideFactor = undersideRaw.mul(0.1).add(0.95);

  // 4. Region Colors (Kept for visual interest)
  const trunkMask = positionLocal.z.mul(0.5).add(0.35)
    .mul(positionLocal.y.mul(-0.25).add(0.75));
  const trunkColor = baseCol.mul(0.92);

  const legMask = positionLocal.y.mul(-1.0).mul(0.35).add(0.65);
  const legColor = baseCol.mul(1.05);

  const tuskMask = positionLocal.z.mul(0.6).add(0.4);
  const tuskColor = baseCol.mul(1.6); // Keep tusks bright

  const toeMask = positionLocal.y.mul(-2.0).add(1.4);
  const toeColor = baseCol.mul(1.15);

  const mixTrunk = macroColor
    .mul(float(1.0).sub(trunkMask))
    .add(trunkColor.mul(trunkMask));
  const mixLeg = mixTrunk
    .mul(float(1.0).sub(legMask))
    .add(legColor.mul(legMask));
  const mixTusk = mixLeg
    .mul(float(1.0).sub(tuskMask))
    .add(tuskColor.mul(tuskMask));
  const mixToe = mixTusk
    .mul(float(1.0).sub(toeMask))
    .add(toeColor.mul(toeMask));

  const finalColor = mixToe.mul(canvasBoost).mul(undersideFactor);

  material.colorNode = finalColor;

  // 5. Roughness & Metalness (Matte/Clay look)
  // High roughness to avoid "plastic" shininess and look more like paper/clay
  const baseRough = float(0.85); 
  const smoothRough = float(0.5); // Slightly smoother tusks
  
  material.roughnessNode = baseRough
    .mul(float(1.0).sub(tuskMask))
    .add(smoothRough.mul(tuskMask));

  material.metalnessNode = float(0.0); // No metalness for this art style

  // Subtle emissive to prevent total blackness in shadows
  material.emissive = new THREE.Color(0x222222);
  material.emissiveIntensity = 0.2;

  return material;
}
"""

# Map of filenames to their content (retrieved from user uploads + new code)
# NOTE: Using placeholders for the content of files I don't have to modify but need to include.
# In a real environment I would read the uploaded files. Since I cannot read "previous" uploaded files directly in this script context
# without them being passed in, I will assume the user has the original files and I am providing the *modified* package.
# However, to be helpful, I will include the *entire* set of files I have access to from the prompt context.

files_to_zip = {
    "src/animals/Elephant/ElephantGenerator.js": elephant_generator_code,
    "src/animals/Elephant/ElephantSkinNode.js": elephant_skin_node_code,
    "src/utils/GeometryBuilder.js": geometry_builder_code,
    # The following are copied verbatim from the user's provided text in the prompt
}

# --- 1. Populate standard files from the prompt context ---
# I will paste the content provided in the prompt history for the other files.

# ElephantLocomotion.js
files_to_zip["src/animals/Elephant/ElephantLocomotion.js"] = """
// src/animals/Elephant/ElephantLocomotion.js

import * as THREE from 'three';

export class ElephantLocomotion {
  constructor(elephant) {
    this.elephant = elephant;
    this.state = 'idle';
    this._stateTimer = 0;
    this._stateTime = 0;
    this.baseHeight = 0.45;       
    this.walkSpeed = 0.5;         
    this.wanderSpeed = 0.35;      
    this.turnSpeed = 0.4;         
    this.gaitDuration = 1.1;      
    this.gaitPhase = 0;           
    this.worldBoundsRadius = 5.0; 
    this.idleTimer = 1.2;         
    this.direction = new THREE.Vector3(0, 0, 1);
    this.tempVec = new THREE.Vector3();
    this._idleTime = 0;
    this.tempQuat = new THREE.Quaternion();
    this._spring = {
      trunk: { angle: 0, velocity: 0 },
      ears: { angle: 0, velocity: 0 },
      tail: { angle: 0, velocity: 0 }
    };
  }

  update(dt) {
    const bones = this.elephant.bones;
    const root = bones['spine_base'];
    const mesh = this.elephant.mesh;

    if (!bones || !root || !mesh) return;
    this._stateTime += dt;
    this._stateTimer -= dt;

    if (this._stateTimer <= 0) {
      if (this.state === 'idle') {
        const r = Math.random();
        if (r < 0.65) {
          this.state = 'idle';
          this._stateTimer = 4 + Math.random() * 3;
        } else if (r < 0.9) {
          this.state = 'wander';
          this._stateTimer = 5 + Math.random() * 4;
        } else {
          this.state = 'curious';
          this._stateTimer = 3 + Math.random() * 2;
        }
      } else {
        this.state = 'idle';
        this._stateTimer = 4 + Math.random() * 3;
      }
      this._stateTime = 0;
      if (this.elephant.setState) this.elephant.setState(this.state);
    }

    switch (this.state) {
      case 'wander':
        this.updateWander(dt, root, mesh, bones);
        break;
      case 'curious':
        this.updateCurious(dt, root, bones);
        break;
      case 'idle':
      default:
        this.updateIdle(dt, root, bones);
        break;
    }
    this.applySecondaryMotion(dt, bones);
  }

  updateIdle(dt, root, bones) {
    this._idleTime += dt;
    const breathe = Math.sin(this._idleTime * 1.0 + 0.3) * 0.025;
    const sway = Math.sin(this._idleTime * 0.3) * 0.02;
    root.position.set(sway, this.baseHeight + breathe, 0);

    const head = bones['head'];
    const spineNeck = bones['spine_neck'];
    const spineMid = bones['spine_mid'];

    if (spineMid) {
      spineMid.rotation.x = 0.03 * Math.sin(this._idleTime * 0.7);
      spineMid.rotation.z = 0.02 * Math.sin(this._idleTime * 0.5);
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.05 + 0.03 * Math.sin(this._idleTime * 0.8);
      spineNeck.rotation.y = 0.05 * Math.sin(this._idleTime * 0.6);
    }
    if (head) {
      head.rotation.x = -0.15 + 0.05 * Math.sin(this._idleTime * 0.9);
      head.rotation.y = 0.05 * Math.sin(this._idleTime * 0.7);
    }
  }

  updateWander(dt, root, mesh, bones) {
    const prevSpeed = this.walkSpeed;
    this.walkSpeed = this.wanderSpeed;
    this.updateWalk(dt, root, mesh, bones);
    this.walkSpeed = prevSpeed;
  }

  updateCurious(dt, root, bones) {
    root.position.set(0, this.baseHeight, 0);
    root.rotation.z = 0.02 * Math.sin(this._stateTime * 1.5);

    const spineNeck = bones['spine_neck'];
    const head = bones['head'];
    const trunkBase = bones['trunk_base'];
    const trunkMid = bones['trunk_mid'];
    const trunkTip = bones['trunk_tip'];

    if (spineNeck) {
      spineNeck.rotation.x = 0.1 + 0.05 * Math.sin(this._stateTime * 2.0);
      spineNeck.rotation.y = 0.1 * Math.sin(this._stateTime * 1.0);
    }
    if (head) {
      head.rotation.x = -0.05 + 0.07 * Math.sin(this._stateTime * 2.5);
      head.rotation.y = 0.08 * Math.sin(this._stateTime * 1.7);
    }
    const lift = 0.3 + 0.1 * Math.sin(this._stateTime * 2.2);
    if (trunkBase) {
      trunkBase.rotation.x = -lift * 0.5;
      trunkBase.rotation.y = 0.0;
    }
    if (trunkMid) {
      trunkMid.rotation.x = -lift * 0.8;
      trunkMid.rotation.y = 0.0;
    }
    if (trunkTip) {
      trunkTip.rotation.x = -lift;
      trunkTip.rotation.y = 0.0;
    }
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flap = 0.15 * Math.sin(this._stateTime * 3.0);
    if (earLeft) earLeft.rotation.z = flap;
    if (earRight) earRight.rotation.z = -flap;
  }

  applySecondaryMotion(dt, bones) {
    const speed = this.state === 'wander' ? this.wanderSpeed : 0;
    const trunkTarget = speed * 0.4;
    const earsTarget  = speed * 0.3;
    const tailTarget  = speed * 0.5;
    const stiffness = 10.0;
    const damping = 5.0;

    {
      const s = this._spring.trunk;
      const acc = (trunkTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      const trunkBase = bones['trunk_base'];
      const trunkMid1 = bones['trunk_mid1'] || bones['trunk_mid'];
      const trunkMid2 = bones['trunk_mid2'];
      const trunkTip = bones['trunk_tip'];
      if (trunkBase) trunkBase.rotation.y += s.angle * 0.7;
      if (trunkMid1) trunkMid1.rotation.y += s.angle * 0.5;
      if (trunkMid2) trunkMid2.rotation.y += s.angle * 0.35;
      if (trunkTip) trunkTip.rotation.y += s.angle * 0.2;
    }
    {
      const s = this._spring.ears;
      const acc = (earsTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      const earLeft = bones['ear_left'];
      const earRight = bones['ear_right'];
      if (earLeft) earLeft.rotation.z += s.angle;
      if (earRight) earRight.rotation.z -= s.angle;
    }
    {
      const s = this._spring.tail;
      const acc = (tailTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      const tailBase = bones['tail_base'];
      const tailMid = bones['tail_mid'];
      const tailTip = bones['tail_tip'];
      if (tailBase) tailBase.rotation.y += s.angle * 0.6;
      if (tailMid) tailMid.rotation.y += s.angle * 0.4;
      if (tailTip) tailTip.rotation.y += s.angle * 0.2;
    }
  }

  updateWalk(dt, root, mesh, bones) {
    this._idleTime += dt; 
    const TWO_PI = Math.PI * 2;
    this.gaitPhase = (this.gaitPhase + (dt / this.gaitDuration) * TWO_PI) % TWO_PI;

    const distFromOrigin = Math.sqrt(mesh.position.x ** 2 + mesh.position.z ** 2);
    if (distFromOrigin > this.worldBoundsRadius) {
      this.tempVec.set(-mesh.position.x, 0, -mesh.position.z).normalize();
      this.turnToward(this.tempVec, dt);
    } else if (Math.random() < dt * 0.2) {
      const randomTurn = (Math.random() - 0.5) * this.turnSpeed * dt;
      this.rotateDirection(randomTurn);
    }

    mesh.position.addScaledVector(this.direction, this.walkSpeed * dt);
    const heading = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = heading;

    const bobMain = Math.sin(this.gaitPhase * 2.0) * 0.06;   
    const roll = Math.sin(this.gaitPhase * 1.0) * 0.03;      
    root.position.set(0, this.baseHeight + bobMain, 0);
    root.rotation.z = roll;

    this.applyWalkPose(this.gaitPhase, bones);
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  rotateDirection(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.direction.x;
    const z = this.direction.z;
    this.direction.x = x * cos - z * sin;
    this.direction.z = x * sin + z * cos;
    this.direction.normalize();
  }

  turnToward(targetDir, dt) {
    const currentHeading = Math.atan2(this.direction.x, this.direction.z);
    const targetHeading = Math.atan2(targetDir.x, targetDir.z);
    let delta = targetHeading - currentHeading;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const maxTurn = this.turnSpeed * dt;
    delta = THREE.MathUtils.clamp(delta, -maxTurn, maxTurn);
    this.rotateDirection(delta);
  }

  applyWalkPose(phase, bones) {
    const TWO_PI = Math.PI * 2;
    const phaseLeft = phase;                      
    const phaseRight = (phase + Math.PI) % TWO_PI;

    const swingAmpFront = 0.4;  
    const swingAmpBack = 0.5;   
    const kneeBendFront = 0.7;
    const kneeBendBack = 0.9;

    const swingLeft = Math.sin(phaseLeft);
    const swingRight = Math.sin(phaseRight);

    const blUpper = bones['back_left_upper_leg'];
    const blLower = bones['back_left_lower_leg'];
    if (blUpper && blLower) {
      blUpper.rotation.x = swingAmpBack * swingLeft;
      blLower.rotation.x = kneeBendBack * Math.max(0, -swingLeft);
    }

    const flUpper = bones['front_left_upper_leg'];
    const flLower = bones['front_left_lower_leg'];
    const swingLeftFront = Math.sin(phaseLeft + 0.3);
    if (flUpper && flLower) {
      flUpper.rotation.x = swingAmpFront * swingLeftFront;
      flLower.rotation.x = kneeBendFront * Math.max(0, -swingLeftFront);
    }

    const brUpper = bones['back_right_upper_leg'];
    const brLower = bones['back_right_lower_leg'];
    if (brUpper && brLower) {
      brUpper.rotation.x = swingAmpBack * swingRight;
      brLower.rotation.x = kneeBendBack * Math.max(0, -swingRight);
    }

    const frUpper = bones['front_right_upper_leg'];
    const frLower = bones['front_right_lower_leg'];
    const swingRightFront = Math.sin(phaseRight + 0.3);
    if (frUpper && frLower) {
      frUpper.rotation.x = swingAmpFront * swingRightFront;
      frLower.rotation.x = kneeBendFront * Math.max(0, -swingRightFront);
    }

    const spineMid = bones['spine_mid'];
    const spineNeck = bones['spine_neck'];
    const head = bones['head'];

    const bodyPitch = Math.sin(phase * 1.0) * 0.03;
    const bodyYaw = Math.sin(phase * 0.5) * 0.02;

    if (spineMid) {
      spineMid.rotation.x = bodyPitch;
      spineMid.rotation.y = bodyYaw * 0.7;
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.1 + bodyPitch * 0.5;
      spineNeck.rotation.y = bodyYaw;
    }
    if (head) {
      head.rotation.x = -0.2 + bodyPitch * -0.3;
      head.rotation.y = bodyYaw * 1.2;
    }
  }

  applyTrunkWalk(bones, t, phase) {
    const trunkBase = bones['trunk_base'];
    const trunkMid = bones['trunk_mid'];
    const trunkTip = bones['trunk_tip'];
    if (!trunkBase && !trunkMid && !trunkTip) return;

    const gaitSway = Math.sin(phase) * 0.25;      
    const gaitDip = Math.sin(phase * 2.0) * 0.1;  
    const idleSway = Math.sin(t * 0.6) * 0.08;
    const idleDip = Math.sin(t * 0.8) * 0.05;
    const sway = gaitSway + idleSway;
    const dip = gaitDip + idleDip;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.8;
      trunkBase.rotation.x = dip * 0.4;
    }
    if (trunkMid) {
      trunkMid.rotation.y = sway * 0.6;
      trunkMid.rotation.x = dip * 0.8;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 0.5;
      trunkTip.rotation.x = dip * 1.0;
    }
  }

  applyEarWalk(bones, t, phase) {
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    if (!earLeft && !earRight) return;
    const gaitFlap = Math.sin(phase * 2.0) * 0.18;
    const idleFlap = Math.sin(t * 0.9) * 0.08;
    const totalLeft = gaitFlap + idleFlap;
    const totalRight = gaitFlap + idleFlap * 0.9;
    if (earLeft) earLeft.rotation.z = totalLeft;
    if (earRight) earRight.rotation.z = -totalRight;
  }
}
"""

files_to_zip["src/animals/Elephant/ElephantCreature.js"] = """
// src/animals/ElephantCreature.js

import * as THREE from 'three';
import { ElephantDefinition } from './ElephantDefinition.js';
import { ElephantGenerator } from './ElephantGenerator.js';

export class ElephantCreature extends THREE.Group {
  constructor(options = {}) {
    super();
    this.bones = this._buildBonesFromDefinition(ElephantDefinition.bones);
    this.skeleton = new THREE.Skeleton(this.bones);
    const rootBone = this.bones.find(b => b.name === 'spine_base') || this.bones[0];
    this.add(rootBone);
    this.updateMatrixWorld(true);
    
    const { mesh, behavior } = ElephantGenerator.generate(this.skeleton, options);
    this.mesh = mesh;
    this.behavior = behavior; 

    this.add(mesh);

    if (options.debug) {
        this.skeletonHelper = new THREE.SkeletonHelper(this.mesh);
        this.skeletonHelper.material.linewidth = 2;
        this.skeletonHelper.material.color.set(0xffff00); 
        this.add(this.skeletonHelper);
    }
    if (options.position) this.position.fromArray(options.position);
    if (options.scale) this.scale.setScalar(options.scale);
  }

  _buildBonesFromDefinition(boneDefs) {
    const boneMap = {};
    for (const def of boneDefs) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.fromArray(def.position);
      boneMap[def.name] = bone;
    }
    for (const def of boneDefs) {
      if (def.parent && boneMap[def.parent] && def.parent !== 'root') {
        boneMap[def.parent].add(boneMap[def.name]);
      }
    }
    return boneDefs.map(def => boneMap[def.name]);
  }

  update(delta) {
    if (this.behavior) this.behavior.update(delta);
    if (this.skeletonHelper) this.skeletonHelper.update();
  }
}
"""

files_to_zip["src/animals/Elephant/ElephantDefinition.js"] = """
// src/animals/ElephantDefinition.js

export const ElephantDefinition = {
  bones: [
    { name: 'spine_base',  parent: 'root',       position: [0, 2.1, 0] }, 
    { name: 'spine_mid',   parent: 'spine_base', position: [0, -0.1, 1.1] },
    { name: 'spine_neck',  parent: 'spine_mid',  position: [0, 0.3, 0.9] },
    { name: 'head',        parent: 'spine_neck', position: [0, -0.1, 0.7] },
    { name: 'trunk_base',  parent: 'head',        position: [0, -0.3, 0.6] },
    { name: 'trunk_mid1',  parent: 'trunk_base',  position: [0, -0.5, 0.1] },
    { name: 'trunk_mid2',  parent: 'trunk_mid1',  position: [0, -0.5, 0.0] },
    { name: 'trunk_tip',   parent: 'trunk_mid2',  position: [0, -0.4, 0.0] },
    { name: 'tusk_left',   parent: 'head',        position: [ 0.3, -0.3, 0.4] },
    { name: 'tusk_left_tip', parent: 'tusk_left', position: [ 0.1, 0.3, 0.5] }, 
    { name: 'tusk_right',  parent: 'head',        position: [-0.3, -0.3, 0.4] },
    { name: 'tusk_right_tip', parent: 'tusk_right', position: [-0.1, 0.3, 0.5] },
    { name: 'ear_left',    parent: 'head',        position: [ 0.4, 0.1, -0.2] },
    { name: 'ear_left_tip', parent: 'ear_left',   position: [ 0.6, -0.6, -0.1] }, 
    { name: 'ear_right',   parent: 'head',        position: [-0.4, 0.1, -0.2] },
    { name: 'ear_right_tip', parent: 'ear_right', position: [-0.6, -0.6, -0.1] },
    { name: 'tail_base',   parent: 'spine_base', position: [0, 0.3, -0.3] },
    { name: 'tail_mid',    parent: 'tail_base',  position: [0, -0.6, -0.2] }, 
    { name: 'tail_tip',    parent: 'tail_mid',   position: [0, -0.6, 0.0] },
    { name: 'front_left_collarbone',  parent: 'spine_mid', position: [ 0.4, -0.3, 0.3] },
    { name: 'front_right_collarbone', parent: 'spine_mid', position: [-0.4, -0.3, 0.3] },
    { name: 'back_left_pelvis',  parent: 'spine_base', position: [ 0.45, -0.2, 0.1] },
    { name: 'back_right_pelvis', parent: 'spine_base', position: [-0.45, -0.2, 0.1] },
    { name: 'front_left_upper',  parent: 'front_left_collarbone', position: [0, -0.8, 0] },
    { name: 'front_left_lower',  parent: 'front_left_upper',      position: [0, -0.8, 0.05] },
    { name: 'front_left_foot',   parent: 'front_left_lower',      position: [0, -0.4, 0.05] },
    { name: 'front_right_upper', parent: 'front_right_collarbone', position: [0, -0.8, 0] },
    { name: 'front_right_lower', parent: 'front_right_upper',      position: [0, -0.8, 0.05] },
    { name: 'front_right_foot',  parent: 'front_right_lower',      position: [0, -0.4, 0.05] },
    { name: 'back_left_upper',   parent: 'back_left_pelvis',  position: [0, -0.8, 0.05] },
    { name: 'back_left_lower',   parent: 'back_left_upper',   position: [0, -0.8, -0.1] },
    { name: 'back_left_foot',    parent: 'back_left_lower',   position: [0, -0.4, 0.1] },
    { name: 'back_right_upper',  parent: 'back_right_pelvis',  position: [0, -0.8, 0.05] },
    { name: 'back_right_lower',  parent: 'back_right_upper',   position: [0, -0.8, -0.1] },
    { name: 'back_right_foot',   parent: 'back_right_lower',   position: [0, -0.4, 0.1] }
  ],
  sizes: {}
};
"""

files_to_zip["src/animals/Elephant/ElephantSkinTexture.js"] = """
// src/animals/Elephant/ElephantSkinTexture.js
import * as THREE from 'three';

export function createElephantSkinCanvasTexture(options = {}) {
  const size = options.size || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }
  const baseR = 115;
  const baseG = 115;
  const baseB = 120;
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, size, size);
  
  // (Reduced visual noise for low poly version)
  const patchCount = 100;
  for (let i = 0; i < patchCount; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = (size / 20) + Math.random() * (size / 10);
    const dark = Math.random() < 0.5;
    const delta = 10 + Math.random() * 10; 
    const rCol = baseR + (dark ? -delta : delta);
    const gCol = baseG + (dark ? -delta : delta * 0.9);
    const bCol = baseB + (dark ? -delta * 0.8 : delta * 0.5);
    ctx.fillStyle = `rgba(${rCol|0},${gCol|0},${bCol|0},0.12)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.7, Math.random()*Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

export const elephantSkinCanvasTexture = createElephantSkinCanvasTexture();
"""

files_to_zip["src/animals/Elephant/ElephantPen.js"] = """
// src/animals/ElephantPen.js

import { ElephantCreature } from './ElephantCreature.js';
import * as THREE from 'three';

export class ElephantPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.radius = options.radius || 2.0;
    this.padHeight = options.padHeight || 0.17;
    this.markerRadius = options.markerRadius || 0.13;
    this.markerHeight = options.markerHeight || 0.13;
    this.markerColor = options.markerColor || 0x227bc4;
    this.lineColor = options.lineColor || 0x166597;
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    const gridSize = this.radius * 2.2;
    const gridDivisions = 22;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const wallSize = gridSize;
    const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x222324,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    const gridXZFloor = new THREE.GridHelper(gridSize, gridDivisions, 0x222222, 0x888888);
    gridXZFloor.position.set(0, 0.01, 0);
    gridXZFloor.receiveShadow = true;
    this.group.add(gridXZFloor);

    const wallYZ = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallYZ.position.set(-wallSize / 2, wallSize / 2, 0);
    wallYZ.rotation.y = Math.PI / 2;
    wallYZ.receiveShadow = true;
    this.group.add(wallYZ);

    const wallXY = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallXY.material.color.set(0x1b1c1d);
    wallXY.position.set(0, wallSize / 2, -wallSize / 2);
    wallXY.receiveShadow = true;
    this.group.add(wallXY);

    const axesLen = this.radius * 1.5;
    const axesHelper = new THREE.AxesHelper(axesLen);
    axesHelper.position.set(0, this.padHeight + 0.02, 0);
    this.group.add(axesHelper);

    const padGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.padHeight, 48);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x8a8a88, roughness: 0.7 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, this.padHeight / 2, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.group.add(pad);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.85);
    this.group.add(hemiLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.group.add(ambientLight);
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, this.padHeight + 1.2, 0);
    this.group.add(lightTarget);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(4, 5, 4);
    keyLight.target = lightTarget;
    keyLight.castShadow = true;
    this.group.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-3, 3, 2);
    fillLight.target = lightTarget;
    this.group.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 4.5, -4);
    rimLight.target = lightTarget;
    this.group.add(rimLight);

    const elephantScale = typeof options.scale === 'number' ? options.scale : 0.75;
    this.Elephant = new ElephantCreature({ scale: elephantScale, debug: !!options.debugElephant });
    const elephantY = this.padHeight + 1.5;
    this.Elephant.position.set(0, elephantY, 0);
    const defaultYaw = Math.PI * 0.3;
    this.Elephant.rotation.y = typeof options.rotationY === 'number' ? options.rotationY : defaultYaw;
    this.group.add(this.Elephant);
    if (this.Elephant.mesh) {
      this.Elephant.mesh.castShadow = true;
      this.Elephant.mesh.receiveShadow = true;
    }

    this.turntable = !!options.turntable;
    this.bboxHelper = new THREE.BoxHelper(this.Elephant, 0xffff66);
    this.bboxHelper.material.transparent = true;
    this.bboxHelper.material.opacity = 0.35;
    this.bboxHelper.visible = options.showBoundingBox !== undefined ? !!options.showBoundingBox : true;
    this.group.add(this.bboxHelper);

    scene.add(this.group);
  }

  _addAxisLabel(text, x, y, z, color, group) { }

  update(dt) {
    if (this.Elephant && typeof this.Elephant.update === 'function') {
      this.Elephant.update(dt);
    }
    if (this.bboxHelper && this.Elephant) {
      this.bboxHelper.setFromObject(this.Elephant);
    }
    if (this.turntable && this.Elephant) {
      this.Elephant.rotation.y += dt * 0.3;
    }
  }
}
"""

files_to_zip["src/animals/Elephant/ElephantBehavior.js"] = """
// src/animals/Elephant/ElephantBehavior.js
import * as THREE from 'three';
import { ElephantLocomotion } from './ElephantLocomotion.js';

export class ElephantBehavior {
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.time = 0;
    this.state = 'idle';
    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });
    this.locomotion = new ElephantLocomotion(this);
    this.debug = { enabled: !!opts.debug };
  }
  setState(nextState) { this.state = nextState; }
  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;
    this.time += dt;
    if (this.locomotion && typeof this.locomotion.update === 'function') {
      this.locomotion.update(dt);
    }
    this.skeleton.bones.forEach((bone) => {
      bone.updateMatrixWorld(true);
    });
  }
  getDebugInfo() {
    return {
      state: this.state,
      time: this.time,
      locomotionState: this.locomotion ? this.locomotion.state : null
    };
  }
}
"""

# Body Part Generators (Verbatim from upload content)
files_to_zip["src/animals/bodyParts/TorsoGenerator.js"] = """
// src/animals/bodyParts/TorsoGenerator.js
import * as THREE from 'three';
import { createRing, bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

export function generateTorsoGeometry(skeleton, options = {}) {
  const spineBoneNames = options.bones || ['spine_base', 'spine_mid'];
  const sides = options.sides || 8; 

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => {
    boneIndexMap[bone.name] = idx;
  });
  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

  const getPos = name => {
    const idx = boneIndexMap[name];
    const bone = skeleton.bones[idx];
    if (!bone) throw new Error(`Missing bone: ${name}`);
    return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
  };
  const leftPelvis = getPos('back_left_pelvis');
  const rightPelvis = getPos('back_right_pelvis');
  const rearCenter = leftPelvis.clone().lerp(rightPelvis, 0.5);
  const rearRadius = leftPelvis.distanceTo(rightPelvis) / 2;

  const spinePoints = spineBoneNames.map(getPos);
  const leftCollar = getPos('front_left_collarbone');
  const rightCollar = getPos('front_right_collarbone');
  const frontCenter = leftCollar.clone().lerp(rightCollar, 0.5);
  const frontRadius = leftCollar.distanceTo(rightCollar) / 2;

  const useShoulderBase = true; 
  let ringCenters, radii, skinRefs;

  if (useShoulderBase) {
    const spineMid = spinePoints[spinePoints.length - 1];
    const shoulderBase = spineMid.clone().lerp(frontCenter, 0.5);
    const shoulderRadius = (spineMid.distanceTo(frontCenter) / 2 + frontRadius) / 2;
    ringCenters = [rearCenter, ...spinePoints, shoulderBase, frontCenter];
    radii = [rearRadius, ...spinePoints.map((_, i) => 0.16 - 0.03 * i), shoulderRadius, frontRadius];
    skinRefs = [
      spineBoneNames[0], 
      ...spineBoneNames, 
      spineBoneNames[spineBoneNames.length - 1], 
      spineBoneNames[spineBoneNames.length - 1], 
    ];
  } else {
    ringCenters = [rearCenter, ...spinePoints, frontCenter];
    radii = [rearRadius, ...spinePoints.map((_, i) => 0.16 - 0.03 * i), frontRadius];
    skinRefs = [
      spineBoneNames[0],
      ...spineBoneNames,
      spineBoneNames[spineBoneNames.length - 1],
    ];
  }

  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];

  for (let i = 0; i < ringCenters.length; i++) {
    const center = ringCenters[i];
    const axis =
      (i === ringCenters.length - 1)
        ? center.clone().sub(ringCenters[i - 1]).normalize()
        : ringCenters[i + 1].clone().sub(center).normalize();
    const ring = createRing(center, axis, radii[i], sides);

    ringStarts.push(positions.length / 3);

    for (let j = 0; j < ring.length; j++) {
      const v = ring[j];
      positions.push(v.x, v.y, v.z);
      const norm = v.clone().sub(center).normalize();
      normals.push(norm.x, norm.y, norm.z);
      uvs.push(j / sides, i / (ringCenters.length - 1));
      const mainBone = boneIndexMap[skinRefs[i]];
      skinIndices.push(mainBone, mainBone, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
  }

  for (let seg = 0; seg < ringCenters.length - 1; seg++) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += options.yOffset || 0.0;
  }
  
	const lastRingIdx = 0; 
	const rearRimRingIdx = 0; 
	const rearRimIdx = 1; 
	const rearRimStartIdx = rearRimIdx * sides;

	const rearRimVerts = [];
	for (let j = 0; j < sides; j++) {
	  rearRimVerts.push(new THREE.Vector3(
		positions[(rearRimStartIdx + j) * 3 + 0],
		positions[(rearRimStartIdx + j) * 3 + 1],
		positions[(rearRimStartIdx + j) * 3 + 2]
	  ));
	}

	const lastRingCenter = ringCenters[rearRimIdx];
	const lastRingRadius = radii[rearRimIdx];
	const rearApex = lastRingCenter.clone().add(
	  getPos('tail_base').clone().sub(lastRingCenter).normalize()
		.multiplyScalar((lastRingRadius + (options.rearCapBulge || 0.035)) * 1.15)
	);

	const rearCapSegments = 2;
	const rearCapVerts = [];
	const rearCapNormals = [];
	const rearCapUVs = [];
	const rearCapSkinIndices = [];
	const rearCapSkinWeights = [];

	for (let seg = 0; seg <= rearCapSegments; seg++) {
	  const t = seg / rearCapSegments; 
	  for (let j = 0; j < sides; j++) {
		let v;
		if (seg === 0) {
		  v = rearRimVerts[j].clone();
		} else {
		  v = rearRimVerts[j].clone().lerp(rearApex, t);
		}
		rearCapVerts.push(v.x, v.y, v.z);
		const normal = (seg === 0)
		  ? v.clone().sub(lastRingCenter).normalize()
		  : rearApex.clone().sub(rearRimVerts[j]).normalize();
		rearCapNormals.push(normal.x, normal.y, normal.z);
		rearCapUVs.push(j / sides, t);
		let skinA = boneIndexMap[skinRefs[rearRimIdx]];
		let skinB = boneIndexMap['tail_base'];
		let wa = 1 - t;
		let wb = t;
		rearCapSkinIndices.push(skinA, skinB, 0, 0);
		rearCapSkinWeights.push(wa, wb, 0, 0);
	  }
	}
	rearCapVerts.push(rearApex.x, rearApex.y, rearApex.z);
	rearCapNormals.push(0, 0, -1); 
	rearCapUVs.push(0.5, 1);
	rearCapSkinIndices.push(boneIndexMap['tail_base'], boneIndexMap['tail_base'], 0, 0);
	rearCapSkinWeights.push(1, 0, 0, 0);

	positions.push(...rearCapVerts);
	normals.push(...rearCapNormals);
	uvs.push(...rearCapUVs);
	skinIndices.push(...rearCapSkinIndices);
	skinWeights.push(...rearCapSkinWeights);

	const rearBaseIdx = positions.length / 3 - rearCapVerts.length / 3;
	for (let seg = 0; seg < rearCapSegments; seg++) {
	  const ring0 = rearBaseIdx + seg * sides;
	  const ring1 = rearBaseIdx + (seg + 1) * sides;
	  for (let j = 0; j < sides; j++) {
		const a = ring0 + j;
		const b = ring0 + ((j + 1) % sides);
		const c = ring1 + j;
		const d = ring1 + ((j + 1) % sides);
		indices.push(a, c, b);
		indices.push(b, c, d);
	  }
	}
	const rearLastRingStart = rearBaseIdx + sides * rearCapSegments;
	for (let j = 0; j < sides; j++) {
	  const a = rearLastRingStart + j;
	  const b = rearLastRingStart + ((j + 1) % sides);
	  indices.push(positions.length / 3 - 1, a, b); 
	}

	const neckBase = getPos('spine_neck');
	const capSegments = 2; 
	const rimStartIdx = (ringCenters.length - 1) * sides;

	const rimVerts = [];
	for (let j = 0; j < sides; j++) {
	  rimVerts.push(new THREE.Vector3(
		positions[(rimStartIdx + j) * 3 + 0],
		positions[(rimStartIdx + j) * 3 + 1],
		positions[(rimStartIdx + j) * 3 + 2]
	  ));
	}

	const frontCapVerts = [];
	const frontCapNormals = [];
	const frontCapUVs = [];
	const frontCapSkinIndices = [];
	const frontCapSkinWeights = [];

	for (let seg = 0; seg <= capSegments; seg++) {
	  const t = seg / capSegments; 
	  for (let j = 0; j < sides; j++) {
		let v;
		if (seg === 0) {
		  v = rimVerts[j].clone(); 
		} else {
		  v = rimVerts[j].clone().lerp(neckBase, t); 
		}
		frontCapVerts.push(v.x, v.y, v.z);
		const normal = (seg === 0)
		  ? v.clone().sub(frontCenter).normalize()
		  : neckBase.clone().sub(rimVerts[j]).normalize();
		frontCapNormals.push(normal.x, normal.y, normal.z);
		frontCapUVs.push(j / sides, t);
		let skinA = boneIndexMap[skinRefs[skinRefs.length - 1]];
		let skinB = boneIndexMap['spine_neck'];
		let wa = 1 - t;
		let wb = t;
		frontCapSkinIndices.push(skinA, skinB, 0, 0);
		frontCapSkinWeights.push(wa, wb, 0, 0);
	  }
	}

	frontCapVerts.push(neckBase.x, neckBase.y, neckBase.z);
	frontCapNormals.push(0, 0, 1); 
	frontCapUVs.push(0.5, 1);
	frontCapSkinIndices.push(boneIndexMap['spine_neck'], boneIndexMap['spine_neck'], 0, 0);
	frontCapSkinWeights.push(1, 0, 0, 0);
	const apexIdx = frontCapVerts.length / 3 - 1;

	positions.push(...frontCapVerts);
	normals.push(...frontCapNormals);
	uvs.push(...frontCapUVs);
	skinIndices.push(...frontCapSkinIndices);
	skinWeights.push(...frontCapSkinWeights);

	const frontBaseIdx = positions.length / 3 - frontCapVerts.length / 3;
	for (let seg = 0; seg < capSegments; seg++) {
	  const ring0 = frontBaseIdx + seg * sides;
	  const ring1 = frontBaseIdx + (seg + 1) * sides;
	  for (let j = 0; j < sides; j++) {
		const a = ring0 + j;
		const b = ring0 + ((j + 1) % sides);
		const c = ring1 + j;
		const d = ring1 + ((j + 1) % sides);
		indices.push(a, c, b);
		indices.push(b, c, d);
	  }
	}
	const lastRingStart = frontBaseIdx + sides * capSegments;
	for (let j = 0; j < sides; j++) {
	  const a = lastRingStart + j;
	  const b = lastRingStart + ((j + 1) % sides);
	  indices.push(positions.length / 3 - 1, a, b); 
	}

  let geometry = buildBufferGeometry({
    positions, normals, skinIndices, skinWeights, uvs, indices
  });

  if (geometry.index) geometry = geometry.toNonIndexed();
  return geometry;
}
"""

files_to_zip["src/animals/bodyParts/LimbGenerator.js"] = """
// src/animals/bodyParts/LimbGenerator.js
import * as THREE from 'three';
import { createRing, bridgeRings, buildBufferGeometry } from '../../utils/GeometryBuilder.js';

function buildBulgedEndCap({ rimVerts, apex, segments, sides, center, skinA, skinB, boneWeightFunc = t => [1 - t, t], uvBase = 0 }) {
  const capVerts = [];
  const capNormals = [];
  const capUVs = [];
  const capSkinIndices = [];
  const capSkinWeights = [];

  for (let seg = 0; seg <= segments; seg++) {
    const t = seg / segments;
    for (let j = 0; j < sides; j++) {
      let v = (seg === 0) ? rimVerts[j].clone() : rimVerts[j].clone().lerp(apex, t);
      capVerts.push(v.x, v.y, v.z);
      const normal = (seg === 0) ? v.clone().sub(center).normalize() : apex.clone().sub(rimVerts[j]).normalize();
      capNormals.push(normal.x, normal.y, normal.z);
      capUVs.push(j / sides, uvBase + t);
      const [wa, wb] = boneWeightFunc(t);
      capSkinIndices.push(skinA, skinB, 0, 0);
      capSkinWeights.push(wa, wb, 0, 0);
    }
  }
  capVerts.push(apex.x, apex.y, apex.z);
  capNormals.push(0, 0, 1);
  capUVs.push(0.5, uvBase + 1);
  capSkinIndices.push(skinB, skinB, 0, 0);
  capSkinWeights.push(1, 0, 0, 0);
  const apexIdx = capVerts.length / 3 - 1;
  return { capVerts, capNormals, capUVs, capSkinIndices, capSkinWeights, apexIdx };
}

export function generateLimbGeometry(skeleton, options = {}) {
  const boneNames = options.bones || [
    options.shoulderBone || 'front_left_collarbone',
    options.upperBone || 'front_left_upper_leg',
    options.lowerBone || 'front_left_lower_leg',
    options.pawBone || 'front_left_paw'
  ];
  const sides = options.sides || 7;
  const radii = options.radii || [0.075, 0.060, 0.050, 0.035];
  const yOffset = options.yOffset || 0;

  const boneIndexMap = {};
  skeleton.bones.forEach((bone, idx) => { boneIndexMap[bone.name] = idx; });
  skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));

  const getPos = name => {
    const idx = boneIndexMap[name];
    const bone = skeleton.bones[idx];
    if (!bone) throw new Error(`Missing bone: ${name}`);
    return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
  };
  const points = boneNames.map(getPos);

  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const uvs = [];
  const indices = [];
  const ringStarts = [];

  for (let i = 0; i < points.length; i++) {
    const center = points[i];
    const axis = (i === points.length - 1)
        ? center.clone().sub(points[i - 1]).normalize()
        : points[i + 1].clone().sub(center).normalize();
    const ring = createRing(center, axis, radii[i], sides);

    ringStarts.push(positions.length / 3);

    for (let j = 0; j < ring.length; j++) {
      const v = ring[j];
      positions.push(v.x, v.y + yOffset, v.z);
      const norm = v.clone().sub(center).normalize();
      normals.push(norm.x, norm.y, norm.z);
      uvs.push(j / sides, i / (points.length - 1));
      const mainBone = boneIndexMap[boneNames[i]];
      skinIndices.push(mainBone, mainBone, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
  }

  for (let seg = 0; seg < points.length - 1; seg++) {
    bridgeRings(ringStarts[seg], ringStarts[seg + 1], sides, indices);
  }

  const rimStartIdx = 0;
  const rimVerts = [];
  for (let j = 0; j < sides; j++) {
    rimVerts.push(new THREE.Vector3(
      positions[(rimStartIdx + j) * 3 + 0],
      positions[(rimStartIdx + j) * 3 + 1],
      positions[(rimStartIdx + j) * 3 + 2]
    ));
  }
  const parentBone = getPos(options.parentBone || boneNames[0]);
  const shoulderApex = parentBone.clone().lerp(points[0], -0.25);
  const capSegments = 2;
  const { capVerts, capNormals, capUVs, capSkinIndices, capSkinWeights, apexIdx } = buildBulgedEndCap({
    rimVerts,
    apex: shoulderApex,
    segments: capSegments,
    sides,
    center: points[0],
    skinA: boneIndexMap[boneNames[0]],
    skinB: boneIndexMap[boneNames[1]],
    boneWeightFunc: t => [1 - t, t],
    uvBase: -0.35
  });

  positions.push(...capVerts);
  normals.push(...capNormals);
  uvs.push(...capUVs);
  skinIndices.push(...capSkinIndices);
  skinWeights.push(...capSkinWeights);

  const baseIdx = positions.length / 3 - capVerts.length / 3;
  for (let seg = 0; seg < capSegments; seg++) {
    const ring0 = baseIdx + seg * sides;
    const ring1 = baseIdx + (seg + 1) * sides;
    for (let j = 0; j < sides; j++) {
      const a = ring0 + j;
      const b = ring0 + ((j + 1) % sides);
      const c = ring1 + j;
      const d = ring1 + ((j + 1) % sides);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const lastRingStart = baseIdx + sides * capSegments;
  for (let j = 0; j < sides; j++) {
    const a = lastRingStart + j;
    const b = lastRingStart + ((j + 1) % sides);
    indices.push(positions.length / 3 - 1, a, b);
  }

  const tipRimStartIdx = ringStarts[ringStarts.length - 1];
  const tipRimVerts = [];
  for (let j = 0; j < sides; j++) {
    tipRimVerts.push(new THREE.Vector3(
      positions[(tipRimStartIdx + j) * 3 + 0],
      positions[(tipRimStartIdx + j) * 3 + 1],
      positions[(tipRimStartIdx + j) * 3 + 2]
    ));
  }
  const tipApex = points[points.length - 1].clone().add(
    points[points.length - 1].clone().sub(points[points.length - 2]).normalize().multiplyScalar(-0.015)
  );
  const tipCap = buildBulgedEndCap({
    rimVerts: tipRimVerts,
    apex: tipApex,
    segments: 1,
    sides,
    center: points[points.length - 1],
    skinA: boneIndexMap[boneNames[boneNames.length - 1]],
    skinB: boneIndexMap[boneNames[boneNames.length - 1]],
    boneWeightFunc: t => [1, 0],
    uvBase: 1.05
  });
  positions.push(...tipCap.capVerts);
  normals.push(...tipCap.capNormals);
  uvs.push(...tipCap.capUVs);
  skinIndices.push(...tipCap.capSkinIndices);
  skinWeights.push(...tipCap.capSkinWeights);

  const tipBaseIdx = positions.length / 3 - tipCap.capVerts.length / 3;
  for (let seg = 0; seg < 1; seg++) {
    const ring0 = tipBaseIdx + seg * sides;
    const ring1 = tipBaseIdx + (seg + 1) * sides;
    for (let j = 0; j < sides; j++) {
      const a = ring0 + j;
      const b = ring0 + ((j + 1) % sides);
      const c = ring1 + j;
      const d = ring1 + ((j + 1) % sides);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const tipLastRingStart = tipBaseIdx + sides * 1;
  for (let j = 0; j < sides; j++) {
    const a = tipLastRingStart + j;
    const b = tipLastRingStart + ((j + 1) % sides);
    indices.push(positions.length / 3 - 1, a, b);
  }

  let geometry = buildBufferGeometry({
    positions, normals, skinIndices, skinWeights, uvs, indices
  });
  if (geometry.index) geometry = geometry.toNonIndexed();
  return geometry;
}
"""

files_to_zip["src/animals/bodyParts/HeadGenerator.js"] = """
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
"""

files_to_zip["src/animals/bodyParts/TailGenerator.js"] = """
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
"""

files_to_zip["src/animals/bodyParts/NeckGenerator.js"] = """
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
"""

files_to_zip["src/animals/bodyParts/FurGenerator.js"] = """
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
"""

files_to_zip["src/animals/bodyParts/FurStrand.js"] = """
// src/animals/bodyParts/FurStrand.js
import * as THREE from 'three';

export class FurStrand {
  constructor(rootPos, rootNormal, length) {
    this.root = rootPos.clone();
    this.normal = rootNormal.clone().normalize();
    this.length = length;
    this.tip = this.root.clone().addScaledVector(this.normal, length);
    this.velocity = new THREE.Vector3(0, 0, 0);
  }
  update(newRoot, newNormal, dt, params = {}) {
    const gravity = params.gravity || new THREE.Vector3(0, -2.5, 0);
    const stiffness = params.stiffness ?? 36;
    const damping = params.damping ?? 8;
    let dir = this.tip.clone().sub(newRoot).normalize();
    let target = newRoot.clone().addScaledVector(newNormal, this.length);
    let spring = target.clone().sub(this.tip).multiplyScalar(stiffness);
    let damp = this.velocity.clone().multiplyScalar(-damping);
    let force = spring.add(damp).add(gravity);
    this.velocity.add(force.multiplyScalar(dt));
    this.tip.add(this.velocity.clone().multiplyScalar(dt));
    let curLen = this.tip.distanceTo(newRoot);
    if (curLen > 0) {
      let toTip = this.tip.clone().sub(newRoot).normalize();
      this.tip.copy(newRoot).addScaledVector(toTip, this.length);
    }
    this.root.copy(newRoot);
    this.normal.copy(newNormal);
  }
}
"""


# Create the ZIP
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
    for file_path, content in files_to_zip.items():
        zf.writestr(file_path, content)

# Save to disk
zip_filename = '/mnt/data/Elephantv1.2.zip'
with open(zip_filename, 'wb') as f:
    f.write(zip_buffer.getvalue())

zip_filename