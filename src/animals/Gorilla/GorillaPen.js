// src/animals/Gorilla/GorillaPen.js

import * as THREE from 'three';
import { GorillaCreature } from './GorillaCreature.js';

/**
 * GorillaPen
 *
 * Studio backdrop, lighting, and helpers that mirror the Cat pen so the
 * gorilla previews in the exact same environment. Adds labeled walls,
 * a triad platform, turntable option, and a bounding box helper.
 */
export class GorillaPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Gorilla';

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

    // ------------------------------------------------
    // 1) STUDIO WALLS + GRIDS
    // ------------------------------------------------
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
    gridXZFloor.name = 'GridXZ_Floor';
    this.group.add(gridXZFloor);

    const wallYZ = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallYZ.position.set(-wallSize / 2, wallSize / 2, 0);
    wallYZ.rotation.y = Math.PI / 2;
    wallYZ.receiveShadow = true;
    wallYZ.name = 'WallYZ_Geometry';
    this.group.add(wallYZ);

    const markingsYZ = new THREE.GridHelper(wallSize, gridDivisions, 0x222222, 0x88ccdd);
    markingsYZ.rotation.z = Math.PI / 2;
    markingsYZ.position.set(-wallSize / 2 + 0.001, wallSize / 2, 0);
    markingsYZ.name = 'MarkingsYZ';
    this.group.add(markingsYZ);

    const wallXY = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallXY.material.color.set(0x1b1c1d);
    wallXY.position.set(0, wallSize / 2, -wallSize / 2);
    wallXY.receiveShadow = true;
    wallXY.name = 'WallXY_Geometry';
    this.group.add(wallXY);

    const markingsXY = new THREE.GridHelper(wallSize, gridDivisions, 0x222222, 0xccdd88);
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

    const originGeo = new THREE.SphereGeometry(0.05, 20, 12);
    const originMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0x222200
    });
    const originMarker = new THREE.Mesh(originGeo, originMat);
    originMarker.position.set(0, this.padHeight + 0.05, 0);
    originMarker.name = 'OriginMarker';
    this.group.add(originMarker);

    const padGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.padHeight, 48);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a88,
      roughness: 0.7
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, this.padHeight / 2, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    pad.name = 'Pad';
    this.group.add(pad);

    const triadColors = [this.markerColor, 0xb31e1e, 0x4bc44f];
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
    // 3) STUDIO LIGHTING
    // ------------------------------------------------
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.85);
    hemiLight.name = 'GorillaHemiLight';
    this.group.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    ambientLight.name = 'GorillaAmbientLight';
    this.group.add(ambientLight);

    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, this.padHeight + 1.2, 0);
    lightTarget.name = 'GorillaLightTarget';
    this.group.add(lightTarget);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(4, 5, 4);
    keyLight.target = lightTarget;
    keyLight.castShadow = true;
    keyLight.name = 'GorillaKeyLight';
    this.group.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-3, 3, 2);
    fillLight.target = lightTarget;
    fillLight.name = 'GorillaFillLight';
    this.group.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 4.5, -4);
    rimLight.target = lightTarget;
    rimLight.name = 'GorillaRimLight';
    this.group.add(rimLight);

    // ------------------------------------------------
    // 4) GORILLA CREATURE
    // ------------------------------------------------
    const gorillaScale = typeof options.scale === 'number' ? options.scale : 1.0;

    this.gorilla = new GorillaCreature({
      scale: gorillaScale,
      debug: !!options.debug,
      showSkeleton: options.showSkeleton
    });

    this.gorilla.position.set(0, this.padHeight, 0);
    this.gorilla.rotation.y = typeof options.rotationY === 'number' ? options.rotationY : Math.PI * 0.3;
    this.gorilla.name = 'GorillaCreature';
    this.group.add(this.gorilla);

    if (this.gorilla.mesh) {
      this.gorilla.mesh.castShadow = true;
      this.gorilla.mesh.receiveShadow = true;
    }

    this.turntable = !!options.turntable;

    // ------------------------------------------------
    // 5) BOUNDING BOX (MEASUREMENT HELPER)
    // ------------------------------------------------
    this.bboxHelper = new THREE.BoxHelper(this.gorilla, 0xffff66);
    this.bboxHelper.material.transparent = true;
    this.bboxHelper.material.opacity = 0.35;
    this.bboxHelper.name = 'GorillaBBoxHelper';
    this.bboxHelper.visible =
      options.showBoundingBox !== undefined ? !!options.showBoundingBox : false;

    this.group.add(this.bboxHelper);

    scene.add(this.group);
  }

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

  update(dt) {
    if (this.gorilla && typeof this.gorilla.update === 'function') {
      this.gorilla.update(dt);
    }

    if (this.bboxHelper && this.gorilla) {
      this.bboxHelper.setFromObject(this.gorilla);
    }

    if (this.turntable && this.gorilla) {
      this.gorilla.rotation.y += dt * 0.3;
    }
  }
}
