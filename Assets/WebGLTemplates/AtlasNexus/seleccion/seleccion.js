(function () {
  'use strict';

  const profiles = window.AtlasHiringProfiles;
  const evaluate = window.AtlasHiringEvaluation;
  const openRubric = window.AtlasOpenResponse;
  const byId = id => document.getElementById(id);
  const storageKey = 'atlas.innovarq.practice.v1';
  const groupNames = {hard: 'Habilidades técnicas', soft: 'Habilidades interpersonales', open: 'Experiencia aplicada'};
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
    const field = byId('open-answer');
    field.value = (field.value.trim() + ' ' + raw).trim().slice(0, field.maxLength);
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
      return value.filter(item => {
        if (!item || !/^Candidato \d+$/.test(item.name)) return false;
        const profile = profiles.find(profile => profile.id === item.role);
        if (!profile) return false;
        return item.conversation ? Boolean(evaluate.scoreConversation(profile, item.conversation)) :
          Boolean(item.answers && typeof item.answers === 'object');
      }).slice(-100);
    } catch {
      return [];
    }
  }

  function addAttempt(profile, records) {
    const saved = readAttempts();
    if (saved.length) attempts = saved;
    const max = attempts.reduce((number, item) => Math.max(number, Number(item.name.slice(10)) || 0), 0);
    const evidence = Object.fromEntries(records.map(({question, assessment}) => [question.id, openRubric.summarize(assessment)]));
    const entry = {
      name: 'Candidato ' + String(max + 1).padStart(2, '0'),
      role: profile.id,
      conversation: {
        version: evaluate.CONVERSATION_VERSION,
        answered: records.filter(record => record.turns.length > 0).length,
        evidence,
      },
    };
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
    byId('begin').hidden = profile.id === pilotRole;
    const meta = byId('profile-meta');
    meta.replaceChildren(
      element('p', profile.objective),
      element('p', 'Formación · ' + profile.education, 'hint'),
      element('p', 'Experiencia · ' + profile.experience, 'hint')
    );
  }

  function startInterview() {
    const profile = profileFor('cargo');
    if (profile.id === pilotRole) return;
    interview = {profile, questions: evaluate.conversationQuestions(profile), next: 0, records: [], turns: [], followUps: [], entry: null};
    byId('setup').hidden = true;
    byId('results').hidden = true;
    byId('interview-flow').hidden = false;
    document.body.classList.add('interview-active');
    byId('open-answer').value = '';
    renderQuestion();
  }

  function current() {
    return interview.questions[interview.next];
  }

  function renderQuestion() {
    const {questions, next, followUps} = interview;
    const question = current();
    const follow = followUps.at(-1);
    const title = byId('question-title');
    const progress = 'Pregunta ' + (next + 1) + ' de ' + questions.length;
    byId('question-step').textContent = follow ? progress + ' · Repregunta ' + followUps.length : progress;
    byId('question-skill').textContent = question.group === 'open' ? question.skill :
      groupNames[question.group] + ' · ' + question.skill;
    title.textContent = follow?.text || question.prompt;
    byId('voice-hint').textContent = voice.canListen ?
      'Habla o escribe con tus propias palabras. Si dictas, puedes corregir la transcripción antes de enviarla.' :
      'El dictado no está disponible en este navegador. Escribe tu respuesta.';
    notice('');
    title.focus();
    readQuestion();
  }

  function readQuestion() {
    if (!voice.canSpeak || view !== 'interview' || !interview || interview.entry) return;
    voice.speak(byId('question-title').textContent);
  }

  function finishInterview() {
    if (interview.entry) return;
    voice.cancel();
    interview.entry = addAttempt(interview.profile, interview.records);
    animateFeedback('acknowledge');
    renderResults();
  }

  function advance(skip = false) {
    if (!interview || interview.entry || listening) return;
    const field = byId('open-answer');
    const text = field.value.trim();
    if (!skip && !text) {
      notice('Escribe o dicta tu respuesta para continuar.');
      field.focus();
      return;
    }
    field.value = '';
    if (!skip) interview.turns.push({prompt: byId('question-title').textContent, text});
    const question = current();
    const answers = interview.turns.map(turn => turn.text);
    const hypothetical = question.group !== 'open';
    const limit = hypothetical ? 1 : openRubric.MAX_FOLLOW_UPS;
    const follow = !skip && interview.followUps.length < limit ?
      openRubric.followUp(interview.profile, answers, interview.followUps.map(item => item.id), {prompt: question.prompt, hypothetical}) : null;
    if (follow) {
      interview.followUps.push(follow);
      animateFeedback('thinking');
      renderQuestion();
      return;
    }
    const assessment = openRubric.assess(interview.profile, answers, question.prompt);
    interview.records.push({question, turns: interview.turns, assessment});
    interview.turns = [];
    interview.followUps = [];
    interview.next++;
    if (current()) renderQuestion();
    else finishInterview();
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
    review.append(element('p', 'Revisa las respuestas y sus evidencias antes de interpretar el puntaje.', 'hint'));
    if (!summary.completed) {
      review.append(element('p', 'Responde todas las preguntas principales para incluir esta entrevista en la comparación.', 'hint'));
    }
    for (const {question, turns, assessment} of interview.records) {
      const item = element('article', null, 'review-item');
      item.append(element('h4', question.skill + ' · ' + assessment.points + '/' + assessment.max));
      for (const turn of turns) {
        item.append(element('p', turn.prompt, 'hint'), element('blockquote', turn.text));
      }
      if (!turns.length) {
        item.append(element('p', question.prompt), element('p', 'Pregunta omitida.', 'hint'));
      } else {
        const list = element('ul', null, 'evidence-list');
        for (const criterion of assessment.criteria) {
          const row = element('li');
          row.append(element('strong', criterion.label), element('span', criterion.evidence || 'Por confirmar en la revisión.'));
          list.append(row);
        }
        item.append(list);
      }
      review.append(item);
    }
  }

  function renderResults() {
    const summary = evaluate.scoreConversation(interview.profile, interview.entry.conversation);
    byId('interview-flow').hidden = true;
    document.body.classList.remove('interview-active');
    byId('results').hidden = false;
    byId('scorecards').replaceChildren(
      scorecard('Evidencia detectada', summary),
      scorecard(groupNames.hard, summary.groups.hard),
      scorecard(groupNames.soft, summary.groups.soft),
      scorecard(groupNames.open, summary.open)
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

  function comparisonTable(profile, list, title, empty, includesOpen, rate = entry =>
    openRubric.combine(evaluate.score(profile, entry.answers || {}), entry.open)) {
    const wrapper = element('section', null, 'review-item');
    wrapper.append(element('h3', title));
    const rows = evaluate.rank(profile, list, rate);
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
    const forRole = attempts.filter(entry => entry.role === profile.id);
    const conversations = forRole.filter(entry => entry.conversation);
    const oldInterviews = forRole.filter(entry => !entry.conversation && openRubric.isSummary(entry.open));
    const oldExercises = forRole.filter(entry => !entry.conversation && !openRubric.isSummary(entry.open));
    report.replaceChildren();
    if (!hasPilot) {
      report.append(comparisonTable(profile, conversations, 'Entrevistas conversacionales', 'Completa una entrevista para este cargo y repítela con otro participante para comparar.', true,
        entry => evaluate.scoreConversation(profile, entry.conversation)));
    }
    if (oldInterviews.length) report.append(comparisonTable(profile, oldInterviews, 'Historial · práctica anterior de 12 puntos', '', true));
    if (oldExercises.length) report.append(comparisonTable(profile, oldExercises, 'Historial · ejercicios de 8 puntos', '', false));
    if (demoVisible) {
      const samples = evaluate.examples(profile).map((entry, index) => ({
        ...entry,
        open: {version: openRubric.VERSION, criteria: {context:true, action:true, result:index<2, verification:false}},
      }));
      report.append(comparisonTable(profile, samples, 'Ejemplos ficticios de la práctica anterior · 12 puntos posibles', '', true));
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
  byId('next').addEventListener('click', () => advance());
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
  byId('hear').addEventListener('click', readQuestion);
  byId('record-answer').disabled = !voice.canListen;
  byId('record-answer').addEventListener('click', () => {
    if (listening) voice.stop();
    else if (interview && !interview.entry && view === 'interview') voice.listen();
  });
  byId('skip-open').addEventListener('click', () => advance(true));

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
