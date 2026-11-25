
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const dir = path.resolve(__dirname, '../Assets/WebGLTemplates/AtlasNexus/seleccion');

function app(t, initialAttempts = []) {
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url:'https://example.github.io/Atlas/seleccion/',
    runScripts:'outside-only',
  });
  const {window} = dom;
  const get = id => window.document.getElementById(id);
  if (initialAttempts.length) window.localStorage.setItem('atlas.innovarq.practice.v1', JSON.stringify(initialAttempts));
  const transport = {calls:[], playback:[], active:false, release:0};
  window.AtlasHiringVoice = {create() { return {
    unlock:()=>Promise.resolve(), cancel(){},
    speakAndWait(text) {
      transport.playback.push(text);
      return new Promise(resolve => {transport.ended=resolve;});
    },
  };}};
  window.AtlasInterviewMic = {create(options) {
    transport.partial = options.onPartial;
    transport.final = text => {transport.active=false;options.onFinal(text);};
    return {
      prepare:()=>Promise.resolve(true),
      start(){transport.active=true;options.onState('listening','deepgram'); return true;},
      stop(){return Boolean(transport.flushLast);},
      cancel(){transport.active=false;transport.release++;},
    };
  }};
  window.fetch = async (url, init) => {
    if (url.endsWith('/web/public-session')) return {
      status:200, ok:true, json:async()=>({type:'atlas:session',version:1,accessToken:'x'.repeat(100),expiresAt:Date.now()+60000}),
    };
    const body = JSON.parse(init.body);
    transport.calls.push(body);
    const data = body.operation === 'next' ? {question:'¿Qué plazo confirmarías con la obra?'} : {
      criteria:[
        {id:'continuidad',score:2,evidence:[{turn:0,quote:'pediría 50 kits'}],feedback:'Concreta la cantidad.'},
        {id:'costos',score:2,evidence:[{turn:0,quote:'cita inventada'}],feedback:''},
      ],
      summary:'La cantidad quedó explicada.',
      next_step:'Aclara el costo y el plazo.',
    };
    return {ok:true,status:200,json:async()=>data};
  };
  window.eval(fs.readFileSync(path.join(dir, '../atlas-config.js'), 'utf8'));
  for (const file of ['profiles.js','evaluacion.js','respuestas.js','compras.js','compras-ui.js','compras-archivo.js','entrevista.js','seleccion.js']) {
    window.eval(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  t.after(() => window.close());
  return {window, get, transport, profiles:window.AtlasHiringProfiles, evaluate:window.AtlasHiringEvaluation};
}

async function flush() {
  await new Promise(resolve=>setImmediate(resolve));
}

test('all eight roles retain common situational and technical questions', t => {
  const {profiles} = app(t);
  assert.equal(profiles.length, 8);
  assert.equal(new Set(profiles.map(role=>role.id)).size,8);
  for (const role of profiles) {
    assert.equal(role.questions.filter(item=>item.group==='hard').length,2);
    assert.equal(role.questions.filter(item=>item.group==='soft').length,2);
    assert.ok(role.open.prompt);
  }
});

test('hands-free session speaks, listens after audio, shows interim text, and advances without typing', async t => {
  const {window,get,transport} = app(t);
  get('begin').click();
  await flush();
  assert.equal(transport.active,false);
  assert.match(transport.playback[0],/Hola, soy tu entrevistador/);
  assert.equal(get('interview-flow').querySelector('textarea,input'),null);
  transport.ended('finished');
  await flush();
  assert.equal(transport.active,true);
  assert.match(get('voice-interview-engine').textContent,/Deepgram/);
  transport.partial('Revisaría la reserva');
  assert.equal(get('voice-interview-caption').textContent,'Revisaría la reserva');
  transport.final('Revisaría la reserva mínima de caja antes de adjudicar el piloto B.');
  await flush();
  assert.equal(transport.calls[0].operation,'next');
  assert.equal(transport.calls[0].case_id,'general');
  assert.match(transport.calls[0].transcript[0].answer,/piloto B/);
  assert.match(get('question-title').textContent,/Qué plazo/);
  assert.equal(transport.active,false);
  transport.ended('finished');
  await flush();
  assert.equal(transport.active,true);
  transport.final('También confirmaría el plazo del proyecto con el equipo.');
  await flush();
  assert.equal(get('question-step').textContent,'Pregunta 2 de 5');
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(get('interview-flow').hidden,true);
  assert.equal(transport.active,false);
});

test('procurement report retains literal evidence and keeps voice responses out of persistent storage', async t => {
  const {window,get,transport} = app(t);
  get('cargo').value = 'procurement';
  get('cargo').dispatchEvent(new window.Event('change'));
  assert.equal(get('begin').hidden,true);
  get('begin-compras').click();
  await flush();
  transport.ended('finished');
  await flush();
  transport.final('Hoy pediría 50 kits y confirmaría por escrito la fecha.');
  await flush();
  transport.ended('finished');
  await flush();
  get('voice-interview-finish').click();
  await flush();
  assert.equal(transport.active,false);
  const turn = transport.calls.find(call=>call.operation==='evaluate');
  assert.equal(turn.transcript[0].case_id,'retraso');
  assert.equal(turn.case_id,'procurement');
  assert.equal(get('voice-report').hidden,false);
  assert.equal(get('voice-report-criteria').children.length,5);
  assert.match(get('voice-report-coverage').textContent,/1 de 5 criterios/);
  assert.match(get('voice-report-criteria').textContent,/pediría 50 kits/);
  assert.doesNotMatch(get('voice-report-criteria').textContent,/cita inventada/);
  assert.equal(get('voice-report-export').hidden,false);
  assert.equal(window.localStorage.length,0);
  get('compare-now').click();
  assert.match(get('compras-comparison').textContent,/Compras 01/);
});

test('finishing while listening includes the last finalized answer in the report', async t => {
  const {get,transport} = app(t);
  get('begin').click();
  await flush();
  transport.ended('finished');
  await flush();
  transport.flushLast = true;
  get('voice-interview-finish').click();
  assert.equal(transport.calls.length,0);
  transport.final('Confirmaría la liquidez con el equipo antes de aprobar el gasto.');
  await flush();
  assert.equal(transport.calls[0].operation,'evaluate');
  assert.match(transport.calls[0].transcript[0].answer,/la liquidez/);
  assert.equal(get('voice-report').hidden,false);
});

test('résumé extraction reports mentions without treating them as verified evidence', t => {
  const {profiles,evaluate,get,window} = app(t);
  const profile = profiles[0];
  const evidence = profile.evidence[0];
  const result = evaluate.reviewResume(profile,'Sin experiencia en ' + evidence.terms[0],{education:'',years:null});
  assert.equal(result.education.status,'Por verificar');
  assert.equal(result.experience.status,'Por verificar');
  window.document.querySelector('[data-view=resume]').click();
  get('resume-text').value = '<img src=x onerror=alert(1)> ' + evidence.terms[0];
  get('analyze').click();
  assert.equal(get('resume-output').querySelector('img'),null);
  assert.match(get('resume-output').textContent,/Menciones/);
});

test('legacy ranking preserves ties and keeps the procurement history', t => {
  const fixture = app(t);
  const profile = fixture.profiles.find(role=>role.id==='procurement');
  const demos = fixture.evaluate.examples(profile);
  const rows = fixture.evaluate.rank(profile,[...demos,{role:profile.id,answers:{}}]);
  assert.deepEqual(Array.from(rows,row=>row.position),[1,1,3]);
  const {window,get} = app(t,[{...demos[0],name:'Candidato 01'}]);
  get('compare-cargo').value = profile.id;
  window.document.querySelector('[data-view=compare]').click();
  assert.match(get('comparison').textContent,/Historial · ejercicios de 8 puntos/);
  assert.match(get('comparison').textContent,/Candidato 01/);
});
