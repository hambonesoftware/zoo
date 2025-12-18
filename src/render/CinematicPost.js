import * as THREE from '../../libs/three.module.js';

const DEFAULT_BLOOM_SETTINGS = {
  threshold: 1.0,
  strength: 0.45,
  radius: 0.65
};

function createRenderTarget(width, height, options = {}) {
  const target = new THREE.RenderTarget(width, height, {
    type: options.type ?? THREE.HalfFloatType,
    samples: options.samples ?? 0
  });
  target.texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  return target;
}

function createFullscreenQuad(material) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  return new THREE.Mesh(geometry, material);
}

export class CinematicPost {
  constructor(renderer, scene, camera, settings = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = renderer?.isWebGPURenderer === true;
    this.bloomSettings = { ...DEFAULT_BLOOM_SETTINGS, ...settings.bloom };

    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.floor(size.x * pixelRatio));
    const targetHeight = Math.max(1, Math.floor(size.y * pixelRatio));
    const targetOptions = {
      type: renderer.getColorBufferType ? renderer.getColorBufferType() : THREE.HalfFloatType,
      colorSpace: renderer.outputColorSpace ?? THREE.SRGBColorSpace,
      samples: renderer.isWebGPURenderer ? renderer.samples ?? 0 : 0
    };

    this.writeTarget = createRenderTarget(targetWidth, targetHeight, targetOptions);
    this.bloomTarget = createRenderTarget(targetWidth / 2, targetHeight / 2, targetOptions);
    this.pingTarget = createRenderTarget(targetWidth / 2, targetHeight / 2, targetOptions);

    this.passScene = new THREE.Scene();
    this.screenScene = new THREE.Scene();
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.thresholdMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        uThreshold: { value: this.bloomSettings.threshold }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform float uThreshold;
        void main() {
          vec3 color = texture2D(tScene, vUv).rgb;
          float brightness = max(max(color.r, color.g), color.b);
          vec3 bloom = brightness > uThreshold ? color : vec3(0.0);
          gl_FragColor = vec4(bloom, 1.0);
        }
      `
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uDirection: { value: new THREE.Vector2(1.0, 0.0) },
        uResolution: { value: new THREE.Vector2(size.x / 2, size.y / 2) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tInput;
        uniform vec2 uDirection;
        uniform vec2 uResolution;
        void main() {
          vec2 texel = uDirection / uResolution;
          vec3 result = vec3(0.0);
          result += texture2D(tInput, vUv - 4.0 * texel).rgb * 0.05;
          result += texture2D(tInput, vUv - 3.0 * texel).rgb * 0.09;
          result += texture2D(tInput, vUv - 2.0 * texel).rgb * 0.12;
          result += texture2D(tInput, vUv - 1.0 * texel).rgb * 0.15;
          result += texture2D(tInput, vUv).rgb * 0.18;
          result += texture2D(tInput, vUv + 1.0 * texel).rgb * 0.15;
          result += texture2D(tInput, vUv + 2.0 * texel).rgb * 0.12;
          result += texture2D(tInput, vUv + 3.0 * texel).rgb * 0.09;
          result += texture2D(tInput, vUv + 4.0 * texel).rgb * 0.05;
          gl_FragColor = vec4(result, 1.0);
        }
      `
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloomStrength: { value: this.bloomSettings.strength },
        uBloomRadius: { value: this.bloomSettings.radius }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uBloomStrength;
        uniform float uBloomRadius;
        void main() {
          vec3 baseColor = texture2D(tScene, vUv).rgb;
          vec3 bloomColor = texture2D(tBloom, vUv).rgb;
          vec3 color = baseColor + bloomColor * uBloomStrength;
          color = mix(baseColor, color, clamp(uBloomRadius, 0.0, 1.0));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.quad = createFullscreenQuad(this.compositeMaterial);
    this.screenScene.add(this.quad);
    this.thresholdQuad = createFullscreenQuad(this.thresholdMaterial);
    this.blurQuad = createFullscreenQuad(this.blurMaterial);
  }

  setSize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
    const targetHeight = Math.max(1, Math.floor(height * pixelRatio));
    const halfWidth = Math.max(1, Math.floor(targetWidth / 2));
    const halfHeight = Math.max(1, Math.floor(targetHeight / 2));
    this.writeTarget.setSize(targetWidth, targetHeight);
    this.bloomTarget.setSize(halfWidth, halfHeight);
    this.pingTarget.setSize(halfWidth, halfHeight);
    this.blurMaterial.uniforms.uResolution.value.set(halfWidth, halfHeight);
  }

  render() {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const { renderer } = this;

    const renderQuad = (quad, target) => {
      this.passScene.add(quad);
      renderer.setRenderTarget(target);
      renderer.render(this.passScene, this.screenCamera);
      this.passScene.remove(quad);
    };

    renderer.setRenderTarget(this.writeTarget);
    renderer.render(this.scene, this.camera);

    // Bright pass
    this.thresholdMaterial.uniforms.tScene.value = this.writeTarget.texture;
    renderQuad(this.thresholdQuad, this.bloomTarget);

    // Horizontal blur
    this.blurMaterial.uniforms.tInput.value = this.bloomTarget.texture;
    this.blurMaterial.uniforms.uDirection.value.set(1.0, 0.0);
    renderQuad(this.blurQuad, this.pingTarget);

    // Vertical blur back into bloom target
    this.blurMaterial.uniforms.tInput.value = this.pingTarget.texture;
    this.blurMaterial.uniforms.uDirection.value.set(0.0, 1.0);
    renderQuad(this.blurQuad, this.bloomTarget);

    // Composite to screen
    renderer.setRenderTarget(null);
    this.compositeMaterial.uniforms.tScene.value = this.writeTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.bloomTarget.texture;
    renderer.render(this.screenScene, this.screenCamera);
  }

  dispose() {
    this.writeTarget.dispose();
    this.bloomTarget.dispose();
    this.pingTarget.dispose();
    this.thresholdQuad.geometry.dispose();
    this.thresholdMaterial.dispose();
    this.blurQuad.geometry.dispose();
    this.blurMaterial.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
