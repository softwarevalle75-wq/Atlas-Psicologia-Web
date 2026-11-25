'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const dir = path.resolve(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion');

function app(t, microphone = false, initialAttempts = []) {
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'https://example.github.io/Atlas/seleccion/',
    runScripts: 'outside-only'
  });
  const {window} = dom;
  if (initialAttempts.length) window.localStorage.setItem('atlas.innovarq.practice.v1', JSON.stringify(initialAttempts));
  if (microphone) {
    window.SpeechRecognition = class {
      start() {window.testMic = this;this.onstart?.();}
      stop() {this.onend?.();}
      abort() {this.onend?.();}
      say(transcript) {
        const final = Object.assign([{transcript}], {isFinal: true});
        this.onresult({results: [final], resultIndex: 0});
      }
    };
  }
  window.eval(fs.readFileSync(path.join(dir, '../atlas-config.js'), 'utf8'));
  for (const file of ['profiles.js', 'evaluacion.js', 'respuestas.js', 'voz.js', 'compras.js', 'compras-ui.js', 'compras-archivo.js', 'seleccion.js']) {
    window.eval(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  t.after(() => window.close());
  return {window, get: id => window.document.getElementById(id),
    profiles: window.AtlasHiringProfiles, eval: window.AtlasHiringEvaluation};
}

test('eight roles contain the same number of anchored technical and interpersonal questions', t => {
  const {profiles} = app(t);
  assert.equal(profiles.length, 8);
  assert.equal(new Set(profiles.map(role => role.id)).size, 8);
  for (const role of profiles) {
    assert.equal(role.questions.filter(item => item.group === 'hard').length, 2);
    assert.equal(role.questions.filter(item => item.group === 'soft').length, 2);
    assert.equal(role.open.anchors.length, 3);
    for (const item of role.questions) {
      assert.deepEqual(Array.from(item.options, op => op.points).sort(), [0, 1, 2]);
      assert.ok(item.options.every(op => op.note && op.text));
    }
  }
  assert.equal(profiles.find(role => role.id === 'admin').years, null);
});

test('the interview records an anonymous score, keeps the narrative out of storage, and compares by role', t => {
  const {window, get, profiles} = app(t);
  const finance = profiles.find(profile => profile.id === 'finance');
  get('cargo').value = finance.id;
  get('begin').click();
  get('next').click();
  assert.match(get('notice').textContent, /Escribe o dicta tu respuesta/);
  assert.equal(get('interview-flow').querySelectorAll('input[type="radio"]').length, 0);
  const answer = [
    'Durante el cierre de caja, un cliente aplazó el pago de una factura grande hasta el mes siguiente.',
    'Renegocié plazos de pago con los proveedores y preparé un flujo semanal de tesorería.',
    'El saldo pasó de 15 millones a 28 millones y mantuvo el nivel durante seis semanas.',
    'Comparé los estados del banco de ambos meses con la hoja de cálculo del flujo semanal.',
    'Texto sensible de prueba que no se guarda.'
  ].join(' ');
  for (let index = 0; index < 5; index++) {
    assert.equal(get('question-step').textContent, 'Pregunta ' + (index + 1) + ' de 5');
    get('open-answer').value = answer;
    get('next').click();
  }
  assert.equal(get('results').hidden, false);
  assert.equal(get('scorecards').querySelectorAll('strong').length, 4);
  assert.equal(get('scorecards').querySelector('strong').textContent, '100%');
  assert.match(get('scorecards').textContent, /20 de 20/);
  assert.match(get('answer-review').textContent, /Texto sensible de prueba/);
  const saved = window.localStorage.getItem('atlas.innovarq.practice.v1');
  assert.ok(!saved.includes('Texto sensible'));
  assert.equal(JSON.parse(saved)[0].name, 'Candidato 01');
  window.document.querySelector('[data-view=compare]').click();
  assert.match(get('comparison').textContent, /Candidato 01/);
  get('compare-cargo').value = profiles[0].id;
  get('compare-cargo').dispatchEvent(new window.Event('change'));
  assert.doesNotMatch(get('comparison').textContent, /Candidato 01/);
  get('sample-data').click();
  assert.match(get('comparison').textContent, /Empate en el mayor puntaje/);
});

test('résumé extraction reports mentions without treating them as verified evidence', t => {
  const {profiles, eval: evaluate, get, window} = app(t);
  const profile = profiles[0];
  const evidence = profile.evidence[0];
  const result = evaluate.reviewResume(profile, 'Sin experiencia en ' + evidence.terms[0], {education: '', years: null});
  assert.equal(result.education.status, 'Por verificar');
  assert.equal(result.experience.status, 'Por verificar');
  assert.ok(result.evidence[0].terms.includes(evidence.terms[0]));
  window.document.querySelector('[data-view=resume]').click();
  get('resume-text').value = '<img src=x onerror=alert(1)> ' + evidence.terms[0];
  get('analyze').click();
  assert.equal(get('resume-output').querySelector('img'), null);
  assert.match(get('resume-output').textContent, /Menciones/);
  assert.equal(window.localStorage.length, 0);
});

test('ranking includes only complete attempts and keeps equal scores tied', t => {
  const {profiles, eval: evaluate} = app(t);
  const profile = profiles[0];
  const fixtures = evaluate.examples(profile);
  const report = evaluate.rank(profile, [...fixtures, {role: profile.id, answers: {}}]);
  assert.deepEqual(Array.from(report, row => row.position), [1, 1, 3]);
  assert.equal(report[0].score.max, 8);
  assert.equal(report[0].score.points, 7);
});

test('dictation enters the first open answer and the next turn asks about missing evidence', t => {
  const {window, get, profiles} = app(t, true);
  const finance = profiles.find(profile => profile.id === 'finance');
  get('cargo').value = finance.id;
  get('begin').click();
  get('record-answer').click();
  assert.equal(get('next').disabled, true);
  window.testMic.say('Durante el cierre de caja, un cliente aplazó el pago de una factura grande hasta el mes siguiente.');
  get('record-answer').click();
  assert.match(get('open-answer').value, /cierre de caja/);
  get('next').click();
  assert.match(get('question-step').textContent, /Pregunta 1.*Repregunta 1/);
  assert.match(get('question-title').textContent, /qué harías primero/i);
  get('open-answer').value = 'Renegocié plazos de pago con los proveedores y preparé un flujo semanal de tesorería.';
  get('next').click();
  assert.equal(get('question-step').textContent, 'Pregunta 2 de 5');
  for (let index = 1; index < 5; index++) get('skip-open').click();
  assert.match(get('scorecards').textContent, /2 de 20/);
  const [entry] = JSON.parse(window.localStorage.getItem('atlas.innovarq.practice.v1'));
  const first = entry.conversation.evidence[finance.questions[0].id];
  assert.equal(entry.conversation.answered, 1);
  assert.ok(first.criteria.context && first.criteria.action);
  assert.equal(first.criteria.result, false);
  assert.doesNotMatch(JSON.stringify(entry), /factura|proveedores/);
});

test('procurement offers only three-case pilot and keeps the old exercise history separate', t => {
  const fixture = app(t);
  const profile = fixture.profiles.find(candidate => candidate.id === 'procurement');
  const entry = {...fixture.eval.examples(profile)[0], name: 'Candidato 01'};
  const {window, get} = app(t, false, [entry]);
  get('cargo').value = profile.id;
  get('cargo').dispatchEvent(new window.Event('change'));
  assert.equal(get('begin').hidden, true);
  assert.equal(get('pilot-intro').hidden, false);
  get('begin').click();
  assert.equal(get('interview-flow').hidden, true);
  window.document.querySelector('[data-view=compare]').click();
  assert.equal(get('compras-comparison').hidden, false);
  assert.match(get('comparison').textContent, /Historial · ejercicios de 8 puntos/);
  assert.match(get('comparison').textContent, /Candidato 01/);
  assert.doesNotMatch(get('comparison').textContent, /Entrevistas conversacionales/);
});
