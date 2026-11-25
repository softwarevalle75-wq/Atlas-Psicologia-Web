'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../Assets/WebGLTemplates/AtlasNexus/seleccion/respuestas.js');

const open = globalThis.AtlasOpenResponse;
const finance = {id: 'finance'};
const quality = {id: 'quality'};
const complete = [
  'Durante el cierre de caja, un cliente aplazó el pago de una factura grande hasta el mes siguiente.',
  'Renegocié plazos de pago con los proveedores y preparé un flujo semanal de tesorería.',
  'El saldo pasó de 15 millones a 28 millones y mantuvo el nivel durante seis semanas.',
  'Comparé los estados del banco de ambos meses con la hoja de cálculo del flujo semanal.',
];

test('finds four observable dimensions across original and follow-up answers', () => {
  const result = open.assess(finance, complete);
  assert.equal(result.max, 4);
  assert.equal(result.points, 4);
  assert.equal(result.complete, true);
  assert.deepEqual(result.criteria.map(item => item.id), ['context', 'action', 'result', 'verification']);
  assert.ok(result.criteria.every(item => item.evidence && item.description));
});

test('filler, keyword lists and denials do not earn unsupported credit', () => {
  const fillers = ['aaa aaa aaa', 'Sí.', 'caja habia contextos plazos resultado caja', 'contexto acción resultado evidencia verificable', 'No sé qué decir.'];
  assert.equal(open.assess(finance, fillers).points, 0);
  const denial = open.assess(finance, [
    'No renegocié plazos de pago con proveedores en el cierre de caja.',
    'Tampoco comparé los estados del banco con la hoja de cálculo.',
  ]);
  assert.equal(denial.criteria.find(item => item.id === 'action').met, false);
  assert.equal(denial.criteria.find(item => item.id === 'verification').met, false);
  assert.equal(open.assess(finance,['El ajuste del saldo se presentó con un desglose del presupuesto.']).criteria.find(item => item.id === 'action').met, false);
});

test('chooses different, role-specific prompts based on the answer', () => {
  const broad = open.followUp(finance, [], []);
  assert.equal(broad.id, 'detail');
  assert.match(broad.text, /caja/);
  assert.equal(open.followUp(finance, complete.slice(0, 1), []).id, 'action');
  assert.equal(open.followUp(finance, complete.slice(0, 2), []).id, 'result');
  assert.equal(open.followUp(finance, complete.slice(0, 3), []).id, 'verification');
  assert.equal(open.followUp(finance, complete, []), null);
  assert.equal(open.followUp(finance, [], ['detail', 'action']), null);
  assert.notEqual(open.followUp(quality, [], []).text, broad.text);
});

test('versioned rubric persists flags instead of verbatim answers and permits human review', () => {
  const summary = open.summarize(open.assess(finance, complete.slice(0, 1)));
  assert.equal(summary.version, 2);
  assert.equal(open.isSummary(summary), true);
  assert.equal(open.isSummary({...summary, version: 1}), false);
  assert.doesNotMatch(JSON.stringify(summary), /cliente|factura/);
  const changed = open.override(summary, 'action', true);
  assert.equal(summary.criteria.action, false);
  assert.equal(changed.criteria.action, true);
  assert.equal(changed.reviewed.action, true);
  assert.equal(open.override(summary, 'anything', true), summary);
});

test('combined score respects separate legacy and open-answer maxima', () => {
  const closed = {points: 5, max: 8, percent: 63, completed: true};
  assert.deepEqual(open.combine(closed, null), {...closed, open: null});
  const understood = open.summarize(open.assess(finance, complete));
  assert.deepEqual(open.combine(closed, understood), {
    points: 9, max: 12, percent: 75, completed: true, open: {points: 4, max: 4, percent: 100},
  });
});
