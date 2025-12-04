// src/animals/CatPen.js

import { CatCreature } from './CatCreature.js';
import * as THREE from 'three';

/**
 * CatPen: Precision platform with labeled axes, colored triad, origin marker,
 * numbered grids, a bounding box, and a CatCreature, all inside a studio
 * with soft, kid-friendly lighting so the animal is always clearly visible.
 */
export class CatPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Cat';

    this.radius = options.radius || 2.0;
    this.padHeight = options.padHeight || 0.17;
    this.markerRadius = options.markerRadius || 0.13;
    this.markerHeight = options.markerHeight || 0.13;
    this.markerColor = options.markerColor || 0x227bc4;
    this.lineColor = options.lineColor || 0x166597;
    this.position = options.position || new THREE.Vector3(0, 0, 0);

    const gridSize = this.radius * 2.2;
    const gridDivisions = 22;

    // === Master group for everything in this pen ===
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // ------------------------------------------------
    // 1) STUDIO WALLS + GRIDS
    // ------------------------------------------------
    const wallSize = gridSize;
    const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize);

    // Studio wall material: dark mid-grey, neutral, slightly rough.
    // Still gives contrast, but not so black that the cat disappears.
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x222324,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.FrontSide
    });

    // XZ floor grid (only markings; ground plane lives in the global scene)
    const gridXZFloor = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      0x222222,
      0x888888
    );
    gridXZFloor.position.set(0, 0.01, 0);
    gridXZFloor.receiveShadow = true;
    gridXZFloor.name = 'GridXZ_Floor';
    this.group.add(gridXZFloor);

    // YZ side wall (at negative X)
    const wallYZ = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallYZ.position.set(-wallSize / 2, wallSize / 2, 0);
    wallYZ.rotation.y = Math.PI / 2;
    wallYZ.receiveShadow = true;
    wallYZ.name = 'WallYZ_Geometry';
    this.group.add(wallYZ);

    // YZ markings (slightly in front of the wall to avoid z-fighting)
    const markingsYZ = new THREE.GridHelper(
      wallSize,
      gridDivisions,
      0x222222,
      0x88ccdd
    );
    // Default GridHelper lies in XZ; rotate around Z to move it into YZ.
    markingsYZ.rotation.z = Math.PI / 2;
    markingsYZ.position.set(-wallSize / 2 + 0.001, wallSize / 2, 0);
    markingsYZ.name = 'MarkingsYZ';
    this.group.add(markingsYZ);

    // XY back wall (at negative Z)
    const wallXY = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallXY.material.color.set(0x1b1c1d); // Slightly different to define the corner
    wallXY.position.set(0, wallSize / 2, -wallSize / 2);
    wallXY.receiveShadow = true;
    wallXY.name = 'WallXY_Geometry';
    this.group.add(wallXY);

    // XY markings (slightly in front of the wall to avoid z-fighting)
    const markingsXY = new THREE.GridHelper(
      wallSize,
      gridDivisions,
      0x222222,
      0xccdd88
    );
    // Default GridHelper lies in XZ; rotate around X to move it into XY.
    markingsXY.rotation.x = Math.PI / 2;
    markingsXY.position.set(0, wallSize / 2, -wallSize / 2 + 0.001);
    markingsXY.name = 'MarkingsXY';
    this.group.add(markingsXY);

    // ------------------------------------------------
    // 2) AXES, ORIGIN MARKER, PLATFORM
    // ------------------------------------------------
    const axesLen = this.radius * 1.5;
    const axesHelper = new THREE.AxesHelper(axesLen);
    axesHelper.position.set(0, this.padHeight + 0.02, 0);
    axesHelper.name = 'AxesHelper';
    this.group.add(axesHelper);

    this._addAxisLabel('X', axesLen, 0, 0, 0xff4444, this.group);
    this._addAxisLabel('Y', 0, axesLen, 0, 0x44ff44, this.group);
    this._addAxisLabel('Z', 0, 0, axesLen, 0x4444ff, this.group);

    // Origin marker
    const originGeo = new THREE.SphereGeometry(0.05, 20, 12);
    const originMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0x222200
    });
    const originMarker = new THREE.Mesh(originGeo, originMat);
    originMarker.position.set(0, this.padHeight + 0.05, 0);
    originMarker.name = 'OriginMarker';
    this.group.add(originMarker);

    // Cement pad (platform)
    const padGeo = new THREE.CylinderGeometry(
      this.radius,
      this.radius,
      this.padHeight,
      48
    );
    const padMat = new THREE.MeshStandardMaterial({
      // Neutral matte floor: slightly darker to help the cat stand out
      color: 0x8a8a88,
      roughness: 0.7
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, this.padHeight / 2, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    pad.name = 'Pad';
    this.group.add(pad);

    // ------------------------------------------------
    // 3) TRIAD MARKERS
    // ------------------------------------------------
    const triadColors = [0x227bc4, 0xb31e1e, 0x4bc44f];
    const markerY = this.padHeight + this.markerHeight / 2 + 0.005;

    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const x = Math.cos(angle) * (this.radius * 0.81);
      const z = Math.sin(angle) * (this.radius * 0.81);

      const markerGeo = new THREE.CylinderGeometry(
        this.markerRadius,
        this.markerRadius,
        this.markerHeight,
        16
      );
      const markerMat = new THREE.MeshStandardMaterial({
        color: triadColors[i],
        metalness: 0.48,
        roughness: 0.22
      });

      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, markerY, z);
      marker.castShadow = true;
      marker.name = `TriadMarker${i + 1}`;
      this.group.add(marker);
    }

    // Triad line connecting the posts
    const triadLineMat = new THREE.LineBasicMaterial({
      color: this.lineColor,
      linewidth: 2
    });
    const triadLineGeo = new THREE.BufferGeometry();
    const points = [];

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 3;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * (this.radius * 0.81),
          markerY + this.markerHeight / 2 + 0.01,
          Math.sin(angle) * (this.radius * 0.81)
        )
      );
    }

    triadLineGeo.setFromPoints(points);
    const triadLine = new THREE.Line(triadLineGeo, triadLineMat);
    triadLine.name = 'TriadLine';
    this.group.add(triadLine);

    // ------------------------------------------------
    // 4) STUDIO LIGHTING (GLOBAL + KEY / FILL / RIM)
    // ------------------------------------------------

    // Soft global light so the cat is never pure black, even in
    // “shadow”. This is what gives it the kid-game “everywhere light”.
    const hemiLight = new THREE.HemisphereLight(
      0xffffff, // sky
      0x404040, // ground
      0.85
    );
    hemiLight.name = 'CatHemiLight';
    this.group.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    ambientLight.name = 'CatAmbientLight';
    this.group.add(ambientLight);

    // Optional dedicated target so the directionals point at the cat.
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, this.padHeight + 1.2, 0);
    lightTarget.name = 'CatLightTarget';
    this.group.add(lightTarget);

    // Key light: slightly above/right, soft neutral white.
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(4, 5, 4);
    keyLight.target = lightTarget;
    keyLight.castShadow = true;
    keyLight.name = 'CatKeyLight';
    this.group.add(keyLight);

    // Fill light: opposite side, similar colour but weaker.
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-3, 3, 2);
    fillLight.target = lightTarget;
    fillLight.name = 'CatFillLight';
    this.group.add(fillLight);

    // Rim light: from behind to give a gentle outline, not a harsh halo.
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 4.5, -4);
    rimLight.target = lightTarget;
    rimLight.name = 'CatRimLight';
    this.group.add(rimLight);

    // ------------------------------------------------
    // 5) CAT CREATURE
    // ------------------------------------------------
    const catScale =
      typeof options.scale === 'number' ? options.scale : 0.75;

    this.Cat = new CatCreature({
      scale: catScale,
      debug: !!options.debugCat,
      showSkeleton: options.showSkeleton !== false
    });

    // Center on pad, slightly lifted so toes sit nicely on the surface.
    const catY = this.padHeight + 1.5;
    this.Cat.position.set(0, catY, 0);

    // Turn slightly toward the open side of the studio.
    const defaultYaw = Math.PI * 0.3;
    this.Cat.rotation.y =
      typeof options.rotationY === 'number' ? options.rotationY : defaultYaw;

    this.Cat.name = 'CatCreature';
    this.group.add(this.Cat);

    if (this.Cat.mesh) {
      this.Cat.mesh.castShadow = true;
      this.Cat.mesh.receiveShadow = true;
    }

    // Turntable mode: when enabled the cat will slowly rotate
    // around its vertical axis to better showcase the model.  The
    // consumer of CatPen can pass { turntable: true } in options
    // to activate this feature.  By default turntable is off.
    this.turntable = !!options.turntable;

    // ------------------------------------------------
    // 6) BOUNDING BOX (MEASUREMENT HELPER)
    // ------------------------------------------------
    this.bboxHelper = new THREE.BoxHelper(this.Cat, 0xffff66);
    this.bboxHelper.material.transparent = true;
    this.bboxHelper.material.opacity = 0.35;
    this.bboxHelper.name = 'CatBBoxHelper';

    // Optional external control: set showBoundingBox:false to hide in hero shots.
    this.bboxHelper.visible =
      options.showBoundingBox !== undefined ? !!options.showBoundingBox : false;

    this.group.add(this.bboxHelper);

    // Finally, attach the whole pen to the scene.
    scene.add(this.group);
  }

  /**
   * Add a labeled axis sprite at a 3D world location (relative to group).
   */
  _addAxisLabel(text, x, y, z, color, group) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;

    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 28, 38);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillText(text, 28, 38);

    const texture = new THREE.CanvasTexture(canvas);

    // WebGPU color management: axis label text is color data, mark as sRGB
    if (texture && texture.colorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.4, 0.2, 1);
    sprite.position.set(x, y + 0.06, z);
    sprite.name = `AxisLabel_${text}`;
    group.add(sprite);
  }

  /**
   * Returns the root Object3D for OBJ export.
   */
  getExportRoot() {
    return this.group || null;
  }

  /**
   * Animation frame update: update CatCreature and bounding box.
   */
  update(dt) {
    if (this.Cat && typeof this.Cat.update === 'function') {
      this.Cat.update(dt);
    }

    // Keep bounding box aligned with the current cat pose.
    if (this.bboxHelper && this.Cat) {
      this.bboxHelper.setFromObject(this.Cat);
    }

    // Turntable: rotate the cat slowly when enabled.  We rotate
    // about the Y axis so that the animal remains upright.  A very
    // small angular velocity is used to avoid distracting the viewer.
    if (this.turntable && this.Cat) {
      this.Cat.rotation.y += dt * 0.3;
    }
  }
}
