import assert from 'node:assert';
import test from 'node:test';
import soundfont2 from 'soundfont2';
const { GeneratorType } = soundfont2;
import { SoundFontEngine, timecentsToSeconds } from '../src/audio/SoundFontEngine.js';
import { audioContextManager } from '../src/audio/AudioContextManager.js';

class FakeParam {
  constructor() {
    this.events = [];
    this.value = 0;
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'linear', value, time });
  }

  cancelScheduledValues(time) {
    this.events.push({ type: 'cancel', time });
  }
}

class FakeGain {
  constructor() {
    this.gain = new FakeParam();
  }

  connect(node) {
    this.connectedTo = node;
    return node;
  }

  disconnect() {}
}

class FakeBuffer {
  constructor(length, sampleRate) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }

  getChannelData() {
    return this.data;
  }
}

class FakeBufferSource {
  constructor() {
    this.playbackRate = {
      setValueAtTime: (value, time) => {
        this.playbackRateValue = { value, time };
      }
    };
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
  }

  connect(node) {
    this.connectedTo = node;
    return node;
  }

  start(time) {
    this.startedAt = time;
  }

  stop(time) {
    this.stoppedAt = time;
  }

  disconnect() {}
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = 'output';
  }

  createBufferSource() {
    return new FakeBufferSource();
  }

  createGain() {
    const gain = new FakeGain();
    this.lastGain = gain;
    return gain;
  }

  createBuffer(channels, length, sampleRate) {
    return new FakeBuffer(length, sampleRate);
  }
}

test('applies SF2 loop points and envelope gains when triggering notes', () => {
  const ctx = new FakeAudioContext();
  ctx.currentTime = 1;
  audioContextManager.audioContext = ctx;

  const engine = new SoundFontEngine();
  const sampleRate = 48000;
  const keyData = {
    sampleBuffer: ctx.createBuffer(1, 1024, sampleRate),
    sample: {
      header: {
        sampleRate,
        startLoop: 480,
        endLoop: 960
      }
    },
    generators: {
      [GeneratorType.StartLoopAddrsOffset]: { value: 10 },
      [GeneratorType.EndLoopAddrsOffset]: { value: 20 },
      [GeneratorType.StartLoopAddrsCoarseOffset]: { value: 1 },
      [GeneratorType.EndLoopAddrsCoarseOffset]: { value: 1 },
      [GeneratorType.SampleModes]: { value: 1 },
      [GeneratorType.AttackVolEnv]: { value: 0 },
      [GeneratorType.HoldVolEnv]: { value: 0 },
      [GeneratorType.DecayVolEnv]: { value: 0 },
      [GeneratorType.SustainVolEnv]: { value: 0 },
      [GeneratorType.ReleaseVolEnv]: { value: 0 },
      [GeneratorType.InitialAttenuation]: { value: 200 }
    },
    sampleMode: 1,
    loopStart: 0,
    loopEnd: 0
  };

  const offsets = engine.getLoopOffsets(keyData.generators);
  keyData.sampleMode = offsets.sampleMode;
  keyData.loopStart = (keyData.sample.header.startLoop + offsets.loopStartOffset) / sampleRate;
  keyData.loopEnd = (keyData.sample.header.endLoop + offsets.loopEndOffset) / sampleRate;

  engine.getKeyDataForProgram = () => keyData;

  engine.noteOnForAnimal('cat', 60, 0.5, ctx.currentTime);

  const voice = engine.activeVoices.get('cat').get(60);
  const expectedLoopStart = keyData.loopStart;
  const expectedLoopEnd = keyData.loopEnd;

  assert.strictEqual(voice.source.loop, true);
  assert.ok(Math.abs(voice.source.loopStart - expectedLoopStart) < 1e-3);
  assert.ok(Math.abs(voice.source.loopEnd - expectedLoopEnd) < 1e-3);

  const lastGainEvent = voice.gain.gain.events.at(-1);
  assert.strictEqual(lastGainEvent.type, 'set');
  assert.ok(lastGainEvent.value < 0.06 && lastGainEvent.value > 0.04);
});

test('honors percussive release envelopes on note off', () => {
  const ctx = new FakeAudioContext();
  audioContextManager.audioContext = ctx;

  const engine = new SoundFontEngine();
  const releaseTimecents = -7000;
  const releaseSeconds = timecentsToSeconds(releaseTimecents);

  const keyData = {
    sampleBuffer: ctx.createBuffer(1, 1024, 44100),
    sample: { header: { sampleRate: 44100, startLoop: 0, endLoop: 0 } },
    generators: {
      [GeneratorType.AttackVolEnv]: { value: -12000 },
      [GeneratorType.HoldVolEnv]: { value: -12000 },
      [GeneratorType.DecayVolEnv]: { value: -12000 },
      [GeneratorType.SustainVolEnv]: { value: 0 },
      [GeneratorType.ReleaseVolEnv]: { value: releaseTimecents },
      [GeneratorType.InitialAttenuation]: { value: 0 }
    },
    sampleMode: 0,
    loopStart: 0,
    loopEnd: 0
  };

  engine.getKeyDataForProgram = () => keyData;

  engine.noteOnForAnimal('step', 36, 1, 0);
  engine.noteOffForAnimal('step', 36, 0.25);

  const voice = engine.activeVoices.get('step')?.get(36);
  assert.strictEqual(voice, undefined);

  const gainEvents = ctx.lastGain?.gain.events ?? engine.activeVoices;
  const releaseEvent = gainEvents.at(-1);
  assert.strictEqual(releaseEvent.type, 'linear');
  assert.ok(Math.abs(releaseEvent.time - (0.25 + releaseSeconds)) < 1e-4);
});
