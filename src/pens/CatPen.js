import { CatCreature } from '../animals/Cat/CatCreature.js';
import * as THREE from 'three';

/**
 * CatPen: Precision platform with labeled axes, colored triad, origin marker, numbered grids, bounding box,
 * and a CatCreature, built within a dark, shadow-receiving corner studio.
 */
export class CatPen {
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

		// === Group for all objects ===
		this.group = new THREE.Group();
		this.group.position.copy(this.position);

		// NEW: Define materials for the studio environment

		// 1. Solid material for shadow-receiving walls
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: 0x1a1a1a, // Dark studio color for good shadow contrast
			roughness: 0.8,
			metalness: 0.1,
			side: THREE.FrontSide,
		});

		// 2. Geometry for the walls
		const wallSize = gridSize;
		const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize); // Default is XY plane

		// === XZ Grid (Floor, Markings) ===
		// This remains a GridHelper for the visual markings
		const gridXZFloor = new THREE.GridHelper(gridSize, gridDivisions, 0x222222, 0x888888);
		gridXZFloor.position.set(0, 0.01, 0);
		gridXZFloor.receiveShadow = true; // Floor can receive shadows from the walls/cat
		gridXZFloor.name = 'GridXZ_Floor';
		this.group.add(gridXZFloor);


		// === YZ Wall (Side Wall, constant X plane) ===
		// This forms the YZ plane wall geometry
		const wallYZ = new THREE.Mesh(wallGeometry, wallMaterial.clone());
		// Correct position: X at the edge, Y centered (bottom at Y=0), Z centered.
		wallYZ.position.set(-wallSize / 2, wallSize / 2, 0); 
		wallYZ.rotation.y = Math.PI / 2; // Rotate XY plane (default) to YZ plane (normal +X)
		wallYZ.receiveShadow = true;
		wallYZ.name = 'WallYZ_Geometry';
		this.group.add(wallYZ);
		
		// YZ Grid Markings (Cyan Lines)
		const markingsYZ = new THREE.GridHelper(wallSize, gridDivisions, 0x222222, 0x88ccdd);
		markingsYZ.rotation.z = Math.PI / 2; // XZ GridHelper → YZ plane
		// Position is slightly offset from the solid wall to prevent Z-fighting.
		// Note the correct Y center position: wallSize / 2
		markingsYZ.position.set(-wallSize / 2 + 0.001, wallSize / 2, 0); 
		markingsYZ.name = 'MarkingsYZ';
		this.group.add(markingsYZ);


		// === XY Wall (Back Wall, constant Z plane) ===
		// This forms the XY plane wall geometry
		const wallXY = new THREE.Mesh(wallGeometry, wallMaterial.clone());
		wallXY.material.color.set(0x0a0a0a); // Slight color difference for corner definition
		// Correct position: Z at the edge, Y centered (bottom at Y=0), X centered.
		wallXY.position.set(0, wallSize / 2, -wallSize / 2); 
		// Rotation: PlaneGeometry is already in XY plane, no rotation needed for back wall (faces +Z)
		wallXY.receiveShadow = true;
		wallXY.name = 'WallXY_Geometry';
		this.group.add(wallXY);

		// XY Grid Markings (Yellow/Green Lines)
		// Renamed from GridXZ in the original code, now correctly placed
		const markingsXY = new THREE.GridHelper(wallSize, gridDivisions, 0x222222, 0xccdd88);
		markingsXY.rotation.x = Math.PI / 2; // XZ GridHelper → XY plane
		// Position is slightly offset from the solid wall to prevent Z-fighting.
		// Note the correct Y center position: wallSize / 2
		markingsXY.position.set(0, wallSize / 2, -wallSize / 2 + 0.001); 
		markingsXY.name = 'MarkingsXY';
		this.group.add(markingsXY);

		// === Axes with labels ===
		const axesLen = this.radius * 1.5;
		const axesHelper = new THREE.AxesHelper(axesLen);
		axesHelper.position.set(0, this.padHeight + 0.02, 0);
		axesHelper.name = 'AxesHelper';
		this.group.add(axesHelper);

		this._addAxisLabel('X', axesLen, 0, 0, 0xff4444, this.group);
		this._addAxisLabel('Y', 0, axesLen, 0, 0x44ff44, this.group);
		this._addAxisLabel('Z', 0, 0, axesLen, 0x4444ff, this.group);

		// === Origin marker ===
		const originGeo = new THREE.SphereGeometry(0.05, 20, 12);
		const originMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x222200 });
		const originMarker = new THREE.Mesh(originGeo, originMat);
		originMarker.position.set(0, this.padHeight + 0.05, 0);
		originMarker.name = 'OriginMarker';
		this.group.add(originMarker);

		// === Cement pad (platform) ===
		const padGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.padHeight, 48);
		const padMat = new THREE.MeshStandardMaterial({ color: 0xa9adae, roughness: 0.61 });
		const pad = new THREE.Mesh(padGeo, padMat);
		pad.position.set(0, this.padHeight / 2, 0);
		pad.receiveShadow = true;
		pad.castShadow = true; // Pad can also cast shadow
		pad.name = 'Pad';
		this.group.add(pad);

		// === Triad Markers (blue posts, with unique colors for each post) ===
		const triadColors = [0x227bc4, 0xb31e1e, 0x4bc44f];
		const markerY = this.padHeight + this.markerHeight / 2 + 0.005;
		for (let i = 0; i < 3; i++) {
			const angle = i * (Math.PI * 2 / 3);
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

		// === Triad Lines (connects posts) ===
		const triadLineMat = new THREE.LineBasicMaterial({ color: this.lineColor, linewidth: 2 });
		const triadLineGeo = new THREE.BufferGeometry();
		const points = [];
		for (let i = 0; i < 4; i++) {
			const angle = i * (Math.PI * 2 / 3);
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

		// === Add CatCreature (used CatCreature instead of ElephantCreature) ===
		this.cat = new CatCreature(); 
		this.cat.position.set(0, this.padHeight * 4, 0);
		this.cat.name = 'CatCreature';
		this.group.add(this.cat);
		
		// If you use CatCreature, make sure it casts shadow
		this.cat.mesh.castShadow = true; 

		// Removed skeleton helper from here as it's usually managed inside CatCreature if needed
		// const skeletonHelper = new THREE.SkeletonHelper(this.cat.bones[0]);
		// scene.add(skeletonHelper);

		// === Bounding box helper ===
		this.bboxHelper = new THREE.BoxHelper(this.cat, 0xffff00);
		this.bboxHelper.material.linewidth = 3;
		this.bboxHelper.name = 'BBoxHelper';
		this.group.add(this.bboxHelper);

		// === Add the master group to the scene ===
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

		const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(0.4, 0.2, 1);
		sprite.position.set(x, y + 0.06, z);
		sprite.name = `AxisLabel_${text}`;
		group.add(sprite);
	}

	/**
	 * Animation frame update: update CatCreature and bounding box.
	 */
	update(dt) {
		if (this.cat) this.cat.update(dt);
		if (this.bboxHelper && typeof this.bboxHelper.update === 'function') {
			this.bboxHelper.update();
		}
	}
}