(function () {
  'use strict';

  const profiles = window.AtlasHiringProfiles;
  const evaluate = window.AtlasHiringEvaluation;
  const byId = id => document.getElementById(id);
  const storageKey = 'atlas.innovarq.practice.v1';
  const groupNames = {hard: 'Habilidades técnicas', soft: 'Habilidades interpersonales'};
  const profileFor = select => profiles.find(profile => profile.id === byId(select).value) || profiles[0];
  let interview;
  let demoVisible = false;
  let view = 'interview';
  let attempts = readAttempts();

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

  function addAttempt(profile, answers) {
    const saved = readAttempts();
    if (saved.length) attempts = saved;
    const max = attempts.reduce((number, item) => Math.max(number, Number(item.name.slice(10)) || 0), 0);
    const entry = {name: 'Candidato ' + String(max + 1).padStart(2, '0'), role: profile.id, answers: {...answers}};
    attempts = [...attempts, entry].slice(-100);
    try {
      localStorage.setItem(storageKey, JSON.stringify(attempts));
    } catch {
      notice('El navegador bloqueó el guardado. Puedes comparar los resultados en esta pestaña.');
    }
    return entry;
  }

  function switchView(next) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    view = next;
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
    const meta = byId('profile-meta');
    meta.replaceChildren(
      element('p', profile.objective),
      element('p', 'Formación · ' + profile.education, 'hint'),
      element('p', 'Experiencia · ' + profile.experience, 'hint')
    );
  }

  function startInterview() {
    interview = {profile: profileFor('cargo'), next: 0, answers: Object.create(null), open: '', entry: null};
    byId('setup').hidden = true;
    byId('results').hidden = true;
    byId('interview-flow').hidden = false;
    byId('open-answer').value = '';
    renderQuestion();
  }

  function current() {
    return interview.profile.questions[interview.next];
  }

  function renderQuestion() {
    const {profile, next} = interview;
    const question = current();
    const title = byId('question-title');
    byId('question-step').textContent = 'Pregunta ' + (next + 1) + ' de ' + (profile.questions.length + 1);
    byId('question-skill').textContent = question ? groupNames[question.group] + ' · ' + question.skill : 'Respuesta abierta';
    title.textContent = question?.prompt || profile.open.prompt;
    byId('next').textContent = question ? 'Continuar' : 'Ver resultados';
    byId('open-area').hidden = !!question;
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
        label.append(radio, element('span', option.text));
        wrapper.append(label);
      });
    }
    notice('');
    title.focus();
  }

  function advance() {
    if (!interview || interview.entry) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
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
      renderQuestion();
      return;
    }
    interview.open = byId('open-answer').value.trim();
    interview.entry = addAttempt(interview.profile, interview.answers);
    renderResults();
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
    open.append(element('h4', 'Respuesta abierta'), element('p', interview.profile.open.prompt));
    if (interview.open) {
      open.append(element('blockquote', interview.open));
      const anchors = element('ol');
      interview.profile.open.anchors.forEach(anchor => anchors.append(element('li', anchor)));
      const assessment = element('select');
      assessment.id = 'open-review-rating';
      assessment.append(new Option('Por revisar', ''));
      interview.profile.open.anchors.forEach((_, index) => assessment.append(new Option('Nivel ' + (index + 1), String(index + 1))));
      const assessmentNote = element('p', 'La comparación usa las preguntas comunes puntuables.', 'hint');
      assessment.addEventListener('change', () => {
        assessmentNote.textContent = assessment.value
          ? 'Nivel ' + assessment.value + ' seleccionado para esta revisión.'
          : 'La comparación usa las preguntas comunes puntuables.';
      });
      const assessmentLabel = element('label', 'Valoración del evaluador');
      assessmentLabel.htmlFor = assessment.id;
      open.append(anchors, assessmentLabel, assessment, assessmentNote);
    } else {
      open.append(element('p', 'La respuesta abierta quedó sin evidencia. Puedes retomarla en otra práctica.', 'hint'));
    }
    review.append(open);
  }

  function renderResults() {
    const summary = evaluate.score(interview.profile, interview.answers);
    byId('interview-flow').hidden = true;
    byId('results').hidden = false;
    byId('scorecards').replaceChildren(
      scorecard('Resultado de la práctica', summary),
      scorecard(groupNames.hard, summary.groups.hard),
      scorecard(groupNames.soft, summary.groups.soft)
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

  function comparisonTable(profile, list, title, empty) {
    const wrapper = element('section', null, 'review-item');
    wrapper.append(element('h3', title));
    const rows = evaluate.rank(profile, list);
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
    for (const label of ['N.º', 'Perfil', 'Técnicas', 'Blandas', 'Total']) {
      const cell = element('th', label);
      cell.scope = 'col';
      if (label === 'N.º') cell.setAttribute('aria-label', 'Posición en la práctica');
      head.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const text of [row.position, row.entry.name, row.score.groups.hard.percent + '%', row.score.groups.soft.percent + '%', row.score.percent + '%']) {
        tr.append(element('td', text));
      }
    }
    scroll.append(table);
    wrapper.append(scroll);
    return wrapper;
  }

  function renderComparison() {
    const profile = profileFor('compare-cargo');
    const report = byId('comparison');
    report.replaceChildren(comparisonTable(profile, attempts, 'Entrevistas en este dispositivo', 'Completa una entrevista para este cargo y repítela con otro participante para comparar.'));
    if (demoVisible) report.append(comparisonTable(profile, evaluate.examples(profile), 'Ejemplos ficticios', 'Sin ejemplos.'));
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
  byId('hear').disabled = !('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  byId('hear').addEventListener('click', () => {
    if (!interview || view !== 'interview') return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(byId('question-title').textContent);
    message.lang = 'es-CO';
    message.onend = () => notice('');
    message.onerror = event => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') notice('El navegador no pudo leer la pregunta. Puedes responder con el texto en pantalla.');
    };
    window.speechSynthesis.speak(message);
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
  window.addEventListener('pagehide', () => window.speechSynthesis?.cancel());

  showProfile();
  switchView('interview');
})();
