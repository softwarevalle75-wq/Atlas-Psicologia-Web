(function () {
  'use strict';

  const profiles = window.AtlasHiringProfiles;
  const evaluate = window.AtlasHiringEvaluation;
  const openRubric = window.AtlasOpenResponse;
  const byId = id => document.getElementById(id);
  const storageKey = 'atlas.innovarq.practice.v1';
  const groupNames = {hard: 'Habilidades técnicas', soft: 'Habilidades interpersonales', open: 'Experiencia aplicada'};
  const profileFor = select => profiles.find(profile => profile.id === byId(select).value) || profiles[0];
  let demoVisible = false;
  let view = 'interview';
  let attempts = readAttempts();
  const office = document.querySelector('.office');
  const officeMode = byId('office-mode');
  let scene;
  if (window.AtlasHiringScene) {
    scene = window.AtlasHiringScene.mount(byId('office-3d'), status => {
      officeMode.textContent = office.dataset.scene === 'fallback' ? status : '';
    });
  }
  const pilotRole = window.AtlasComprasPilot.profileId;
  const pilot = window.AtlasComprasUI.mount({
    comparison: byId('compras-comparison'), notice,
    onExport: entry => window.AtlasComprasArchivo.download(entry),
  });
  window.AtlasComprasArchivo.bindImport(byId('pilot-import'), byId('pilot-import-status'), pilot);
  const interview = window.AtlasVoiceInterview.create({scene, save: saveRecording});

  function saveRecording(session) {
    const download = byId('voice-report-export');
    download.hidden = !session.purchasing;
    if (!session.purchasing) return addAttempt(session.profile, session.records);
    const entry = pilot.recordSession(session.records);
    download.onclick = () => window.AtlasComprasArchivo.download(entry);
    return entry;
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
    const assessed = new Map(records.map(({question, assessment}) => [question.id, assessment]));
    const empty = openRubric.summarize(openRubric.assess(profile, []));
    const evidence = Object.fromEntries(evaluate.conversationQuestions(profile).map(question => [question.id,
      assessed.has(question.id) ? openRubric.summarize(assessed.get(question.id)) : empty]));
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
    interview.close();
    byId('setup').hidden = false;
    view = next;
    if (next !== 'compare') document.body.classList.remove('pilot-report');
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
    byId('setup').hidden = true;
    byId('voice-report-export').hidden = true;
    byId('voice-report-export').onclick = null;
    const profile = profileFor('cargo');
    byId('compare-cargo').value = profile.id;
    void interview.start(profile);
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
  byId('begin-compras').addEventListener('click', startInterview);
  byId('compare-now').addEventListener('click', () => switchView('compare'));
  byId('repeat').addEventListener('click', () => {
    switchView('interview');
    byId(profileFor('cargo').id === pilotRole ? 'begin-compras' : 'begin').focus();
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

  if (new URLSearchParams(window.location.search).get('piloto') === 'compras') {
    for (const id of ['cargo', 'compare-cargo', 'resume-cargo']) byId(id).value = pilotRole;
  }
  showProfile();
  switchView('interview');
})();
