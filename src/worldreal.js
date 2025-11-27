// src/world.js
// Use your local libs
import * as THREE from '../libs/three.module.js';
import { WebGPURenderer } from '../libs/three.webgpu.js';
import { OrbitControls } from '../libs/OrbitControls.js';

/**
 * Creates a highly detailed zoo/park world with multiple animal pens,
 * trees, benches, lamps, pond, path, and full mouse controls.
 * @param {HTMLElement} canvasContainer
 * @returns {object} { scene, camera, controls, renderer }
 */
export function createWorld(canvasContainer) {
  // --- 1. Scene and background
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9e7ff);

  // --- 2. Ground (large, with "dirt" path)
  const groundGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8ccb7e });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Main dirt path
  const pathGeo = new THREE.RingGeometry(14, 16, 64);
	const pathMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.72, side: THREE.DoubleSide });
	const path = new THREE.Mesh(pathGeo, pathMat);
	path.rotation.x = -Math.PI / 2;
	path.position.y = 0.012;
	scene.add(path);


  // --- 3. Trees, Bushes, Rocks (variety)
  function makeTree(x, z, kind = 0) {
    const group = new THREE.Group();
    let trunk, leaves;
    if (kind === 0) {
      trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.3, 8), new THREE.MeshStandardMaterial({ color: 0x8b5e3c }));
      leaves = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 9), new THREE.MeshStandardMaterial({ color: 0x357a38 }));
      trunk.position.y = 1.16;
      leaves.position.y = 2.5;
    } else if (kind === 1) {
      trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xa87f45 }));
      leaves = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshStandardMaterial({ color: 0x79c16d }));
      trunk.position.y = 0.78;
      leaves.position.y = 1.48;
    } else {
      trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2, 6), new THREE.MeshStandardMaterial({ color: 0x7b6140 }));
      leaves = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.9, 8), new THREE.MeshStandardMaterial({ color: 0x305828 }));
      trunk.position.y = 1;
      leaves.position.y = 2.15;
    }
    trunk.castShadow = true; leaves.castShadow = true;
    group.add(trunk); group.add(leaves); group.position.set(x, 0, z);
    scene.add(group);
  }
  function makeBush(x, z) {
    const geo = new THREE.SphereGeometry(0.5 + Math.random() * 0.6, 9, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0x56c270 });
    const bush = new THREE.Mesh(geo, mat);
    bush.position.set(x, 0.36, z);
    bush.castShadow = true;
    scene.add(bush);
  }
  function makeRock(x, z) {
    const geo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.6, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x969491, roughness: 1 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.18, z);
    rock.castShadow = true;
    scene.add(rock);
  }

  for (let i = 0; i < 24; i++) makeTree(-120 + Math.random() * 240, -120 + Math.random() * 240, Math.floor(Math.random() * 3));
  for (let i = 0; i < 30; i++) makeBush(-130 + Math.random() * 260, -130 + Math.random() * 260);
  for (let i = 0; i < 16; i++) makeRock(-110 + Math.random() * 220, -110 + Math.random() * 220);

  // --- 4. Animal pens (fenced rectangles, with gates)
  function makePen(x, z, w = 26, d = 20, gateSide = 'front') {
    const postGeo = new THREE.CylinderGeometry(0.17, 0.17, 1.85, 7);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x7a6b55 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0xe8e5d4 });
    // Posts
    const postPos = [
      [x - w/2, z - d/2], [x + w/2, z - d/2],
      [x + w/2, z + d/2], [x - w/2, z + d/2]
    ];
    for (let i = 0; i < postPos.length; i++) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(postPos[i][0], 0.93, postPos[i][1]);
      post.castShadow = true; scene.add(post);
    }
    // Bars
    function bar(x1, z1, x2, z2) {
      const len = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
      const geo = new THREE.BoxGeometry(len, 0.12, 0.13);
      const bar = new THREE.Mesh(geo, barMat);
      bar.position.set((x1+x2)/2, 1.25, (z1+z2)/2);
      bar.rotation.y = Math.atan2(z2-z1, x2-x1);
      bar.castShadow = true;
      scene.add(bar);
    }
    // Sides (leave gap for gate)
    const gap = 4;
    if (gateSide === 'front') {
      bar(x-w/2, z-d/2, x-gap/2, z-d/2);
      bar(x+gap/2, z-d/2, x+w/2, z-d/2);
    } else bar(x-w/2, z-d/2, x+w/2, z-d/2);
    bar(x+w/2, z-d/2, x+w/2, z+d/2);
    bar(x+w/2, z+d/2, x-w/2, z+d/2);
    bar(x-w/2, z+d/2, x-w/2, z-d/2);
    // Gate
    if (gateSide === 'front') {
      const gateGeo = new THREE.BoxGeometry(gap, 0.22, 0.13);
      const gateMat = new THREE.MeshStandardMaterial({ color: 0xbdb6a6 });
      const gate = new THREE.Mesh(gateGeo, gateMat);
      gate.position.set(x, 1.15, z-d/2-0.01);
      gate.castShadow = true;
      scene.add(gate);
    }
  }
  // Place several pens around the central path
  makePen(0, -32, 30, 22, 'front');
  makePen(-50, 35, 26, 16, 'left');
  makePen(48, 29, 32, 19, 'right');
  makePen(-30, 60, 28, 14, 'front');
  makePen(30, 68, 24, 12, 'back');

  // --- 5. Pond (decorative, in park center)
  const pondGeo = new THREE.CircleGeometry(7, 38);
  const pondMat = new THREE.MeshPhysicalMaterial({
    color: 0x82d9f7, roughness: 0.37, transmission: 0.86, opacity: 0.7, transparent: true, ior: 1.2
  });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.position.set(0, 0.022, 34);
  pond.rotation.x = -Math.PI / 2;
  pond.receiveShadow = true;
  scene.add(pond);

  // --- 6. Benches & Lamps along path
  function makeBench(x, z, rot = 0) {
    const seatGeo = new THREE.BoxGeometry(1.6, 0.15, 0.4);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd0ad68 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(x, 0.19, z); seat.rotation.y = rot;
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.32, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x7a6b55 });
    for (let dx of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x+dx*Math.cos(rot), 0.04, z+dx*Math.sin(rot));
      scene.add(leg);
    }
    scene.add(seat);
  }
  function makeLamp(x, z) {
    const baseGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.35, 8);
    const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.3, 8);
    const lampGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x565146 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x64605c });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, emissive: 0xffd100, emissiveIntensity: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(x, 0.18, z);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 1.37, z);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 2.56, z);
    // Add light source
    const light = new THREE.PointLight(0xffddaa, 0.28, 12, 2);
    light.position.set(x, 2.56, z);
    scene.add(base); scene.add(post); scene.add(lamp); scene.add(light);
  }
  for (let i = -60; i <= 60; i += 30) makeBench(i, 0, Math.PI/2);
  for (let i = -60; i <= 60; i += 24) makeLamp(i, 7);

  // --- 7. Entrance Arch (decorative)
  const archGeo = new THREE.TorusGeometry(7, 0.18, 14, 60, Math.PI);
  const archMat = new THREE.MeshStandardMaterial({ color: 0xd1c48b });
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.set(0, 7.2, -80);
  arch.rotation.x = Math.PI / 2;
  scene.add(arch);

  // --- 8. Lighting (multiple sources)
  // Sun/Directional
  const sun = new THREE.DirectionalLight(0xfff8e2, 1.13);
  sun.position.set(110, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 450;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  scene.add(sun);

  // Rim (cool) light from behind for subtle edge
  const rim = new THREE.DirectionalLight(0x9ad7ff, 0.29);
  rim.position.set(-80, 90, -130);
  scene.add(rim);

  // Fill
  const fill = new THREE.PointLight(0xffeecc, 0.36, 100, 2.4);
  fill.position.set(-30, 16, 30);
  scene.add(fill);

  // Hemisphere
  const hemi = new THREE.HemisphereLight(0xb1e1ff, 0x3c473e, 0.41);
  hemi.position.set(0, 140, 0);
  scene.add(hemi);

  // Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.14);
  scene.add(ambient);

  // --- 9. Camera
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.05,
    1000
  );
  camera.position.set(74, 50, 110);
  camera.lookAt(0, 7, 0);

  // --- 10. Renderer (WebGPU)
  const existingCanvas = document.querySelector('#zoo-canvas');
  const canvas = existingCanvas || (() => {
    const c = document.createElement('canvas');
    c.id = 'zoo-canvas';
    c.style.display = 'block';
    c.style.width = '100%';
    c.style.height = '100%';
    canvasContainer.appendChild(c);
    return c;
  })();

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xb9e7ff, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // --- 11. Orbit Controls (full mouse: pan, zoom, rotate)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.dampingFactor = 0.09;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.5;
  controls.maxDistance = 25;
  controls.target.set(0, 8, 0);
  controls.update();

  // --- 12. Responsive Resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // --- 13. Optional: grid/axes for dev
  // const gridHelper = new THREE.GridHelper(300, 60, 0xaaaaaa, 0xdddddd);
  // scene.add(gridHelper);
  // const axesHelper = new THREE.AxesHelper(20);
  // scene.add(axesHelper);

  // --- 14. Return everything for your main loop
  return { scene, camera, controls, renderer };
}
