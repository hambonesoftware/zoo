// src/animals/ElephantPen.js

import { ElephantCreature } from './ElephantCreature.js';
import * as THREE from 'three';

/**
 * ElephantPen: naturalistic safari enclosure with a pond, rocks, and a roaming
 * elephant. Debug helpers (axes/grid) can be toggled via options.debugPen.
 */
export class ElephantPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Elephant';

    this.radius = options.radius || 10.0;
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    this.pondRadius = options.pondRadius || 2.2;
    this.groundHeight = 0;
    this.obstacles = [];

    // === Master group for everything in this pen ===
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // ------------------------------------------------
    // 1) NATURALISTIC GROUND + POND
    // ------------------------------------------------
    const groundGeo = new THREE.CircleGeometry(this.radius, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x7a6d4d,
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ElephantGround';
    this.group.add(ground);

    // Subtle grass ring to soften the edge of the dirt patch
    const grassGeo = new THREE.RingGeometry(this.radius * 0.8, this.radius, 64, 1);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x8ba36b,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.001;
    grass.receiveShadow = true;
    grass.name = 'ElephantGrass';
    this.group.add(grass);

    // Pond placement
    this.pondPosition = new THREE.Vector3(this.radius * 0.35, 0, this.radius * -0.2);
    const pondGeo = new THREE.CylinderGeometry(this.pondRadius, this.pondRadius, 0.2, 48, 1, true);
    const pondMat = new THREE.MeshPhysicalMaterial({
      color: 0x5aa0d6,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.2,
      reflectivity: 0.6,
      clearcoat: 0.35
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.position.copy(this.pondPosition);
    pond.position.y = -0.05;
    pond.receiveShadow = false;
    pond.name = 'ElephantPond';
    this.group.add(pond);

    // Keep a light avoidance radius around the pond so the elephant walks
    // around the water unless deliberately entering the drink state.
    this.obstacles.push({
      position: this.pondPosition.clone(),
      radius: this.pondRadius + 0.55,
      type: 'water'
    });

    const pondRimGeo = new THREE.RingGeometry(this.pondRadius * 0.95, this.pondRadius + 0.3, 48);
    const pondRimMat = new THREE.MeshStandardMaterial({ color: 0x6d5b3b, roughness: 0.9, side: THREE.DoubleSide });
    const pondRim = new THREE.Mesh(pondRimGeo, pondRimMat);
    pondRim.rotation.x = -Math.PI / 2;
    pondRim.position.copy(this.pondPosition);
    pondRim.position.y = 0.001;
    pondRim.receiveShadow = true;
    pondRim.name = 'ElephantPondRim';
    this.group.add(pondRim);

    // ------------------------------------------------
    // 2) ROCKS / LOGS / PERIMETER POSTS
    // ------------------------------------------------
    this._addRocksAndLogs();
    this._addPerimeterPosts();

    // ------------------------------------------------
    // 3) LIGHTING
    // ------------------------------------------------
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x708070, 0.85);
    hemiLight.name = 'ElephantHemiLight';
    this.group.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
    ambientLight.name = 'ElephantAmbientLight';
    this.group.add(ambientLight);

    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, 2.5, 0);
    lightTarget.name = 'ElephantLightTarget';
    this.group.add(lightTarget);

    const sunLight = new THREE.DirectionalLight(0xfff1d0, 1.1);
    sunLight.position.set(-6, 10, 4);
    sunLight.target = lightTarget;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -this.radius;
    sunLight.shadow.camera.right = this.radius;
    sunLight.shadow.camera.top = this.radius;
    sunLight.shadow.camera.bottom = -this.radius;
    sunLight.name = 'ElephantSunLight';
    this.group.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.35);
    fillLight.position.set(5, 4, -5);
    fillLight.target = lightTarget;
    fillLight.name = 'ElephantFillLight';
    this.group.add(fillLight);

    // ------------------------------------------------
    // 4) ELEPHANT CREATURE
    // ------------------------------------------------
    const elephantScale = typeof options.scale === 'number' ? options.scale : 0.75;
    const lowPolyOption =
      options.lowPolyElephant !== undefined
        ? !!options.lowPolyElephant
        : (options.lowPoly !== undefined ? !!options.lowPoly : undefined);

    const creatureOptions = {
      scale: elephantScale,
      debug: !!options.debugElephant,
      showSkeleton: options.showSkeleton,
      bodyColor: options.bodyColor,
      variantSeed: options.variantSeed
    };

    if (lowPolyOption !== undefined) {
      creatureOptions.lowPoly = lowPolyOption;
    }

    this.Elephant = new ElephantCreature(creatureOptions);

    // Position the elephant on the ground, away from the pond initially.
    const elephantY = this.groundHeight + 1.5;
    this.Elephant.position.set(-this.radius * 0.15, elephantY, this.radius * 0.05);
    this.Elephant.rotation.y = typeof options.rotationY === 'number' ? options.rotationY : Math.PI * 0.1;
    this.Elephant.name = 'ElephantCreature';
    this.group.add(this.Elephant);

    if (this.Elephant.mesh) {
      this.Elephant.mesh.castShadow = true;
      this.Elephant.mesh.receiveShadow = true;
    }

    // Inform locomotion about the enclosure + pond
    const environment = {
      enclosureCenter: new THREE.Vector3(0, 0, 0),
      enclosureRadius: this.radius,
      pondCenter: this.pondPosition.clone(),
      pondRadius: this.pondRadius,
      obstacles: this.obstacles
    };
    if (this.Elephant.behavior && typeof this.Elephant.behavior.configureEnvironment === 'function') {
      this.Elephant.behavior.configureEnvironment(environment);
    }

    // Turntable mode (kept for parity with studio)
    this.turntable = !!options.turntable;

    // Bounding box helper
    this.bboxHelper = new THREE.BoxHelper(this.Elephant, 0xffff66);
    this.bboxHelper.material.transparent = true;
    this.bboxHelper.material.opacity = 0.35;
    this.bboxHelper.name = 'ElephantBBoxHelper';
    this.bboxHelper.visible =
      options.showBoundingBox !== undefined ? !!options.showBoundingBox : true;
    this.group.add(this.bboxHelper);

    // Optional debug helpers
    if (options.debugPen) {
      const gridSize = this.radius * 2.2;
      const grid = new THREE.GridHelper(gridSize, 32, 0x444444, 0x888888);
      grid.position.y = 0.02;
      this.group.add(grid);

      const axes = new THREE.AxesHelper(this.radius * 0.8);
      axes.position.y = 0.05;
      this.group.add(axes);
    }

    // Finally, attach the whole pen to the scene.
    scene.add(this.group);
  }

  _addRocksAndLogs() {
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x6c6961, roughness: 0.9 });
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.8 });

    const rocks = [
      { pos: new THREE.Vector3(-this.radius * 0.35, 0, -this.radius * 0.3), scale: [0.9, 0.5, 0.7] },
      { pos: new THREE.Vector3(this.radius * -0.1, 0, this.radius * 0.3), scale: [0.6, 0.35, 0.5] },
      { pos: new THREE.Vector3(this.radius * 0.45, 0, this.radius * 0.35), scale: [0.7, 0.4, 0.6] }
    ];

    rocks.forEach((rock, i) => {
      const geo = new THREE.DodecahedronGeometry(rock.scale[0]);
      const mesh = new THREE.Mesh(geo, rockMaterial.clone());
      mesh.position.copy(rock.pos);
      mesh.scale.set(rock.scale[0], rock.scale[1], rock.scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `ElephantRock${i}`;
      this.group.add(mesh);

      const avoidanceRadius = Math.max(rock.scale[0], rock.scale[2]) * 0.75 + 0.25;
      this.obstacles.push({ position: rock.pos.clone(), radius: avoidanceRadius, type: 'rock' });
    });

    const logGeo = new THREE.CylinderGeometry(0.25, 0.3, 3.5, 12);
    const log = new THREE.Mesh(logGeo, logMaterial);
    log.rotation.z = Math.PI / 2.2;
    log.position.set(-this.radius * 0.45, 0.25, this.radius * -0.1);
    log.castShadow = true;
    log.receiveShadow = true;
    log.name = 'ElephantLog';
    this.group.add(log);

    this.obstacles.push({
      position: log.position.clone(),
      radius: 1.9,
      type: 'log'
    });
  }

  _addPerimeterPosts() {
    const postCount = 18;
    const postHeight = 0.4;
    const postGeo = new THREE.CylinderGeometry(0.07, 0.09, postHeight, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5b4a35, roughness: 0.85 });

    for (let i = 0; i < postCount; i += 1) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * (this.radius + 0.2);
      const z = Math.sin(angle) * (this.radius + 0.2);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, postHeight / 2, z);
      post.castShadow = true;
      post.receiveShadow = true;
      post.name = `ElephantFencePost${i}`;
      this.group.add(post);
    }

    const ropeGeo = new THREE.TorusGeometry(this.radius + 0.2, 0.015, 6, 80);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x9b855c, roughness: 0.6 });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.y = postHeight * 0.75;
    rope.name = 'ElephantFenceRope';
    this.group.add(rope);
  }

  fitCameraToElephant(camera, controls) {
    if (!this.Elephant) return;

    const box = new THREE.Box3().setFromObject(this.Elephant);
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

  getExportRoot() {
    return this.group || null;
  }

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
