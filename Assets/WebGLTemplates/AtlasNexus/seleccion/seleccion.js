(function () {
  'use strict';

  const profiles = window.AtlasHiringProfiles;
  const evaluate = window.AtlasHiringEvaluation;
  const openRubric = window.AtlasOpenResponse;
  const byId = id => document.getElementById(id);
  const storageKey = 'atlas.innovarq.practice.v1';
  const groupNames = {hard: 'Habilidades técnicas', soft: 'Habilidades interpersonales'};
  const profileFor = select => profiles.find(profile => profile.id === byId(select).value) || profiles[0];
  let interview;
  let demoVisible = false;
  let view = 'interview';
  let attempts = readAttempts();
  const office = document.querySelector('.office');
  const officeMode = byId('office-mode');
  let speaking = false;
  let listening = false;
  let gesture = '';
  let gestureTimer = 0;
  let scene;
  if (window.AtlasHiringScene) {
    scene = window.AtlasHiringScene.mount(byId('office-3d'), status => {
      officeMode.textContent = office.dataset.scene === 'fallback' ? status : '';
    });
  }
  const voice = window.AtlasHiringVoice.create({
    onTranscript: receiveTranscript,
    onStatus: message => notice(message),
    onSpeaking: active => {speaking = active;updateActivity();},
    onListening: active => {listening = active;updateActivity();},
  });
  const pilotRole = window.AtlasComprasPilot.profileId;
  const pilot = window.AtlasComprasUI.mount({
    flow: byId('compras-flow'), comparison: byId('compras-comparison'), voice, notice, animate: animateFeedback,
    onExit: closePilot,
    onExport: entry => window.AtlasComprasArchivo.download(entry),
    onCompare: () => {
      closePilot();
      byId('compare-cargo').value = pilotRole;
      switchView('compare');
    },
  });
  window.AtlasComprasArchivo.bindImport(byId('pilot-import'), byId('pilot-import-status'), pilot);

  function closePilot() {
    voice.cancel();
    byId('compras-flow').hidden = true;
    byId('setup').hidden = false;
    document.body.classList.remove('interview-active');
    byId('begin-compras').focus();
  }

  function updateActivity() {
    const mode = listening ? 'listening' : speaking ? 'talking' : gesture || 'idle';
    office.dataset.activity = mode;
    officeMode.textContent = listening ? 'Escuchando' : speaking ? 'Hablando' :
      gesture === 'thinking' ? 'Revisando respuesta' : '';
    scene?.setMode(mode);
    byId('record-answer').textContent = listening ? 'Terminar dictado' : 'Responder por voz';
    byId('record-answer').setAttribute('aria-pressed', String(listening));
    byId('next').disabled = listening;
    byId('hear').disabled = listening || !voice.canSpeak;
    byId('skip-open').disabled = listening;
    pilot.setListening(listening);
  }

  function animateFeedback(next) {
    clearTimeout(gestureTimer);
    gesture = next;
    updateActivity();
    if (next) gestureTimer = setTimeout(() => animateFeedback(''), 1100);
  }

  function receiveTranscript(raw) {
    if (view === 'interview' && pilot.receiveTranscript(raw)) return;
    if (!interview || interview.entry || view !== 'interview') return;
    if (!current()) {
      const field = byId('open-answer');
      field.value = (field.value.trim() + ' ' + raw).trim().slice(0, 2400);
      return;
    }
    const answer = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();
    const choices = {a: 0, primera: 0, uno: 0, 1: 0, b: 1, be: 1, segunda: 1, dos: 1, 2: 1, c: 2, ce: 2, tercera: 2, tres: 2, 3: 2};
    const parsed = answer.match(/^(?:(?:elijo |marco )?(?:la )?(?:opcion )?)?(a|b|be|c|ce|primera|segunda|tercera|uno|dos|tres|1|2|3)$/);
    const index = parsed ? choices[parsed[1]] : undefined;
    if (index == null) {
      notice('Entendí «' + raw + '». Di «opción A», «opción B» o «opción C», o toca la respuesta.');
      return;
    }
    const input = byId('options').querySelectorAll('input')[index];
    if (input) {
      input.checked = true;
      notice('Marqué la opción ' + 'ABC'[index] + '. Confirma con Continuar.');
    }
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function notice(message) {
    byId('notice').textContent = message;
  }

  function readAttempts() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(value)) return [];
      return value.filter(item => item && /^Candidato \d+$/.test(item.name) &&
        profiles.some(profile => profile.id === item.role) &&
        item.answers && typeof item.answers === 'object').slice(-100);
    } catch {
      return [];
    }
  }

  function addAttempt(profile, answers, assessment) {
    const saved = readAttempts();
    if (saved.length) attempts = saved;
    const max = attempts.reduce((number, item) => Math.max(number, Number(item.name.slice(10)) || 0), 0);
    const entry = {name: 'Candidato ' + String(max + 1).padStart(2, '0'), role: profile.id, answers: {...answers}, open: openRubric.summarize(assessment)};
    attempts = [...attempts, entry].slice(-100);
    try {
      localStorage.setItem(storageKey, JSON.stringify(attempts));
    } catch {
      notice('El navegador bloqueó el guardado. Puedes comparar los resultados en esta pestaña.');
    }
    return entry;
  }

  function switchView(next) {
    voice.cancel();
    animateFeedback('');
    view = next;
    if (next !== 'compare') document.body.classList.remove('pilot-report');
    document.body.classList.toggle('interview-active', next === 'interview' && (pilot.active || (!!interview && !interview.entry)));
    scene?.setVisible(next === 'interview');
    for (const button of document.querySelectorAll('[data-view]')) {
      const active = button.dataset.view === next;
      button.setAttribute('aria-pressed', String(active));
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const id of ['interview', 'resume', 'compare']) byId(id).hidden = id !== next;
    notice('');
    if (next === 'compare') renderComparison();
    if (next !== 'interview') {
      const heading = byId(next).querySelector('h1, h2');
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  function showProfile() {
    const profile = profileFor('cargo');
    byId('pilot-intro').hidden = profile.id !== pilotRole;
    byId('begin').textContent = profile.id === pilotRole ? 'Practicar la entrevista general' : 'Comenzar entrevista';
    byId('begin').classList.toggle('button-primary', profile.id !== pilotRole);
    byId('begin').classList.toggle('button-secondary', profile.id === pilotRole);
    const meta = byId('profile-meta');
    meta.replaceChildren(
      element('p', profile.objective),
      element('p', 'Formación · ' + profile.education, 'hint'),
      element('p', 'Experiencia · ' + profile.experience, 'hint')
    );
  }

  function startInterview() {
    interview = {profile: profileFor('cargo'), next: 0, answers: Object.create(null), openAnswers: [], followUps: [], assessment: null, entry: null};
    byId('setup').hidden = true;
    byId('results').hidden = true;
    byId('interview-flow').hidden = false;
    document.body.classList.add('interview-active');
    byId('open-answer').value = '';
    renderQuestion(true);
  }

  function current() {
    return interview.profile.questions[interview.next];
  }

  function renderQuestion(readAloud) {
    const {profile, next, followUps} = interview;
    const question = current();
    const follow = followUps.at(-1);
    const title = byId('question-title');
    byId('question-step').textContent = question ? 'Ejercicio ' + (next + 1) + ' de ' + profile.questions.length :
      follow ? 'Repregunta ' + followUps.length : 'Entrevista abierta';
    byId('question-skill').textContent = question ? groupNames[question.group] + ' · ' + question.skill :
      follow ? 'Profundizar en tu respuesta' : 'Respuesta abierta · 4 puntos posibles';
    title.textContent = question?.prompt || follow?.text || profile.open.prompt;
    byId('next').textContent = question ? 'Continuar' : 'Enviar respuesta';
    byId('open-area').hidden = !!question;
    byId('skip-open').hidden = !!question;
    byId('voice-hint').textContent = !voice.canListen ?
      'El dictado depende del navegador. También puedes responder con los controles de la pantalla.' :
      question ? 'Di «opción A», «opción B» u «opción C», o toca una opción. El navegador puede procesar el audio en línea.' :
      'Dicta tu respuesta y revisa la transcripción antes de enviarla. El navegador puede procesar el audio en línea.';
    const wrapper = byId('options');
    wrapper.hidden = !question;
    wrapper.replaceChildren();
    if (question) {
      question.options.forEach((option, index) => {
        const label = element('label', null, 'answer-option');
        const radio = element('input');
        radio.type = 'radio';
        radio.name = 'answer';
        radio.value = String(index);
        radio.addEventListener('change', () => notice(''));
        label.append(radio, element('span', 'ABC'[index] + '. ' + option.text));
        wrapper.append(label);
      });
    }
    notice('');
    title.focus();
    if (readAloud) readQuestion(false);
  }

  function readQuestion(includeOptions) {
    if (!voice.canSpeak || view !== 'interview' || !interview || interview.entry) return;
    const question = current();
    let text = byId('question-title').textContent;
    if (includeOptions && question) {
      text += ' ' + question.options.map((option,index) => 'Opción ' + 'ABC'[index] + '. ' + option.text).join(' ');
    }
    voice.speak(text);
  }

  function finishInterview() {
    if (interview.entry) return;
    const texts = interview.openAnswers.map(item => item.text);
    interview.assessment = openRubric.assess(interview.profile, texts);
    interview.entry = addAttempt(interview.profile, interview.answers, interview.assessment);
    animateFeedback('acknowledge');
    renderResults();
  }

  function advance() {
    if (!interview || interview.entry || listening) return;
    const question = current();
    if (question) {
      const radio = byId('options').querySelector('input:checked');
      if (!radio) {
        notice('Elige una respuesta para continuar.');
        byId('options').querySelector('input')?.focus();
        return;
      }
      interview.answers[question.id] = Number(radio.value);
      interview.next++;
      renderQuestion(true);
      return;
    }
    const field = byId('open-answer');
    const text = field.value.trim();
    if (!text) {
      notice('Escribe o dicta tu respuesta. También puedes omitir esta pregunta.');
      field.focus();
      return;
    }
    interview.openAnswers.push({prompt: byId('question-title').textContent, text});
    field.value = '';
    const follow = openRubric.followUp(interview.profile, interview.openAnswers.map(item => item.text), interview.followUps.map(item => item.id));
    if (follow) {
      interview.followUps.push(follow);
      animateFeedback('thinking');
      renderQuestion(true);
      return;
    }
    voice.cancel();
    finishInterview();
  }

  function scorecard(label, result) {
    const card = element('div', null, 'scorecard');
    card.append(element('p', label), element('strong', result.percent + '%'),
      element('span', result.points + ' de ' + result.max + ' puntos'));
    const meter = element('progress');
    meter.max = 100;
    meter.value = result.percent;
    meter.setAttribute('aria-label', label);
    card.append(meter);
    return card;
  }

  function writeReview(summary) {
    const review = byId('answer-review');
    review.replaceChildren(element('h3', 'Retroalimentación'));
    for (const {question, option} of summary.items) {
      const item = element('article', null, 'review-item');
      item.append(element('h4', question.skill), element('p', option.text),
        element('p', option.points + '/2 · ' + option.note, 'hint'));
      review.append(item);
    }
    const open = element('article', null, 'review-item');
    open.append(element('h4', 'Evidencia de las respuestas abiertas'));
    for (const item of interview.openAnswers) {
      open.append(element('p', item.prompt, 'hint'), element('blockquote', item.text));
    }
    if (!interview.openAnswers.length) open.append(element('p', 'Sin respuestas abiertas registradas.', 'hint'));
    const list = element('ul', null, 'evidence-list');
    for (const criterion of interview.assessment.criteria) {
      const row = element('li');
      row.append(element('strong', (criterion.met ? '1/1 · ' : '0/1 · ') + criterion.label),
        element('span', criterion.description + (criterion.evidence ? ' · Evidencia: ' + criterion.evidence : '')));
      list.append(row);
    }
    open.append(list, element('p', 'El puntaje automático indica evidencia en el relato y puede ser revisado por el evaluador.', 'hint'));
    review.append(open);
  }

  function renderResults() {
    const summary = openRubric.combine(evaluate.score(interview.profile, interview.answers), interview.entry.open);
    byId('interview-flow').hidden = true;
    document.body.classList.remove('interview-active');
    byId('results').hidden = false;
    byId('scorecards').replaceChildren(
      scorecard('Resultado de la práctica', summary),
      scorecard(groupNames.hard, summary.groups.hard),
      scorecard(groupNames.soft, summary.groups.soft),
      scorecard('Respuestas abiertas', {points:summary.open.points,max:summary.open.max,percent:Math.round(100*summary.open.points/summary.open.max)})
    );
    byId('compare-cargo').value = interview.profile.id;
    writeReview(summary);
    byId('open-answer').value = '';
    byId('results').querySelector('h2').focus();
  }

  function reviewResume() {
    const profile = profileFor('resume-cargo');
    const output = byId('resume-output');
    const text = byId('resume-text').value.trim();
    if (!text) {
      notice('Pega el texto de una hoja de vida o carga el ejemplo.');
      byId('resume-text').focus();
      return;
    }
    const yearsField = byId('resume-years');
    if (!yearsField.reportValidity()) return;
    notice('');
    const report = evaluate.reviewResume(profile, text, {
      education: byId('resume-education').value,
      years: yearsField.value === '' ? null : yearsField.valueAsNumber,
    });
    const evidence = element('ul', null, 'evidence-list');
    for (const group of report.evidence) {
      const row = element('li');
      row.append(element('strong', group.label),
        element('span', group.terms.length ? 'Menciones · ' + group.terms.join(', ') : 'Sin mención en el texto · solicitar evidencia'));
      evidence.append(row);
    }
    output.replaceChildren(
      element('h3', 'Evidencia para ' + profile.title),
      element('p', 'Formación requerida · ' + profile.education),
      element('p', 'Formación · ' + report.education.status +
        (report.education.mentions.length ? ' · Menciones: ' + report.education.mentions.join(', ') : '')),
      element('p', 'Experiencia solicitada · ' + profile.experience),
      element('p', 'Experiencia · ' + report.experience.status +
        (report.experience.years != null ? ' · ' + report.experience.years + ' años indicados por el revisor' : '')),
      evidence,
      element('p', 'Contrasta las menciones con certificados, fechas y ejemplos del trabajo. La hoja de vida queda fuera del puntaje de la entrevista.', 'hint')
    );
  }

  function fillExample() {
    const profile = profileFor('resume-cargo');
    const skills = profile.evidence.map(item => item.terms[0]).join(', ');
    byId('resume-text').value = [
      'EJEMPLO FICTICIO — Perfil de práctica',
      'Formación declarada: ' + (profile.educationTerms?.[0] || profile.education),
      'Resultados y funciones declarados: ' + skills + '.',
      'Pendiente verificar periodo, responsabilidades y soportes.',
    ].join('\n');
    byId('resume-years').value = '';
    byId('resume-education').value = '';
    reviewResume();
  }

  function comparisonTable(profile, list, title, empty, includesOpen) {
    const wrapper = element('section', null, 'review-item');
    wrapper.append(element('h3', title));
    const rows = evaluate.rank(profile, list, entry => openRubric.combine(evaluate.score(profile, entry.answers || {}), entry.open));
    if (!rows.length) {
      wrapper.append(element('p', empty, 'empty'));
      return wrapper;
    }
    const leaders = rows.filter(row => row.position === 1);
    const leaderLabel = leaders.length > 1 ? 'Empate en el mayor puntaje' : 'Mayor puntaje en la práctica';
    wrapper.append(element('p', leaderLabel + ' · ' + leaders.map(row => row.entry.name).join(', ') + ' (' + leaders[0].score.percent + '%)', 'hint'));
    const scroll = element('div', null, 'table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('aria-label', title);
    const table = element('table');
    const head = table.createTHead().insertRow();
    const labels = ['N.º', 'Perfil', 'Téc.', 'Blandas', ...(includesOpen ? ['Abierta'] : []), 'Total'];
    for (const label of labels) {
      const cell = element('th', label);
      cell.scope = 'col';
      if (label === 'N.º') cell.setAttribute('aria-label', 'Posición en la práctica');
      if (label === 'Téc.') cell.setAttribute('aria-label', 'Habilidades técnicas');
      if (label === 'Abierta') cell.setAttribute('aria-label', 'Respuestas abiertas');
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      const stats = [row.position, row.entry.name, row.score.groups.hard.percent + '%', row.score.groups.soft.percent + '%', ...(includesOpen ? [row.score.open.points + '/' + row.score.open.max] : []), row.score.percent + '%'];
      for (const text of stats) {
        tr.append(element('td', text));
      }
    }
    scroll.append(table);
    wrapper.append(scroll);
    return wrapper;
  }

  function renderComparison() {
    const profile = profileFor('compare-cargo');
    const hasPilot = profile.id === pilotRole;
    document.body.classList.toggle('pilot-report', hasPilot && view === 'compare');
    byId('compras-comparison').hidden = !hasPilot;
    byId('pilot-transfer').hidden = !hasPilot;
    if (hasPilot) pilot.renderComparison();
    const report = byId('comparison');
    const currentAttempts = attempts.filter(entry => openRubric.isSummary(entry.open));
    const older = attempts.filter(entry => entry.role === profile.id && !openRubric.isSummary(entry.open));
    report.replaceChildren(comparisonTable(profile, currentAttempts, 'Entrevistas · 12 puntos posibles', 'Completa una entrevista para este cargo y repítela con otro participante para comparar.', true));
    if (older.length) report.append(comparisonTable(profile, older, 'Historial · ejercicios de 8 puntos', '', false));
    if (demoVisible) {
      const samples = evaluate.examples(profile).map((entry, index) => ({
        ...entry,
        open: {version: openRubric.VERSION, criteria: {context:true, action:true, result:index<2, verification:false}},
      }));
      report.append(comparisonTable(profile, samples, 'Ejemplos ficticios · 12 puntos posibles', '', true));
    }
  }

  for (const id of ['cargo', 'resume-cargo', 'compare-cargo']) {
    byId(id).replaceChildren(...profiles.map(profile => new Option(profile.title, profile.id)));
  }
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => switchView(button.dataset.view));
  }
  byId('cargo').addEventListener('change', () => {
    showProfile();
    byId('compare-cargo').value = byId('cargo').value;
    byId('resume-cargo').value = byId('cargo').value;
    byId('resume-output').replaceChildren();
  });
  byId('begin').addEventListener('click', startInterview);
  byId('begin-compras').addEventListener('click', () => {
    if (profileFor('cargo').id !== pilotRole) return;
    byId('setup').hidden = true;
    byId('compras-flow').hidden = false;
    document.body.classList.add('interview-active');
    notice('');
    pilot.start();
  });
  byId('next').addEventListener('click', advance);
  byId('compare-now').addEventListener('click', () => switchView('compare'));
  byId('repeat').addEventListener('click', () => {
    byId('cargo').value = interview.profile.id;
    byId('results').hidden = true;
    byId('setup').hidden = false;
    interview = null;
    notice('');
    showProfile();
    byId('begin').focus();
  });
  byId('hear').disabled = !voice.canSpeak;
  byId('hear').addEventListener('click', () => readQuestion(true));
  byId('record-answer').disabled = !voice.canListen;
  byId('record-answer').addEventListener('click', () => {
    if (listening) voice.stop();
    else if (interview && !interview.entry && view === 'interview') voice.listen();
  });
  byId('skip-open').addEventListener('click', () => {
    voice.cancel();
    if (interview && !interview.entry && !current()) finishInterview();
  });

  byId('resume-cargo').addEventListener('change', () => {
    byId('resume-output').replaceChildren();
    notice('');
  });
  byId('analyze').addEventListener('click', reviewResume);
  byId('example-cv').addEventListener('click', fillExample);
  byId('compare-cargo').addEventListener('change', renderComparison);
  byId('sample-data').addEventListener('click', () => {
    demoVisible = !demoVisible;
    byId('sample-data').setAttribute('aria-pressed', String(demoVisible));
    byId('sample-data').textContent = demoVisible ? 'Ocultar resultados de ejemplo' : 'Cargar resultados de ejemplo';
    renderComparison();
  });
  window.addEventListener('pagehide', () => voice.cancel());

  if (new URLSearchParams(window.location.search).get('piloto') === 'compras') {
    for (const id of ['cargo', 'compare-cargo', 'resume-cargo']) byId(id).value = pilotRole;
  }
  showProfile();
  switchView('interview');
})();
