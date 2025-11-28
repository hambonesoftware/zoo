import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

function createCanvasStub() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    fillRect() {},
    ellipse() {},
    arc() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createPattern() {
      return null;
    },
    measureText() {
      return { width: 0 };
    },
    clearRect() {}
  };

  return {
    width: 0,
    height: 0,
    getContext: (type) => (type === '2d' ? ctx : null)
  };
}

function installDomStubs() {
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return createCanvasStub();
      }
      return { getContext: () => null };
    }
  };

  if (!globalThis.window) {
    globalThis.window = { devicePixelRatio: 1 };
  }
}

function assertSkeletonHelper(creature, label) {
  assert.ok(creature.skeletonHelper, `${label} exposes a skeleton helper`);
  assert.ok(creature.skeletonHelper.visible !== false, `${label} helper is visible`);
  assert.equal(
    creature.skeletonHelper.material.color.getHex(),
    0x00ff66,
    `${label} helper uses neon green`
  );
  assert.equal(
    creature.skeletonHelper.material.blending,
    THREE.AdditiveBlending,
    `${label} helper uses additive blending`
  );
  assert.equal(creature.skeletonHelper.material.depthWrite, false);
  assert.equal(creature.skeletonHelper.material.transparent, true);
  assert.equal(creature.skeletonHelper.material.toneMapped, false);
  assert.strictEqual(
    creature.skeletonHelper.skeleton,
    creature.skeleton,
    `${label} helper references the creature skeleton`
  );
  assert.equal(
    creature.skeletonHelper.bones.length,
    creature.skeleton.bones.length,
    `${label} helper covers all bones`
  );
}

test('Cat skeleton helper is neon green and covers all bones', async () => {
  installDomStubs();
  const { CatCreature } = await import('../src/animals/Cat/CatCreature.js');
  const cat = new CatCreature();
  assertSkeletonHelper(cat, 'Cat');
});

test('Elephant skeleton helper is neon green and covers all bones', async () => {
  installDomStubs();
  const { ElephantCreature } = await import('../src/animals/Elephant/ElephantCreature.js');
  const elephant = new ElephantCreature();
  assertSkeletonHelper(elephant, 'Elephant');
});

test('Gorilla skeleton helper is neon green and covers all bones', async () => {
  installDomStubs();
  const { GorillaCreature } = await import('../src/animals/Gorilla/GorillaCreature.js');
  const gorilla = new GorillaCreature();
  assertSkeletonHelper(gorilla, 'Gorilla');
});
