'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const dir = path.resolve(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion');

function app(t) {
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'https://example.github.io/Atlas/seleccion/',
    runScripts: 'outside-only'
  });
  const {window} = dom;
  for (const file of ['profiles.js', 'evaluacion.js', 'seleccion.js']) {
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
  get('begin').click();
  get('next').click();
  assert.match(get('notice').textContent, /Elige una respuesta/);
  for (const question of profiles[0].questions) {
    const best = question.options.findIndex(option => option.points === 2);
    get('options').querySelectorAll('input')[best].click();
    get('next').click();
  }
  get('open-answer').value = 'Texto sensible de prueba que no se guarda';
  get('next').click();
  assert.equal(get('results').hidden, false);
  assert.equal(get('scorecards').querySelector('strong').textContent, '100%');
  assert.match(get('answer-review').textContent, /Texto sensible de prueba/);
  const saved = window.localStorage.getItem('atlas.innovarq.practice.v1');
  assert.ok(!saved.includes('Texto sensible'));
  assert.equal(JSON.parse(saved)[0].name, 'Candidato 01');
  window.document.querySelector('[data-view=compare]').click();
  assert.match(get('comparison').textContent, /Candidato 01/);
  get('compare-cargo').value = profiles[1].id;
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
