
(function (root) {
  'use strict';

  const compras = root.AtlasComprasPilot;
  const rubric = root.AtlasOpenResponse;
  const api = (root.ATLAS_CONFIG?.apiBaseUrl || 'https://api.oscar-vr.iudcdesarrollo.tech/api/v1/atlas').replace(/\/$/, '');
  const byId = id => document.getElementById(id);
  const label = (tag, text, style) => Object.assign(document.createElement(tag), {textContent: text, className: style || ''});
  function timecode(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return Math.floor(seconds / 60).toString().padStart(2,'0') + ':' + (seconds % 60).toString().padStart(2,'0');
  }
  const criterionLabels = Object.fromEntries([
    ['context','Situación y restricciones'], ['action','Decisión y acción'],
    ['result','Resultado esperado'], ['verification','Evidencia y verificación'],
    ...compras.competencies.map(item => [item.id,item.label]),
  ]);

  function create({scene, save}) {
    let current;
    let pass;
    let unsupported = false;
    let phase = 'idle';
    let meter;
    const view = byId('interview-flow');
    const status = byId('voice-interview-status');
    const subtitle = byId('voice-interview-caption');
    const question = byId('question-title');
    const report = byId('voice-report');
    const retry = byId('voice-interview-retry');
    const voice = root.AtlasHiringVoice.create({
      onStatus: value => { if (current && value) status.textContent = value; },
      onSpeaking: active => {
        if (current && phase === 'speaking' && active) status.textContent = 'El entrevistador está hablando';
      },
      onSpeechLevel: value => scene?.setSpeechLevel?.(value),
    });
    const mic = root.AtlasInterviewMic.create({
      connect: async signal => {
        if (unsupported) return null;
        const token = await access(signal);
        return {url: api.replace(/^http/, 'ws') + '/interview/listen', token};
      },
      onPartial: text => {
        if (!current || phase !== 'listening') return;
        subtitle.textContent = text;
        subtitle.scrollTop = subtitle.scrollHeight;
      },
      onFinal: text => { if (current && phase === 'listening') void answer(current, text); },
      onState: (state, engine) => {
        if (!current || phase !== 'listening') return;
        if (state === 'connecting') status.textContent = 'Conectando el micrófono…';
        if (state === 'listening') {
          status.textContent = 'Te escucho';
          byId('voice-interview-engine').textContent = engine === 'deepgram' ? 'Transcripción en directo · Deepgram' : 'Transcripción en directo · navegador';
        }
        if (state === 'finishing') status.textContent = 'Completando la transcripción…';
      },
      onError: message => {
        if (!current || phase !== 'listening') return;
        if (current.finishAfterTurn) void finish();
        else showRetry(message, 'Activar micrófono', listen);
      },
    });

    function setPhase(next, text) {
      phase = next;
      view.dataset.phase = next;
      status.textContent = text;
      const modes = {speaking:'talking', listening:'listening', thinking:'thinking', ready:'idle', done:'acknowledge'};
      scene?.setMode(modes[next] || 'idle');
      const office = document.querySelector('.office');
      if (office) office.dataset.activity = modes[next] || 'idle';
      byId('office-mode').textContent = next === 'speaking' ? 'Entrevistador hablando' : next === 'listening' ? 'Micrófono activo' : next === 'thinking' ? 'Preparando respuesta' : '';
      byId('voice-interview-stop').hidden = next !== 'listening';
      byId('voice-interview-repeat').disabled = !['speaking','listening','ready'].includes(next);
      byId('voice-interview-finish').disabled = next === 'thinking' && Boolean(current?.finishing);
      retry.hidden = true;
    }

    async function request(path, body, parent, token) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (parent.aborted) abort();
      else parent.addEventListener('abort', abort, {once:true});
      const timeout = setTimeout(abort, 22000);
      const headers = {'Content-Type': 'application/json'};
      if (token) headers.Authorization = 'Bearer ' + token;
      try {
        const response = await fetch(api + path, {method:'POST',headers,body:JSON.stringify(body),
          signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
        return {status:response.status, data:response.ok ? await response.json() : null};
      } finally {
        clearTimeout(timeout);
        parent.removeEventListener('abort', abort);
      }
    }

    async function access(signal, renew = false) {
      if (!renew && pass?.expiresAt > Date.now() + 4000) return pass.accessToken;
      const {data} = await request('/web/public-session',{},signal);
      if (data?.type !== 'atlas:session' || data.version !== 1 || !Number.isFinite(data.expiresAt) ||
          typeof data.accessToken !== 'string' || data.accessToken.length < 32 || data.accessToken.length > 8192) {
        throw Error('Pase de voz inválido.');
      }
      pass = data;
      return data.accessToken;
    }

    async function remote(session, operation, caseId, transcript) {
      if (unsupported) return null;
      try {
        const signal = session.controller.signal;
        const body = {case_id:caseId,operation,transcript};
        let response = await request('/interview/turn',body,signal,await access(signal));
        if (response.status === 401) response = await request('/interview/turn',body,signal,await access(signal,true));
        if (response.status === 404 || response.status === 405) unsupported = true;
        return response.data;
      } catch {
        return null;
      }
    }

    function showRetry(message, button, next) {
      setPhase('ready', message || 'Puedes reanudar la entrevista.');
      retry.textContent = button;
      retry.onclick = next;
      retry.hidden = false;
    }

    async function listen() {
      const session = current;
      if (!session || session.finishing || session.paused) return;
      setPhase('listening','Activando el micrófono…');
      subtitle.textContent = '';
      try {
        if (!session.prepared) session.prepared = await mic.prepare() !== false;
        if (current !== session || phase !== 'listening') return;
        if (!session.prepared || mic.start() === false) {
          showRetry('Autoriza el micrófono para responder en voz alta.', 'Activar micrófono', listen);
        }
      } catch {
        if (current === session) {
          showRetry('El navegador no pudo usar el micrófono.', 'Activar micrófono', listen);
        }
      }
    }

    async function speak(session, text) {
      if (session.paused) return;
      mic.stop();
      setPhase('speaking','El entrevistador está preparando la voz…');
      // A question may be replayed during an earlier playback. Only the newest playback opens the microphone.
      const playback = ++session.playback;
      const result = await voice.speakAndWait(text);
      if (current !== session || playback !== session.playback || session.finishing) return;
      if (result === 'finished') void listen();
      else showRetry('La pregunta está en pantalla. Puedes volver a escucharla o activar el micrófono.', 'Activar micrófono', listen);
    }

    function ask(session, prompt, opening = false) {
      const item = session.items[session.index];
      const initial = session.turns.length === 0;
      const full = [
        opening ? 'Hola, soy tu entrevistador. Responde en voz alta al terminar mi pregunta. Empecemos.' : '',
        initial ? item.brief : '',
        prompt,
      ].filter(Boolean).join(' ');
      session.question = prompt;
      session.spoken = full;
      const number = session.index + 1;
      byId('question-step').textContent = (session.purchasing ? 'Caso ' : 'Pregunta ') + number + ' de ' + session.items.length;
      byId('question-skill').textContent = item.title || item.skill;
      const details = byId('voice-case');
      details.hidden = !item.brief;
      byId('voice-case-detail').textContent = item.brief || '';
      details.open = false;
      question.textContent = prompt;
      subtitle.textContent = '';
      void speak(session,full);
    }

    async function start(profile) {
      close();
      unsupported = false;
      const purchasing = profile.id === compras.profileId;
      const session = {
        profile,purchasing,items:purchasing ? compras.cases : root.AtlasHiringEvaluation.conversationQuestions(profile),
        index:0,turns:[],records:[],all:[],started:Date.now(),controller:new AbortController(),playback:0,prepared:false,finishing:false
      };
      current = session;
      document.body.classList.add('interview-active','voice-session-active');
      view.hidden = false;
      report.hidden = true;
      byId('voice-interview-panel').hidden = false;
      byId('voice-role-name').textContent = profile.title;
      byId('voice-interview-engine').textContent = '';
      byId('voice-interview-time').textContent = '00:00';
      meter = setInterval(() => {
        byId('voice-interview-time').textContent = timecode(Date.now()-session.started);
      },1000);
      setPhase('ready','Preparando la entrevista…');
      try { void voice.unlock(); } catch {}
      try { session.prepared = await mic.prepare() !== false; } catch {}
      if (current === session && !session.finishing) {
        ask(session,session.items[0].prompt,true);
        question.scrollIntoView?.({block:'nearest'});
      }
    }

    function transcripts(turns, includeCases) {
      return turns.map(({question,answer,case_id}) => includeCases ? {question,answer,case_id} : {question,answer});
    }

    async function answer(session, value) {
      const text = String(value || '').trim().slice(0,2400);
      if (session.finishing) return;
      const command = text.toLowerCase().replace(/[.!?¡¿]+$/gu,'').replace(/^[¡¿]+/u,'');
      if (/^(?:terminar|finalizar)(?: la)? entrevista$/u.test(command)) { void finish(); return; }
      if (command === 'repite la pregunta' && !session.finishAfterTurn) {
        void speak(session,session.spoken);
        return;
      }
      if (!/\p{L}{2}/u.test(text)) {
        if (session.finishAfterTurn) void finish();
        else showRetry('No se detectó una respuesta. Puedes intentarlo de nuevo.', 'Volver a hablar', listen);
        return;
      }
      const item = session.items[session.index];
      const entry = {case_id:item.id,question:session.question,answer:text};
      session.turns.push(entry);
      session.all.push(entry);
      subtitle.textContent = text;
      if (session.finishAfterTurn) { void finish(); return; }
      setPhase('thinking','Formulando la siguiente pregunta…');
      if (session.turns.length === 1) {
        const remoteCase = session.purchasing ? item.id : session.profile.id;
        const result = await remote(session,'next',remoteCase,transcripts(session.turns,false));
        if (current !== session || session.finishing) return;
        const spoken = typeof result?.question === 'string' ? result.question.trim() : '';
        const next = spoken.length > 3 && spoken.length <= 290 ? spoken : localFollowUp(session,item);
        if (next) { ask(session,next); return; }
      }
      saveCase(session);
      if (++session.index < session.items.length) ask(session,session.items[session.index].prompt);
      else void finish();
    }

    function localFollowUp(session,item) {
      const answer = session.turns[0].answer;
      if (session.purchasing) return compras.nextQuestion(item,answer);
      return rubric.followUp(session.profile,[answer],[],{prompt:item.prompt,hypothetical:item.group!=='open'})?.text;
    }

    function saveCase(session) {
      if (!session.turns.length) return;
      const item = session.items[session.index];
      session.records.push({question:item,turns:session.turns.map(turn => ({prompt:turn.question,text:turn.answer})),
        assessment:rubric.assess(session.profile,session.turns.map(turn => turn.answer),item.prompt)});
      session.turns = [];
    }

    function reportCriteria(session, evaluation) {
      const ids = session.purchasing ? compras.competencies.map(criterion => criterion.id) : ['context','action','result','verification'];
      const criteria = Array.isArray(evaluation?.criteria) ? evaluation.criteria : [];
      return ids.map(id => {
        const row = criteria.find(criterion=>criterion?.id===id);
        const quotes = Array.isArray(row?.evidence) ? row.evidence.filter(item =>
          item && Number.isInteger(item.turn) && typeof item.quote === 'string' && item.quote.trim().length > 2 &&
          session.all[item.turn]?.answer.includes(item.quote)).slice(0,3) : [];
        return {id, score:quotes.length && Number.isInteger(row.score) && row.score >= 0 && row.score <= 2 ? row.score : null,
          evidence:quotes, feedback:typeof row?.feedback==='string' ? row.feedback.slice(0,450) : ''};
      });
    }

    async function finish() {
      const session = current;
      if (!session || session.finishing) return;
      session.finishing = true;
      ++session.playback;
      voice.cancel();
      mic.cancel();
      clearInterval(meter);
      session.elapsed = Date.now() - session.started;
      saveCase(session);
      setPhase('thinking','Preparando el informe por competencias…');
      const evaluation = session.all.length ? await remote(session,'evaluate',session.profile.id,transcripts(session.all,session.purchasing)) : null;
      if (current !== session) return;
      renderReport(session,evaluation);
      session.saved = session.all.length ? save(session) : null;
    }

    function renderReport(session,evaluation) {
      const rows = reportCriteria(session,evaluation);
      const rated = rows.filter(row => row.score !== null);
      const score = rated.length ? Math.round(50*rated.reduce((sum,row)=>sum+row.score,0)/rated.length) : null;
      setPhase('done','Entrevista terminada');
      byId('voice-interview-panel').hidden = true;
      report.hidden = false;
      const summary = byId('voice-report-summary');
      const hasEvaluation = Array.isArray(evaluation?.criteria);
      summary.textContent = hasEvaluation ? String(evaluation.summary || '').slice(0,720) :
        session.all.length ? 'Se registró la conversación. La evaluación automática está temporalmente indisponible.' : 'No se registró una intervención para evaluar.';
      byId('voice-report-next').textContent = hasEvaluation ? String(evaluation.next_step || '').slice(0,450) : '';
      byId('voice-report-score').textContent = score === null ? '—' : score + '%';
      byId('voice-report-ring').style.setProperty('--score', (score ?? 0) + '%');
      const responses = session.records.length;
      byId('voice-report-coverage').textContent = responses + ' de ' + session.items.length + ' situaciones respondidas · ' +
        rated.length + ' de ' + rows.length + ' criterios con evidencia · ' + timecode(session.elapsed);
      const cards = byId('voice-report-criteria');
      cards.replaceChildren(...rows.map(row=>{
        const card = label('article','','voice-criterion');
        card.append(label('h3',criterionLabels[row.id]),label('strong',row.score===null?'Sin evidencia puntuable':(row.score*50)+'%'));
        if (row.score !== null) {
          const progress = document.createElement('progress');
          progress.max = 2;
          progress.value = row.score;
          progress.setAttribute('aria-label',criterionLabels[row.id]);
          card.append(progress);
        }
        if (row.feedback) card.append(label('p',row.feedback));
        for (const item of row.evidence) card.append(label('blockquote',item.quote));
        return card;
      }));
      const turns = byId('voice-report-transcript');
      turns.replaceChildren(...session.all.map(turn=>{
        const article = label('article','','voice-criterion');
        article.append(label('h3',turn.question), label('p',turn.answer));
        return article;
      }));
      byId('voice-report-heading').focus({preventScroll:true});
      report.scrollIntoView?.({block:'start'});
    }

    function close() {
      if (current) current.controller.abort();
      current = null;
      clearInterval(meter);
      voice.cancel();
      mic.cancel();
      phase = 'idle';
      view.hidden = true;
      document.body.classList.remove('interview-active','voice-session-active');
      scene?.setMode('idle');
      const office = document.querySelector('.office');
      if (office) office.dataset.activity = 'idle';
      byId('office-mode').textContent = '';
      report.hidden = true;
      byId('voice-report-transcript').replaceChildren();
      retry.onclick = null;
    }

    byId('voice-interview-stop').addEventListener('click', () => {
      if (phase === 'listening') mic.stop();
    });
    byId('voice-interview-repeat').addEventListener('click', () => {
      if (!current || !current.spoken) return;
      current.paused = false;
      phase = 'speaking';
      mic.cancel();
      current.prepared = false;
      void speak(current,current.spoken);
    });
    byId('voice-interview-finish').addEventListener('click', () => {
      if (!current || current.finishAfterTurn) return;
      if (phase === 'listening') {
        current.finishAfterTurn = true;
        byId('voice-interview-repeat').disabled = true;
        byId('voice-interview-finish').disabled = true;
        if (mic.stop()) return;
      }
      void finish();
    });
    root.addEventListener('pagehide',close);
    document.addEventListener('visibilitychange', () => {
      if (!current || document.visibilityState !== 'hidden' || current.finishing) return;
      current.paused = true;
      ++current.playback;
      phase = 'ready';
      mic.cancel();
      current.prepared = false;
      voice.cancel();
      showRetry('La entrevista se pausó. Puedes retomar la pregunta.', 'Retomar entrevista', () => {
        if (!current?.spoken) return;
        current.paused = false;
        void speak(current,current.spoken);
      });
    });

    return {start,close,get record(){return current?.saved;}};
  }

  root.AtlasVoiceInterview = Object.freeze({create});
})(window);
