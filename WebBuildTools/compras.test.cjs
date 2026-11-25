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

test('the same purchasing case asks a different follow-up based on the spoken or typed response', () => {
  const [delay, offers, receiving] = pilot.cases;
  assert.match(pilot.nextQuestion(delay, 'Llamaría a los dos proveedores.'), /cantidad pedirías/u);
  assert.match(pilot.nextQuestion(delay, 'Adelantaría 30 kits y pediría 20 kits al proveedor homologado.'), /Cuánto costaría/u);
  assert.match(pilot.nextQuestion(delay, 'Pediría 50 kits al proveedor homologado por 450.000 pesos adicionales.'), /confirmación pedirías/u);
  assert.equal(pilot.nextQuestion(delay, 'Confirmaría antes del martes los 30 kits adelantados y 20 kits alternativos. El costo sería de $360.000.'), delay.followUp);

  assert.match(pilot.nextQuestion(offers, 'Recomiendo la segunda oferta por sus condiciones.'), /costo total/u);
  assert.match(pilot.nextQuestion(offers, 'Prefiero la oferta por 8,9 millones de pesos.'), /fecha y cantidad/u);
  assert.match(pilot.nextQuestion(offers, 'Recomiendo 8,9 millones de pesos y confirmaría las entregas del lunes y jueves.'), /certificado corresponde/u);
  assert.equal(pilot.nextQuestion(offers, 'Recomiendo 8,9 millones de pesos. Confirmo la entrega del lunes y verifico el certificado del lote.'), offers.followUp);

  assert.match(pilot.nextQuestion(receiving, 'Haría un llamado urgente.'), /Cuántas válvulas/u);
  assert.match(pilot.nextQuestion(receiving, 'Hay 100 válvulas conformes. No pongo disponibles las dañadas.'), /qué comunicarías/iu);
  assert.match(pilot.nextQuestion(receiving, 'Hay 100 válvulas conformes. Coordino el recuento con bodega, el pago con finanzas y el despacho con obra.'), /qué registrarías/iu);
  assert.equal(pilot.nextQuestion(receiving, 'Hay 100 válvulas utilizables. Bodega recuenta, finanzas detiene el pago y obra dispone la recogida. Dejo un acta con el responsable del cierre.'), receiving.followUp);
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
