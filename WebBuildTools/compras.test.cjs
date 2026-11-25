'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../Assets/WebGLTemplates/AtlasNexus/seleccion/compras.js');
const pilot = globalThis.AtlasComprasPilot;

test('all three cases use anchored observations of the INNOVARQ procurement competencies', () => {
  assert.equal(pilot.profileId, 'procurement');
  assert.equal(pilot.version, 1);
  assert.deepEqual(pilot.cases.map(item => item.id), ['retraso', 'ofertas', 'recepcion']);
  assert.equal(new Set(pilot.cases.map(item => item.method)).size, 3);
  const competencies = new Set(pilot.competencies.map(row => row.id));
  assert.equal(competencies.size, 5);
  for (const item of pilot.cases) {
    assert.ok(item.brief && item.prompt && item.followUp && item.method);
    assert.equal(new Set(item.criteria.map(row => row.competencyId)).size, item.criteria.length);
    for (const criterion of item.criteria) {
      assert.ok(competencies.has(criterion.competencyId));
      assert.equal(new Set(criterion.anchors).size, 3);
      assert.ok(criterion.anchors.every(anchor => typeof anchor === 'string' && anchor.trim()));
    }
  }
  for (const row of pilot.summarize()) {
    assert.equal(row.total, 2);
    assert.equal(row.reviewed, 0);
    assert.equal(row.percent, null);
  }
});

test('review statistics count explicit zero and distinguish pending, missing evidence and invalid input', () => {
  const reviews = {
    retraso: {
      costos: {score: 0, evidence: 'Multiplicaría el flete fijo por 30 unidades.'},
      proveedores: {score: 2, evidence: '   '},
      continuidad: {score: null, evidence: 'El turno es el miércoles.'},
      coordinacion: {score: '2', evidence: 'Aviso al residente.'},
    },
    ofertas: {
      costos: {score: 2, evidence: 'Calculé los tres totales y confirmé el plazo.'},
      calidad: {score: 3, evidence: 'La oferta está certificada.'},
      continuidad: {score: 2, evidence: 'Criterio ajeno a este caso.'},
    },
    recepcion: {calidad: {score: 1, evidence: 'x'.repeat(601)}},
    desconocido: {proveedores: {score: 2, evidence: 'Caso ajeno.'}},
  };
  const result = pilot.summarize(reviews);
  const costs = result.find(row => row.id === 'costos');
  assert.equal(costs.percent, 50);
  assert.equal(costs.reviewed, 2);
  assert.equal(costs.points, 2);
  assert.equal(costs.max, 4);
  assert.ok(result.filter(row => row !== costs).every(row => row.percent === null && row.reviewed === 0));
  const zero = pilot.summarize({retraso: reviews.retraso}).find(row => row.id === 'costos');
  assert.equal(zero.percent, 0);
  assert.equal(zero.reviewed, 1);
  assert.equal(zero.total, 2);
});

test('two full observations produce full coverage and human revisions recompute from current evidence', () => {
  const reviews = {};
  for (const item of pilot.cases) {
    reviews[item.id] = Object.fromEntries(item.criteria.map(criterion =>
      [criterion.competencyId, {score: 2, evidence: 'Fragmento de la respuesta del caso.'}]));
  }
  assert.ok(pilot.summarize(reviews).every(row => row.percent === 100 && row.max === 4 && row.reviewed === row.total));
  reviews.recepcion.calidad = {score: null, evidence: ''};
  reviews.ofertas.calidad.score = 1;
  assert.deepEqual(pilot.summarize(reviews).find(row => row.id === 'calidad'),
    {id: 'calidad', label: 'Calidad y trazabilidad del material', points: 1, max: 2, reviewed: 1, total: 2, percent: 50});
  assert.ok(pilot.summarize(null).every(row => row.percent === null));
});
