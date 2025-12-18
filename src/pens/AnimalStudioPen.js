// src/pens/AnimalStudioPen.js

import * as THREE from '../libs/three.module.js';
import { applyHeroMaterialProfile } from '../render/HeroMaterialProfiles.js';
import { createLightingRig } from '../render/LightingRig.js';
import { RENDER_MODES, isCinematic } from '../render/renderMode.js';

/**
 * AnimalStudioPen builds a shared "studio" shell (corner walls, grids, axes,
 * measurement helpers, and soft lighting) and can host any animal instance.
 */
export class AnimalStudioPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;

    this.renderMode = options.renderMode || RENDER_MODES.FAST;
    this.renderer = options.renderer || null;
    this.enableHeroMaterials = options.enableHeroMaterials ?? true;
    this.facetedHint = options.facetedHint ?? false;

    this.label = options.label || 'Animal Studio';

    this.shadowMapSize = options.shadowMapSize;
    this.shadowBias = options.shadowBias;
    this.shadowNormalBias = options.shadowNormalBias;

    this.radius = options.radius || 2.0;
    this.padHeight = options.padHeight || 0.17;
    this.markerRadius = options.markerRadius || 0.13;
    this.markerHeight = options.markerHeight || 0.13;
    this.markerColor = options.markerColor || 0x227bc4;
    this.lineColor = options.lineColor || 0x166597;
    this.position = options.position || new THREE.Vector3(0, 0, 0);

    this.turntable = !!options.turntable;
    this.showBoundingBox = options.showBoundingBox ?? false;

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

    const wallYZ = new THREE.Mesh(wallGeometry, wallMaterial.clone());
    wallYZ.position.set(-wallSize / 2, wallSize / 2, 0);
    wallYZ.rotation.y = Math.PI / 2;
    wallYZ.receiveShadow = true;
    wallYZ.name = 'WallYZ_Geometry';
    this.group.add(wallYZ);

    const markingsYZ = new THREE.GridHelper(
      wallSize,
      gridDivisions,
      0x222222,
      0x88ccdd
    );
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

    const markingsXY = new THREE.GridHelper(
      wallSize,
      gridDivisions,
      0x222222,
      0xccdd88
    );
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

    const padGeo = new THREE.CylinderGeometry(
      this.radius,
      this.radius,
      this.padHeight,
      48
    );
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

    // ------------------------------------------------
    // 3) TRIAD MARKERS
    // ------------------------------------------------
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
    // 4) STUDIO LIGHTING (GLOBAL + KEY / FILL / RIM)
    // ------------------------------------------------
    this.lightTarget = new THREE.Object3D();
    this.lightTarget.position.set(0, this.padHeight + 1.2, 0);
    this.lightTarget.name = 'StudioLightTarget';
    this.group.add(this.lightTarget);

    this.lightingRig = createLightingRig({
      mode: this.renderMode,
      target: this.lightTarget,
      shadowSettings: {
        mapSize: this.shadowMapSize,
        bias: this.shadowBias,
        normalBias: this.shadowNormalBias
      },
      renderer: this.renderer
    });

    if (this.lightingRig?.group) {
      this.group.add(this.lightingRig.group);
    }

    this.environmentHandle = this.lightingRig?.environment || null;
    if (isCinematic(this.renderMode) && this.environmentHandle?.map) {
      this.scene.environment = this.environmentHandle.map;
    }

    // ------------------------------------------------
    // 5) BOUNDING BOX (MEASUREMENT HELPER)
    // ------------------------------------------------
    this.bboxHelper = null;

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

  mountAnimal(animalInstance) {
    this.unmountAnimal();
    if (!animalInstance) return;

    this.animal = animalInstance;
    this.animalRoot = animalInstance.root || animalInstance;
    this.group.add(this.animalRoot);

    if (this.lightTarget) {
      this.lightTarget.position.set(
        this.animalRoot.position.x,
        this.padHeight + 1.2,
        this.animalRoot.position.z
      );
    }

    this._refreshBoundingBoxHelper();
    this._applyHeroMaterials();
  }

  unmountAnimal() {
    if (this.bboxHelper) {
      this.group.remove(this.bboxHelper);
      this.bboxHelper.geometry.dispose();
      this.bboxHelper.material.dispose();
      this.bboxHelper = null;
    }

    if (this.animalRoot) {
      this.group.remove(this.animalRoot);
    }

    if (this.animal && typeof this.animal.dispose === 'function') {
      this.animal.dispose();
    }

    this.animal = null;
    this.animalRoot = null;
  }

  _refreshBoundingBoxHelper() {
    if (!this.animalRoot) return;

    this.bboxHelper = new THREE.BoxHelper(this.animalRoot, 0xffff66);
    this.bboxHelper.material.transparent = true;
    this.bboxHelper.material.opacity = 0.35;
    this.bboxHelper.name = 'StudioBBoxHelper';
    this.bboxHelper.visible = this.showBoundingBox;
    this.group.add(this.bboxHelper);
  }

  _applyHeroMaterials() {
    if (!this.animalRoot || !this.enableHeroMaterials) return;

    const inferredFaceted = this.facetedHint || this._looksFaceted();
    applyHeroMaterialProfile(this.animalRoot, {
      mode: this.renderMode,
      envMap: this.environmentHandle?.map || this.scene?.environment || null,
      faceted: inferredFaceted
    });
  }

  _looksFaceted() {
    let faceted = false;
    if (!this.animalRoot) return this.facetedHint;
    this.animalRoot.traverse((child) => {
      if (child.isMesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (mat && mat.flatShading === true) {
            faceted = true;
            return;
          }
        }
      }
    });
    return faceted || this.facetedHint;
  }

  getExportRoot() {
    return this.group || null;
  }

  fitCameraToSubject(camera, controls) {
    if (!this.animalRoot) return;

    const box = new THREE.Box3().setFromObject(this.animalRoot);
    if (!box.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const fitHeightDistance = maxDim / (2 * Math.tan(fov / 2));
      const fitWidthDistance = fitHeightDistance / camera.aspect;
      const distance = Math.max(fitHeightDistance, fitWidthDistance);

      const dir = new THREE.Vector3(0, 0, 1);
      dir.applyQuaternion(camera.quaternion);
      const newPos = center.clone().add(dir.multiplyScalar(distance * 1.3));

      camera.position.copy(newPos);
      camera.near = distance * 0.05;
      camera.far = distance * 20.0;
      camera.updateProjectionMatrix();

      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    }
  }

  update(dt) {
    if (this.animal && typeof this.animal.update === 'function') {
      this.animal.update(dt);
    }

    if (this.bboxHelper && this.animalRoot) {
      this.bboxHelper.setFromObject(this.animalRoot);
    }

    if (this.turntable && this.animalRoot) {
      this.animalRoot.rotation.y += dt * 0.3;
    }
  }
}
