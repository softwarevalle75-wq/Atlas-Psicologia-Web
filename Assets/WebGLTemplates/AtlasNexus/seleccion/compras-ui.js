(function (root) {
  'use strict';

  const rules = root.AtlasComprasPilot;
  const prefix = 'atlas.innovarq.compras.v1:';
  const answerLimit = 2400;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, action, style = 'secondary', id = '') {
    const node = el('button', text, 'button button-' + style);
    node.type = 'button';
    if (id) node.id = id;
    node.addEventListener('click', action);
    return node;
  }

  function group(className, ...children) {
    const node = el('div', null, className);
    node.append(...children);
    return node;
  }

  function field(label, input, id) {
    const title = el('label', label);
    input.id = title.htmlFor = id;
    return group('field', title, input);
  }

  function heading(container) {
    const node = container.querySelector('h2,h3');
    if (node) {
      node.tabIndex = -1;
      node.focus();
    }
  }

  function table(id, title, names) {
    const grid = el('table');
    grid.id = id;
    const head = grid.createTHead().insertRow();
    for (const name of names) {
      const cell = el('th', name);
      cell.scope = 'col';
      head.append(cell);
    }
    const wrap = group('table-scroll', grid);
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', title);
    return {wrap, body: grid.createTBody()};
  }

  function mount({flow, comparison, voice, notice, animate, onExit, onCompare, onExport, onRecordsChanged}) {
    // Session-only entries also preserve a completed interview if browser storage is unavailable.
    const memory = new Map();
    const transient = new Set();
    let step = '';
    let draft = null;
    let caseIndex = 0;
    let probing = false;
    let listening = false;
    let selectedReview = '';
    let selectedCase = rules.cases[0].id;
    let wantStorage = false;
    let storageFailed = false;

    function getEntries() {
      const entries = new Map();
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(prefix)) continue;
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item?.version === rules.version && prefix + item.id === key && typeof item.alias === 'string' &&
                typeof item.created === 'string' && item.answers && item.reviews) entries.set(item.id, item);
          } catch { /* An unreadable local entry does not affect the other interviews. */ }
        }
      } catch { /* Storage may be unavailable in private or restricted browsing. */ }
      for (const [id, entry] of memory) entries.set(id, entry);
      return Array.from(entries.values()).sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
    }

    function save(entry) {
      storageFailed = false;
      if (!transient.has(entry.id)) {
        try {
          localStorage.setItem(prefix + entry.id, JSON.stringify(entry));
          memory.delete(entry.id);
        } catch {
          storageFailed = true;
          memory.set(entry.id, entry);
        }
      } else {
        memory.set(entry.id, entry);
      }
      onRecordsChanged?.();
    }

    function aliasTaken(name, list) {
      return list.some(item => name.localeCompare(item.alias, 'es', {sensitivity: 'base'}) === 0);
    }

    function importEntry(entry) {
      const list = getEntries();
      if (list.some(item => item.id === entry.id) || aliasTaken(entry.alias, list)) return false;
      save(entry);
      renderComparison();
      return true;
    }

    function start() {
      voice.cancel();
      draft = null;
      step = 'setup';
      caseIndex = 0;
      probing = false;
      const alias = el('input');
      alias.type = 'text';
      alias.required = true;
      alias.maxLength = 40;
      alias.autocomplete = 'off';
      alias.spellcheck = false;
      const list = getEntries();
      let number = list.length + 1;
      do {
        alias.value = 'Compras ' + String(number++).padStart(2, '0');
      } while (aliasTaken(alias.value, list));
      const consent = el('input');
      consent.type = 'checkbox';
      consent.id = 'pilot-save-local';
      const consentLabel = el('label', null, 'pilot-consent');
      consentLabel.append(consent, document.createTextNode(' Guardar mis respuestas y su evaluación en este navegador para compararlas después.'));
      const begin = button('Comenzar los tres casos', () => {
        const name = alias.value.trim();
        if (!name || aliasTaken(name, getEntries())) {
          notice(name ? 'Ese alias ya existe. Usa otro para distinguir las entrevistas.' : 'Escribe un alias para esta entrevista.');
          alias.focus();
          return;
        }
        draft = {version:rules.version, id:crypto.randomUUID(), alias:name, created:new Date().toISOString(), answers:{}, reviews:{}};
        wantStorage = consent.checked;
        notice('');
        showCase();
      }, 'primary', 'pilot-start');
      flow.replaceChildren(el('h2', 'Piloto de Compras y Logística'), el('p', 'Resuelve tres situaciones de obra. Cada caso incluye una pregunta y una oportunidad para ampliar tu respuesta.', 'lede'),
        field('Alias de la entrevista', alias, 'pilot-alias'),
        el('p', 'Usa un código sin nombres ni datos de contacto. Las respuestas guardadas quedan disponibles para quien use este perfil del navegador. Sin guardar, duran hasta que cierres o recargues la pestaña.', 'hint'),
        consentLabel, group('actions', begin, button('Volver a los cargos', () => {step = ''; onExit();}, 'text')));
      heading(flow);
    }

    function receiveTranscript(raw) {
      if (step !== 'case') return false;
      const field = flow.querySelector('#pilot-answer');
      field.value = (field.value.trimEnd() + ' ' + raw).trimStart().slice(0, answerLimit);
      return true;
    }

    function setListening(value) {
      listening = value;
      if (step !== 'case') return;
      const record = flow.querySelector('#pilot-record');
      if (!record) return;
      record.textContent = value ? 'Terminar dictado' : 'Responder por voz';
      record.setAttribute('aria-pressed', String(value));
      flow.querySelector('#pilot-next').disabled = value;
      flow.querySelector('#pilot-hear').disabled = value || !voice.canSpeak;
      const skip = flow.querySelector('#pilot-skip');
      if (skip) skip.disabled = value;
    }

    function showCase() {
      step = 'case';
      const item = rules.cases[caseIndex];
      const question = probing ? item.followUp : item.prompt;
      const spoken = probing ? question : item.brief + ' ' + question;
      const answer = el('textarea');
      answer.rows = 5;
      answer.maxLength = answerLimit;
      const hear = button('Escuchar pregunta', () => voice.speak(spoken), 'text', 'pilot-hear');
      const record = button('Responder por voz', () => listening ? voice.stop() : voice.listen(), 'secondary', 'pilot-record');
      record.disabled = !voice.canListen;
      const next = button(probing ? (caseIndex === rules.cases.length - 1 ? 'Terminar entrevista' : 'Siguiente caso') : 'Continuar', () => advance(false), 'primary', 'pilot-next');
      const controls = group('actions', next);
      if (!probing) controls.append(button('Dejar sin respuesta', () => {
        if (answer.value.trim()) { notice('Pulsa Continuar para conservar lo que escribiste.'); return; }
        advance(true);
      }, 'text', 'pilot-skip'));

      flow.replaceChildren(el('p', 'Caso ' + (caseIndex + 1) + ' de ' + rules.cases.length + ' · ' + item.method, 'hint'),
        el('h2', item.title), el('p', item.brief, 'pilot-brief'));
      if (probing) {
        const previous = el('details');
        previous.append(el('summary', 'Tu primera respuesta'), el('blockquote', draft.answers[item.id].main));
        flow.append(previous);
      }
      flow.append(el('h3', question), group('actions', hear, record),
        el('p', voice.canListen ? 'Puedes escribir o dictar y corregir la transcripción. El servicio de voz del navegador puede procesar el audio en línea.' : 'El dictado no está disponible en este navegador. Escribe tu respuesta.', 'hint'),
        field(probing ? 'Ampliación (opcional)' : 'Tu decisión y sus motivos', answer, 'pilot-answer'), controls);
      setListening(listening);
      heading(flow);
      if (voice.canSpeak) voice.speak(spoken);

      function advance(skip) {
        if (listening) return;
        const value = answer.value.trim();
        if (!value && !skip && !probing) {
          notice('Escribe o dicta tu respuesta, o elige dejar el caso sin respuesta.');
          answer.focus();
          return;
        }
        voice.cancel();
        notice('');
        if (!probing) draft.answers[item.id] = {main:value, followUp:''};
        else draft.answers[item.id].followUp = value;
        if (!probing && !skip) {
          probing = true;
          animate('thinking');
          showCase();
        } else if (++caseIndex < rules.cases.length) {
          probing = false;
          showCase();
        } else {
          finish();
        }
      }
    }

    function finish() {
      step = 'done';
      const existing = getEntries();
      const alias = draft.alias;
      let suffix = 2;
      while (aliasTaken(draft.alias, existing)) {
        const tail = ' (' + suffix++ + ')';
        draft.alias = alias.slice(0, 40 - tail.length) + tail;
      }
      if (!wantStorage) transient.add(draft.id);
      save(draft);
      animate('acknowledge');
      const count = Object.values(draft.answers).filter(answer => answer.main).length;
      const summary = draft.alias + ' · ' + count + ' de ' + rules.cases.length + ' casos con respuesta. El reclutador puede revisar la evidencia de cada competencia.';
      const durability = !wantStorage ? 'Puedes volver a Comparar durante esta pestaña. Para llevar tus respuestas a otro equipo o conservarlas al cerrar, descarga esta entrevista.' :
        storageFailed ? 'El navegador bloqueó el guardado. Puedes descargar las respuestas o compararlas mientras siga abierta esta pestaña.' : 'Guardada en este navegador. También puedes descargar las respuestas para compartirlas con el reclutador.';
      const actions = group('actions', button('Ir a comparar entrevistas', () => {
        selectedReview = draft.id;
        step = '';
        onCompare();
      }, 'primary', 'pilot-to-compare'));
      if (onExport) actions.append(button('Descargar esta entrevista', () => onExport(draft), 'secondary', 'pilot-export'));
      actions.append(button('Nueva entrevista', start, 'secondary', 'pilot-new'),
        button('Volver a los cargos', () => {step = ''; onExit();}, 'text'));
      flow.replaceChildren(el('h2', 'Entrevista completada'), el('p', summary), el('p', durability, 'hint'), actions);
      heading(flow);
    }

    function responseTable(entries, container) {
      const item = rules.cases.find(candidate => candidate.id === selectedCase);
      const {wrap, body} = table('pilot-answers-table', 'Respuestas al mismo caso', ['Alias', 'Decisión y motivos', 'Ampliación']);
      for (const entry of entries) {
        const answer = entry.answers[item.id];
        body.insertRow().append(el('th', entry.alias), el('td', answer?.main || 'Sin respuesta'), el('td', answer?.followUp || 'Sin ampliación'));
      }
      container.replaceChildren(el('p', item.prompt, 'hint'), el('p', 'Repregunta · ' + item.followUp, 'hint'), wrap);
    }

    function fillRow(row, entry) {
      row.dataset.pilotAlias = entry.alias;
      row.dataset.pilotId = entry.id;
      const label = el('th', entry.alias);
      label.scope = 'row';
      row.replaceChildren(label);
      for (const skill of rules.summarize(entry.reviews)) {
        const cell = el('td');
        cell.dataset.pilotSkill = skill.id;
        cell.append(el('strong', skill.percent == null ? 'Pendiente' : skill.percent + '%'),
          el('div', (skill.reviewed ? skill.points + '/' + skill.max + ' puntos · ' : '') + skill.reviewed + '/' + skill.total + ' revisados', 'hint'));
        row.append(cell);
      }
    }

    function renderComparison() {
      const entries = getEntries();
      comparison.replaceChildren(el('h2', 'Piloto de Compras y Logística'));
      if (!entries.length) {
        comparison.append(el('p', 'Completa los tres casos del piloto para revisar la evidencia y comparar las respuestas.', 'empty'));
        return;
      }
      comparison.append(el('p', 'Porcentaje de puntos sobre los criterios revisados. La cobertura indica cuántos criterios tienen una valoración respaldada por una cita. Compara porcentajes con la misma cobertura.', 'hint'));
      const {wrap, body} = table('pilot-matrix', 'Estadísticas por competencia', ['Entrevista', ...rules.competencies.map(skill => skill.label)]);
      for (const entry of entries) fillRow(body.insertRow(), entry);
      comparison.append(wrap, el('h3', 'Contrastar las respuestas'));
      const filter = el('select');
      for (const item of rules.cases) filter.add(new Option(item.title, item.id));
      filter.value = selectedCase;
      const responses = el('div', null, 'pilot-comparison');
      filter.addEventListener('change', () => {selectedCase = filter.value; responseTable(entries, responses);});
      comparison.append(field('Caso para comparar', filter, 'pilot-case-filter'), responses);
      responseTable(entries, responses);
      comparison.append(el('h3', 'Revisión del reclutador'));
      const list = el('div', null, 'actions pilot-actions');
      const detail = el('section', null, 'flow pilot-review');
      for (const entry of entries) {
        const open = button(entry.alias, () => {
          selectedReview = entry.id;
          for (const btn of list.querySelectorAll('button')) btn.setAttribute('aria-pressed', String(btn === open));
          renderReview(entry, detail);
          heading(detail);
        });
        open.dataset.reviewPilot = entry.id;
        open.setAttribute('aria-pressed', String(entry.id === selectedReview));
        list.append(open);
      }
      comparison.append(list, detail);
      const selected = entries.find(entry => entry.id === selectedReview);
      if (selected) renderReview(selected, detail);
    }

    function renderReview(entry, detail) {
      detail.replaceChildren(el('h3', 'Evaluación de ' + entry.alias),
        el('p', 'Elige el nivel que corresponda y copia una cita de la respuesta que justifique la valoración. Deja pendiente cualquier criterio sin evidencia suficiente.', 'hint'));
      for (const item of rules.cases) {
        const container = el('section', null, 'review-item flow');
        container.dataset.pilotCaseReview = item.id;
        const answer = entry.answers[item.id] || {};
        container.append(el('h3', item.title), el('p', item.prompt, 'hint'), el('blockquote', answer.main || 'Sin respuesta'),
          el('p', item.followUp, 'hint'), el('blockquote', answer.followUp || 'Sin ampliación'));
        const form = el('form', null, 'flow');
        for (const criterion of item.criteria) {
          const name = rules.competencies.find(skill => skill.id === criterion.competencyId).label;
          const block = el('fieldset', null, 'flow pilot-anchors');
          block.append(el('legend', name));
          const key = item.id + '-' + criterion.competencyId;
          const score = el('select');
          score.dataset.score = criterion.competencyId;
          score.add(new Option('Pendiente de evidencia', ''));
          const anchors = el('ul', null, 'pilot-scale');
          criterion.anchors.forEach((anchor, i) => {
            score.add(new Option(i + ' de 2 puntos', String(i)));
            anchors.append(el('li', i + ' · ' + anchor));
          });
          const rating = entry.reviews?.[item.id]?.[criterion.competencyId];
          score.value = rating?.score == null ? '' : String(rating.score);
          const evidence = el('textarea');
          evidence.dataset.evidence = criterion.competencyId;
          evidence.maxLength = 600;
          evidence.rows = 2;
          evidence.value = rating?.evidence || '';
          evidence.placeholder = 'Fragmento literal de la respuesta';
          block.append(anchors, field('Valoración', score, 'pilot-score-' + key), field('Cita de la respuesta', evidence, 'pilot-evidence-' + key));
          form.append(block);
        }
        const feedback = el('p', '', 'hint');
        feedback.setAttribute('role', 'status');
        const commit = el('button', 'Guardar revisión de este caso', 'button button-primary');
        commit.type = 'submit';
        commit.dataset.saveCase = item.id;
        form.append(group('actions', commit), feedback);
        let previous = {...entry.reviews[item.id]};
        form.addEventListener('submit', event => {
          event.preventDefault();
          const reviewed = {};
          for (const criterion of item.criteria) {
            const key = criterion.competencyId;
            const score = form.querySelector('[data-score="' + key + '"]');
            const evidence = form.querySelector('[data-evidence="' + key + '"]');
            if (score.value === '') continue;
            const quote = evidence.value.trim();
            const normalize = text => text.replace(/\s+/gu, ' ').toLocaleLowerCase('es').trim();
            if (!quote || ![answer.main, answer.followUp].some(raw => raw && normalize(raw).includes(normalize(quote)))) {
              feedback.textContent = 'Copia una cita de la respuesta a este caso para respaldar la valoración.';
              evidence.focus();
              return;
            }
            reviewed[key] = {score:Number(score.value), evidence:quote};
          }
          const fresh = getEntries().find(saved => saved.id === entry.id);
          if (!fresh) {renderComparison(); notice('Esta entrevista ya se eliminó.'); return;}
          const merged = {...fresh.reviews[item.id]};
          for (const {competencyId} of item.criteria) {
            const old = previous[competencyId];
            const next = reviewed[competencyId];
            if (old?.score === next?.score && old?.evidence === next?.evidence) continue;
            if (next) merged[competencyId] = next;
            else delete merged[competencyId];
          }
          fresh.reviews = {...fresh.reviews, [item.id]:merged};
          save(fresh);
          previous = reviewed;
          entry.reviews = fresh.reviews;
          const row = Array.from(comparison.querySelectorAll('#pilot-matrix tr')).find(candidate => candidate.dataset.pilotId === entry.id);
          if (row) fillRow(row, fresh);
          feedback.textContent = storageFailed ? 'Actualizado solo en esta pestaña. El navegador bloqueó el guardado.' : 'Revisión actualizada.';
        });
        container.append(form);
        detail.append(container);
      }
      if (onExport) detail.append(button('Descargar respuestas', () => onExport(entry), 'secondary'));
      detail.append(button('Eliminar esta entrevista', () => {
        if (!root.confirm('¿Eliminar las respuestas y evaluaciones de ' + entry.alias + ' de este navegador?')) return;
        try {
          if (!transient.has(entry.id)) localStorage.removeItem(prefix + entry.id);
        } catch {notice('El navegador impidió eliminar el registro guardado.'); return;}
        memory.delete(entry.id);
        transient.delete(entry.id);
        selectedReview = '';
        onRecordsChanged?.();
        renderComparison();
        heading(comparison);
        notice('Entrevista eliminada.');
      }, 'text'));
    }

    return {start, receiveTranscript, setListening, renderComparison, getEntries, importEntry,
      get storageFailed() {return storageFailed;}, get active() {return step === 'case';}};
  }

  root.AtlasComprasUI = Object.freeze({mount});
})(window);
