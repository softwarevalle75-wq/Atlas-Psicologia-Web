'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const template = path.join(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion');
require(path.join(template, 'compras.js'));
require(path.join(template, 'compras-archivo.js'));
const {pack, unpack, availableAlias} = globalThis.AtlasComprasArchivo;
const record = {version: 1, id: '122f78b1-8f42-406b-91c6-5d7441d87ee3', alias: 'Grupo A',
  created: '2026-11-24T14:00:00.000Z', reviews: {retraso: {costos: {score: 2, evidence: 'privado'}}},
  answers: {retraso: {main:'Reprogramaría con obra.',followUp:''}, ofertas:{main:'',followUp:''}, recepcion:{main:'',followUp:''}}};

test('transfers only interview answers, never reviewer scores or private annotations', () => {
  const file = pack(record);
  assert.equal(file.reviews, undefined);
  assert.deepEqual(unpack({...file, reviews: record.reviews}), {...record, reviews: {}});
});
test('new exports round-trip the exact adaptive question and old interviews still load', () => {
  const followUpPrompt = '¿Cuánto costaría tu plan y cómo lo compararías con la otra alternativa viable?';
  const newer = {...record, answers:{...record.answers, retraso:{...record.answers.retraso, followUpPrompt}}};
  assert.equal(unpack(pack(newer)).answers.retraso.followUpPrompt, followUpPrompt);
  assert.equal(unpack(pack(record)).answers.retraso.followUpPrompt, undefined);
  for (const malformed of ['', 12, 'x'.repeat(301), 'pregunta\u0000']) {
    const file = pack(newer);
    assert.throws(() => unpack({...file, answers:{...file.answers, retraso:{...file.answers.retraso, followUpPrompt:malformed}}}));
  }
});
test('rejects incompatible, damaged and overlong submissions without rating unanswered cases', () => {
  const file = pack(record);
  for (const changes of [{role:'finance'}, {version:2}, {id:'wrong'}, {created:''}, {alias:' '}, {answers:{}},
    {answers:{...file.answers, ofertas:{main:'a'.repeat(2401), followUp:''}}}]) {
    assert.throws(() => unpack({...file, ...changes}));
  }
  assert.equal(unpack(file).answers.ofertas.main, '');
});
test('keeps separate participants who chose the same alias on different devices', () => {
  const others = [{alias:'Grupo A'}, {alias:'Grupo A (2)'}];
  assert.equal(availableAlias('grupo a', others), 'grupo a (3)');
  const longAlias = 'x'.repeat(40);
  assert.equal(availableAlias(longAlias, [{alias:longAlias}]).length, 40);
});
