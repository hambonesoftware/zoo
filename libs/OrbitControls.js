// libs/OrbitControls.js
import * as THREE from "three";

/**
 * Minimal orbit-style camera controller for Three.js.
 * Supports left-drag rotate + wheel zoom. Good enough for the Zoo studio.
 */
class OrbitControls {
  constructor(object, domElement) {
    this.object = object;
    this.domElement = domElement || document;

    this.enabled = true;
    this.target = new THREE.Vector3(0, 1, 0);

    this.enableRotate = true;
    this.enableZoom = true;
    this.enablePan = true; // not implemented yet, just a flag

    this.minDistance = 0.5;
    this.maxDistance = 100;

    this.enableDamping = true;
    this.dampingFactor = 0.1;

    this.zoomSpeed = 1.0;

    // Internal state
    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical(0, 0, 0);

    this._scale = 1;
    this._state = "NONE";

    this._rotateStart = new THREE.Vector2();
    this._rotateEnd = new THREE.Vector2();
    this._rotateDelta = new THREE.Vector2();

    // Bind handlers and attach listeners
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);

    this.domElement.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
    this.domElement.addEventListener("wheel", this._onWheel, { passive: false });

    // Initialize spherical from current camera position
    this.update();
  }

  _handleMouseDown(event) {
    if (!this.enabled || !this.enableRotate || event.button !== 0) return;
    event.preventDefault();
    this._state = "ROTATE";
    this._rotateStart.set(event.clientX, event.clientY);
  }

  _handleMouseMove(event) {
    if (!this.enabled || this._state !== "ROTATE") return;

    this._rotateEnd.set(event.clientX, event.clientY);
    this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart);
    this._rotateStart.copy(this._rotateEnd);

    const width = this.domElement.clientWidth || window.innerWidth;
    const height = this.domElement.clientHeight || window.innerHeight;

    const rotSpeed = 2 * Math.PI;
    this._sphericalDelta.theta -= (rotSpeed * this._rotateDelta.x) / width;
    this._sphericalDelta.phi -= (rotSpeed * this._rotateDelta.y) / height;
  }

  _handleMouseUp(_event) {
    this._state = "NONE";
  }

  _handleWheel(event) {
    if (!this.enabled || !this.enableZoom) return;

    event.preventDefault();

    const zoomFactor = Math.pow(0.95, this.zoomSpeed);
    if (event.deltaY > 0) {
      // scroll down -> zoom out
      this._scale /= zoomFactor;
    } else if (event.deltaY < 0) {
      // scroll up -> zoom in
      this._scale *= zoomFactor;
    }
  }

  update() {
    const offset = new THREE.Vector3();

    // position relative to target
    offset.copy(this.object.position).sub(this.target);

    // convert to spherical
    this._spherical.setFromVector3(offset);
    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;

    // clamp polar angle so we don't flip
    const EPS = 1e-6;
    this._spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, this._spherical.phi));

    // damping
    if (this.enableDamping) {
      this._sphericalDelta.theta *= 1 - this.dampingFactor;
      this._sphericalDelta.phi *= 1 - this.dampingFactor;
    } else {
      this._sphericalDelta.set(0, 0, 0);
    }

    // zoom
    this._spherical.radius *= this._scale;
    this._spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this._spherical.radius)
    );
    this._scale = 1;

    // back to cartesian
    offset.setFromSpherical(this._spherical);

    // apply to camera
    this.object.position.copy(this.target).add(offset);
    this.object.lookAt(this.target);
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
    this.domElement.removeEventListener("wheel", this._onWheel);
  }
}

export { OrbitControls };
