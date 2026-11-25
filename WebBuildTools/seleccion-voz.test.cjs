'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion/voz.js'), 'utf8');
const apiBase = 'https://atlas.example.test/api/v1/atlas';
const token = 'token-temporal-de-prueba-'.repeat(2);
const pass = () => ({type: 'atlas:session', version: 1, accessToken: token, expiresAt: Date.now() + 60000});
const audio = {
  voice_profile: 'elevenlabs-prueba',
  audio_pcm: Buffer.from([0, 0, 0, 128, 0, 64]).toString('base64'),
};
const answer = (json, status = 200) => ({ok: status < 400, status, json: async () => json});
const settle = () => new Promise(resolve => setImmediate(resolve));

function app(t, {request, locked = false} = {}) {
  const requests = [];
  const sources = [];
  const events = [];
  const status = [];
  const state = {locked};
  class AudioContext {
    state = 'suspended';
    destination = {};

    async resume() {
      events.push('resume');
      if (!state.locked) this.state = 'running';
    }

    createBuffer(channels, length, sampleRate) {
      const samples = new Float32Array(length);
      return {channels, sampleRate, samples, duration: length / sampleRate, getChannelData: () => samples};
    }

    createBufferSource() {
      const source = {connect() {}, disconnect() {}, start() {sources.push(this);}, stop() {this.stopped = true;}};
      return source;
    }
  }
  const window = {
    ATLAS_CONFIG: {apiBaseUrl: apiBase + '/'}, AbortController, AudioContext, atob,
    addEventListener() {}, document: {addEventListener() {}}, setTimeout, clearTimeout,
    async fetch(url, options) {
      const route = url.slice(apiBase.length);
      events.push(route);
      requests.push({route, ...options});
      if (request) return request(route, options);
      return answer(route === '/speech' ? audio : pass());
    },
  };
  vm.runInNewContext(source, {window});
  const voice = window.AtlasHiringVoice.create({onSpeaking: value => events.push(value), onStatus: message => status.push(message)});
  t.after(() => voice.cancel());
  return {voice, requests, sources, events, status, state};
}

test('the interviewer unlocks audio in the gesture and plays the same ElevenLabs PCM contract as Atlas', async t => {
  const {voice, requests, sources, events} = app(t);
  assert.equal(voice.speak('¿Qué hiciste para resolverlo?'), true);
  await settle();
  assert.deepEqual(events, ['resume', '/web/public-session', '/speech', true]);
  assert.equal(requests[0].headers.Authorization, undefined);
  assert.equal(requests[0].credentials, 'omit');
  assert.equal(requests[1].headers.Authorization, 'Bearer ' + token);
  assert.deepEqual(JSON.parse(requests[1].body), {text: '¿Qué hiciste para resolverlo?'});
  assert.equal(sources[0].buffer.sampleRate, 24000);
  assert.equal(sources[0].buffer.channels, 1);
  assert.deepEqual([...sources[0].buffer.samples], [0, -1, 0.5]);
  sources[0].onended();
  assert.equal(events.at(-1), false);
});

test('a browser that blocks autoplay can retry the same buffered question without requesting synthesis again', async t => {
  const {voice, requests, sources, status, state} = app(t, {locked: true});
  voice.speak('Describe el resultado.');
  await settle();
  assert.equal(sources.length, 0);
  assert.match(status.at(-1), /Escuchar pregunta/);
  state.locked = false;
  voice.speak('Describe el resultado.');
  await settle();
  assert.equal(requests.length, 2);
  assert.equal(sources.length, 1);
});

test('changing questions aborts the preceding request, and the latest question alone is spoken', async t => {
  let finishOld;
  const {voice, requests, sources, events} = app(t, {request(route, options) {
    if (route !== '/speech') return answer(pass());
    if (JSON.parse(options.body).text === 'Primera pregunta') {
      return new Promise(resolve => {finishOld = () => resolve(answer(audio));});
    }
    return answer(audio);
  }});
  voice.speak('Primera pregunta');
  await settle();
  voice.speak('Siguiente pregunta');
  await settle();
  assert.equal(requests[1].signal.aborted, true);
  finishOld();
  await settle();
  assert.equal(sources.length, 1);
  voice.cancel();
  assert.equal(sources[0].stopped, true);
  assert.deepEqual(events.filter(item => typeof item === 'boolean'), [true, false]);
});

test('a rejected pass is renewed once, and a different provider is not played', async t => {
  let attempts = 0;
  const {voice, status, requests, sources} = app(t, {request(route) {
    if (route !== '/speech') return answer(pass());
    if (++attempts === 1) return answer({}, 401);
    return answer({...audio, voice_profile: 'openrouter-prueba'});
  }});
  voice.speak('¿Qué restricciones tenías?');
  await settle();
  assert.deepEqual(requests.map(item => item.route), ['/web/public-session', '/speech', '/web/public-session', '/speech']);
  assert.equal(sources.length, 0);
  assert.match(status.at(-1), /voz de ElevenLabs no está disponible/);
});
