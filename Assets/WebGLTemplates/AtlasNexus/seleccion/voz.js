(function (root) {
  'use strict';

  const REQUEST_MS = 35000;
  const AUDIO_HZ = 24000;
  const MAX_PCM_BYTES = 4000000;
  const DEFAULT_API = 'https://api.oscar-vr.iudcdesarrollo.tech/api/v1/atlas';
  const SPEECH_ERROR = 'La voz de ElevenLabs no está disponible en este momento. Puedes leer la pregunta o tocar «Escuchar pregunta» para reintentar.';
  const ENABLE_AUDIO = 'Toca «Escuchar pregunta» para habilitar la reproducción en este navegador.';

  function decodeSpeech(context, encoded) {
    if (typeof encoded !== 'string' || !encoded.length || encoded.length > Math.ceil(MAX_PCM_BYTES / 3) * 4) {
      throw new Error(SPEECH_ERROR);
    }
    const pcm = root.atob(encoded);
    if (!pcm.length || pcm.length % 2 || pcm.length > MAX_PCM_BYTES) throw new Error(SPEECH_ERROR);
    const clip = context.createBuffer(1, pcm.length / 2, AUDIO_HZ);
    const samples = clip.getChannelData(0);
    for (let j = 0; j < samples.length; j++) {
      const offset = j * 2;
      const word = pcm.charCodeAt(offset) | (pcm.charCodeAt(offset + 1) << 8);
      samples[j] = (word < 32768 ? word : word - 65536) / 32768;
    }
    return clip;
  }

  function create({onStatus = () => {}, onSpeaking = () => {}, onSpeechLevel} = {}) {
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    const canSpeak = typeof AudioContext === 'function' && typeof root.fetch === 'function' &&
      typeof root.AbortController === 'function' && root.isSecureContext !== false;
    const apiBase = (root.ATLAS_CONFIG?.apiBaseUrl || DEFAULT_API).replace(/\/$/, '');
    let speech = null;
    let voicePass = null;
    let lastAudio = null;
    let context = null;

    function finishSpeech(result = 'cancelled') {
      const turn = speech;
      if (!turn) return;
      speech = null;
      root.clearTimeout(turn.timeout);
      if (turn.levelTimer) root.clearInterval(turn.levelTimer);
      turn.controller.abort();
      if (turn.source) {
        turn.source.onended = null;
        try { turn.source.stop(); } catch {}
        turn.source.disconnect();
      }
      turn.analyser?.disconnect();
      if (turn.playing) onSpeaking(false);
      if (turn.levelTimer) onSpeechLevel?.(0);
      for (const resolve of turn.waiters) resolve(result);
    }

    function failSpeech(turn, message) {
      if (speech !== turn) return;
      finishSpeech('unavailable');
      onStatus(message);
    }

    function post(route, payload, signal, token) {
      const headers = {'Content-Type': 'application/json'};
      if (token) headers.Authorization = 'Bearer ' + token;
      return root.fetch(apiBase + route, {
        method: 'POST', headers, body: JSON.stringify(payload),
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
      });
    }

    function serviceError(response) {
      if (response.status === 429) return new Error('La voz pública alcanzó su límite temporal. Puedes seguir con el texto y reintentar más tarde.');
      if (response.status === 403) return new Error('La voz pública no está habilitada para esta dirección. Puedes seguir con el texto.');
      return new Error(SPEECH_ERROR);
    }

    async function getPass(signal) {
      if (voicePass && voicePass.expiresAt > Date.now() + 3000) return voicePass.accessToken;
      const response = await post('/web/public-session', {}, signal);
      if (!response.ok) throw serviceError(response);
      const ticket = await response.json();
      if (ticket?.type !== 'atlas:session' || ticket.version !== 1 ||
          typeof ticket.accessToken !== 'string' || ticket.accessToken.length < 32 ||
          ticket.accessToken.length > 8192 || !Number.isFinite(ticket.expiresAt) ||
          ticket.expiresAt <= Date.now() || signal.aborted) {
        throw new Error(SPEECH_ERROR);
      }
      voicePass = ticket;
      return ticket.accessToken;
    }

    async function loadAudio(turn) {
      if (lastAudio?.text === turn.text) return lastAudio.clip;
      const signal = turn.controller.signal;
      const payload = {text: turn.text};
      const token = await getPass(signal);
      let response = await post('/speech', payload, signal, token);
      if (response.status === 401 && !signal.aborted) {
        voicePass = null;
        response = await post('/speech', payload, signal, await getPass(signal));
      }
      if (!response.ok) throw serviceError(response);
      const audio = await response.json();
      if (speech !== turn) return null;
      if (!audio?.voice_profile?.startsWith('elevenlabs-')) throw new Error(SPEECH_ERROR);
      const clip = decodeSpeech(context, audio.audio_pcm);
      lastAudio = {text: turn.text, clip};
      return clip;
    }

    async function playQuestion(turn, resumed) {
      try {
        const clip = await loadAudio(turn);
        if (speech !== turn) return;
        if (context.state !== 'running') {
          let unlockTimer;
          await Promise.race([resumed, new Promise(resolve => {
            unlockTimer = root.setTimeout(resolve, 1200);
          })]);
          root.clearTimeout(unlockTimer);
          if (speech !== turn) return;
          if (context.state !== 'running') {
            failSpeech(turn, ENABLE_AUDIO);
            return;
          }
        }
        const source = context.createBufferSource();
        turn.source = source;
        source.buffer = clip;
        if (onSpeechLevel && context.createAnalyser) {
          const analyser = context.createAnalyser();
          analyser.fftSize = 128;
          const data = new Float32Array(analyser.fftSize);
          source.connect(analyser);
          analyser.connect(context.destination);
          turn.analyser = analyser;
          turn.levelTimer = root.setInterval(() => {
            analyser.getFloatTimeDomainData(data);
            let squares = 0;
            for (const value of data) squares += value * value;
            onSpeechLevel(Math.min(1, Math.sqrt(squares / data.length) * 5));
          }, 60);
        } else source.connect(context.destination);
        source.onended = () => {
          if (speech === turn) finishSpeech('finished');
        };
        source.start();
        turn.playing = true;
        root.clearTimeout(turn.timeout);
        turn.timeout = root.setTimeout(() => {
          if (speech === turn) finishSpeech('unavailable');
        }, Math.ceil(clip.duration * 1000) + 3000);
        onSpeaking(true);
        onStatus('');
      } catch (error) {
        const messages = [SPEECH_ERROR, 'La voz pública alcanzó su límite temporal.', 'La voz pública no está habilitada para esta dirección.'];
        failSpeech(turn, messages.some(message => error?.message?.startsWith(message)) ? error.message : SPEECH_ERROR);
      }
    }

    function unlock() {
      if (!canSpeak) return Promise.resolve();
      context ||= new AudioContext();
      return context.state === 'running' ? Promise.resolve() : context.resume().catch(() => {});
    }

    function speak(text, complete) {
      const question = String(text || '').trim().replace(/\s+/g, ' ');
      if (!question || question.length > 1600) return false;
      if (!canSpeak) {
        onStatus('La lectura en voz alta no está disponible. La pregunta está en pantalla.');
        return false;
      }
      let resumed;
      try {
        // Resume inside the initiating tap, before waiting for ElevenLabs.
        resumed = unlock();
      } catch {
        onStatus(ENABLE_AUDIO);
        return false;
      }
      if (speech?.text === question && !speech.playing) {
        if (complete) speech.waiters.push(complete);
        return true;
      }
      finishSpeech();
      const turn = {text: question, controller: new root.AbortController(), source: null, timeout: 0,
        playing: false, waiters:complete ? [complete] : []};
      speech = turn;
      turn.timeout = root.setTimeout(() => failSpeech(turn, SPEECH_ERROR), REQUEST_MS);
      if (lastAudio?.text !== question) onStatus('Preparando la voz del entrevistador…');
      void playQuestion(turn, resumed);
      return true;
    }

    function speakAndWait(text) {
      return new Promise(resolve => { if (!speak(text,resolve)) resolve('unavailable'); });
    }

    function cancel() {
      finishSpeech();
      lastAudio = null;
    }

    root.addEventListener('pagehide', cancel);
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.visibilityState === 'hidden') cancel();
    });
    return Object.freeze({canSpeak, speak, speakAndWait, unlock, cancel});
  }

  root.AtlasHiringVoice = Object.freeze({create});
})(window);
