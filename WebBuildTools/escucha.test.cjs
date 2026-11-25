'use strict';

const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion/escucha.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({media, recognition = true} = {}) {
  const events = [];
  const sockets = [];
  const tracked = {enabled: true, stop() { this.stopped = true; }};
  const stream = {getTracks: () => [tracked], getAudioTracks: () => [tracked]};
  let worklet;
  let recognizer;
  let time = 0;
  let timerId = 0;
  const timers = new Map();
  class Context {
    constructor() {
      this.audioWorklet = {addModule: async () => {}};
    }
    createMediaStreamSource() {
      return {connect() {}, disconnect() {}};
    }
    async resume() {
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
    }
  }
  class Worklet {
    constructor() {
      worklet = this;
      this.port = {postMessage: data => { this.capture = data.capture; }, close() {}};
    }
    connect() {}
    disconnect() {}
    audio(capture, pcm) {
      this.port.onmessage({data: {capture, pcm}});
    }
  }
  class Socket {
    constructor(url, protocols) {
      this.url = url;
      this.protocols = Array.from(protocols);
      this.readyState = 1;
      this.bufferedAmount = 0;
      this.messages = [];
      sockets.push(this);
    }
    send(data) {
      this.messages.push(data);
    }
    close() {
      this.readyState = 3;
    }
    async emit(type, text) {
      await this.onmessage?.({data: JSON.stringify({type, text})});
    }
  }
  class Recognition {
    constructor() {
      recognizer = this;
    }
    start() { this.onstart?.(); }
    stop() { this.stopping = true; }
    abort() { this.aborted = true; }
    record(transcript, isFinal, previous = []) {
      this.onresult?.({results: [...previous, Object.assign([{transcript}], {isFinal})]});
    }
  }
  const root = {
    navigator: {mediaDevices: {getUserMedia: media || (() => Promise.resolve(stream))}},
    isSecureContext: true,
    location: {href: 'https://atlas.example/seleccion/'},
    document: {currentScript: {src: 'https://atlas.example/seleccion/escucha.js'}, addEventListener() {}, removeEventListener() {}},
    AudioContext: Context,
    AudioWorkletNode: Worklet,
    SpeechRecognition: recognition ? Recognition : undefined,
    WebSocket: Socket,
    AbortController,
    URL,
    Date: {now: () => time},
    addEventListener() {},
    removeEventListener() {},
    setTimeout(callback, delay) {
      timers.set(++timerId, {callback, time: time + delay});
      return timerId;
    },
    clearTimeout: id => { timers.delete(id); },
  };
  vm.runInNewContext(source, root, {filename: 'escucha.js'});
  return {
    events, sockets, tracked,
    get recognizer() { return recognizer; },
    get worklet() { return worklet; },
    create(connect = async () => ({url: 'wss://atlas.example/api/v1/atlas/interview/listen', token: 'temporary-pass'})) {
      return root.AtlasInterviewMic.create({
        connect,
        onPartial: text => events.push(['partial', text]),
        onFinal: text => events.push(['final', text]),
        onState: (state, engine) => events.push(['state', state, engine]),
        onError: message => events.push(['error', message]),
      });
    },
    advance(ms) {
      const target = time + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, item]) => item.time <= target)
          .sort(([, a], [, b]) => a.time - b.time)[0];
        if (!next) break;
        timers.delete(next[0]);
        time = next[1].time;
        next[1].callback();
      }
      time = target;
    },
  };
}

test('streams only after ready, shows interim text and delivers exactly the server final', async () => {
  const h = harness();
  const mic = h.create();
  assert.equal(await mic.prepare(), true);
  assert.equal(h.tracked.enabled, false);
  assert.equal(mic.start(), true);
  assert.equal(mic.start(), false);
  await flush();
  const [socket] = h.sockets;
  assert.deepEqual(socket.protocols, ['atlas-interview-v1', 'auth.temporary-pass']);
  h.worklet.audio(1, 'not ready');
  assert.deepEqual(socket.messages, []);
  await socket.emit('ready');
  assert.equal(h.tracked.enabled, true);
  h.worklet.audio(0, 'stale capture');
  const pcm = new ArrayBuffer(640);
  h.worklet.audio(1, pcm);
  assert.deepEqual(socket.messages, [pcm]);
  await socket.emit('partial', 'Primero reuní');
  assert.deepEqual(h.events.at(-1), ['partial', 'Primero reuní']);
  assert.equal(mic.stop(), true);
  assert.equal(h.tracked.enabled, false);
  assert.deepEqual(JSON.parse(socket.messages.at(-1)), {type: 'end'});
  assert.equal(h.events.filter(([event]) => event === 'final').length, 0);
  await socket.emit('final', 'Primero reuní al equipo de logística.');
  await socket.emit('final', 'Duplicado.');
  assert.deepEqual(h.events.filter(([event]) => event === 'final'), [['final', 'Primero reuní al equipo de logística.']]);
  assert.equal(socket.readyState, 3);
  mic.cancel();
  assert.equal(h.tracked.stopped, true);
  assert.equal(mic.start(), false);
});

test('uses the browser recognizer when the server is unavailable and submits after the pause', async () => {
  const h = harness();
  const mic = h.create(async () => null);
  await mic.prepare();
  mic.start();
  await flush();
  assert.equal(h.tracked.stopped, true);
  const recognition = h.recognizer;
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.continuous, true);
  recognition.onspeechstart();
  recognition.record('Compré solo lo necesario', false);
  h.advance(3000);
  assert.equal(recognition.stopping, undefined);
  assert.deepEqual(h.events.at(-1), ['partial', 'Compré solo lo necesario']);
  recognition.onspeechend();
  h.advance(2100);
  assert.equal(recognition.stopping, true);
  recognition.record('Compré solo lo necesario.', true);
  recognition.onend();
  assert.deepEqual(h.events.at(-1), ['final', 'Compré solo lo necesario.']);
  assert.equal(h.sockets.length, 0);
  mic.destroy();
});

test('denied permission never creates an audio socket or browser recognizer', async () => {
  const error = Object.assign(new Error('Denied'), {name: 'NotAllowedError'});
  const h = harness({media: async () => { throw error; }});
  const mic = h.create();
  assert.equal(await mic.prepare(), false);
  assert.equal(mic.start(), false);
  assert.equal(h.recognizer, undefined);
  assert.equal(h.sockets.length, 0);
  assert.match(h.events.at(-1)[1], /Permite el acceso al micrófono/u);
});

test('cancel discards events and releases media even when permissions resolve late', async () => {
  const tracked = {stop() { this.stopped = true; }};
  let grant;
  const h = harness({media: () => new Promise(resolve => { grant = resolve; })});
  const mic = h.create();
  const preparing = mic.prepare();
  mic.cancel();
  grant({getTracks: () => [tracked], getAudioTracks: () => [tracked]});
  assert.equal(await preparing, false);
  assert.equal(tracked.stopped, true);
  assert.equal(mic.start(), false);
  assert.deepEqual(h.events, []);
});

test('socket loss after a partial never advances the interview with unfinished content', async () => {
  const h = harness();
  const mic = h.create();
  await mic.prepare();
  mic.start();
  await flush();
  await h.sockets[0].emit('ready');
  await h.sockets[0].emit('partial', 'El resto de la frase');
  h.sockets[0].onclose();
  assert.equal(h.events.some(([event]) => event === 'final'), false);
  assert.equal(h.tracked.enabled, false);
  assert.match(h.events.at(-1)[1], /Se interrumpió la transcripción/u);
  mic.destroy();
});

test('resamples 44.1 kHz audio across worklet quanta and encodes PCM16 LE frames', () => {
  let Processor;
  const output = [];
  const root = {
    sampleRate: 44100,
    AudioWorkletProcessor: class {
      constructor() { this.port = {postMessage: message => output.push(message)}; }
    },
    registerProcessor: (name, implementation) => { assert.equal(name, 'atlas-interview-pcm'); Processor = implementation; },
  };
  vm.runInNewContext(source, root, {filename: 'escucha-worklet.js'});
  const processor = new Processor();
  processor.port.onmessage({data: {capture: 11}});
  for (const level of [-0.5, 0.5]) {
    const frame = new Float32Array(882).fill(level);
    for (let offset = 0; offset < frame.length; offset += 128) processor.process([[frame.subarray(offset, offset + 128)]]);
  }
  assert.equal(output.length, 2);
  assert.equal(output[0].capture, 11);
  assert.equal(output[0].pcm.byteLength, 640);
  assert.equal(new DataView(output[0].pcm).getInt16(638, true), -16384);
  assert.equal(new DataView(output[1].pcm).getInt16(638, true), 16384);
});
