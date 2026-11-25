(function (root) {
  'use strict';

  const LANGUAGE = 'es-CO';
  const MAX_LISTEN_MS = 110000;
  const FINALIZE_MS = 8000;
  const REQUEST_MS = 35000;
  const AUDIO_HZ = 24000;
  const MAX_PCM_BYTES = 4000000;
  const DEFAULT_API = 'https://api.oscar-vr.iudcdesarrollo.tech/api/v1/atlas';
  const MESSAGES = {
    'no-speech': 'No detecté voz. Vuelve a intentarlo o responde por escrito.',
    'audio-capture': 'El navegador no pudo usar el micrófono. Revisa el dispositivo de entrada o escribe tu respuesta.',
    'not-allowed': 'El permiso del micrófono está bloqueado. Permítelo en el navegador o responde por escrito.',
    'service-not-allowed': 'El navegador no habilitó el reconocimiento de voz. Puedes responder por escrito.',
    'network': 'El reconocimiento de voz perdió la conexión. Puedes intentarlo de nuevo o responder por escrito.',
    'language-not-supported': 'El reconocimiento en español no está disponible en este navegador. Puedes responder por escrito.',
  };
  const READY = 'Transcripción lista. Revísala antes de enviar la respuesta.';
  const EMPTY = 'No se obtuvo una transcripción. Puedes intentarlo de nuevo o responder por escrito.';
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

  function create({onTranscript = () => {}, onStatus = () => {},
    onSpeaking = () => {}, onListening = () => {}} = {}) {
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    const canListen = typeof Recognition === 'function' && root.isSecureContext !== false;
    const canSpeak = typeof AudioContext === 'function' && typeof root.fetch === 'function' &&
      typeof root.AbortController === 'function' && root.isSecureContext !== false;
    const apiBase = (root.ATLAS_CONFIG?.apiBaseUrl || DEFAULT_API).replace(/\/$/, '');
    let microphone = null;
    let speech = null;
    let voicePass = null;
    let lastAudio = null;
    let context = null;

    function finishMicrophone(turn, message, abort = false) {
      if (microphone !== turn) return;
      microphone = null;
      root.clearTimeout(turn.timeout);
      if (abort) {
        try {
          turn.recognition.abort();
        } catch {
          // A recognition service that has already ended cannot be aborted again.
        }
      }
      onListening(false);
      onStatus(message);
    }

    function stop() {
      const turn = microphone;
      if (!turn || turn.finishing) return;
      turn.finishing = true;
      root.clearTimeout(turn.timeout);
      turn.timeout = root.setTimeout(() => finishMicrophone(turn, turn.hasText ? READY : EMPTY, true), FINALIZE_MS);
      onStatus('Terminando la transcripción…');
      try {
        turn.recognition.stop();
      } catch {
        finishMicrophone(turn, turn.hasText ? READY : EMPTY, true);
      }
    }

    function listen() {
      if (!canListen) {
        onStatus('El dictado por micrófono no está disponible en este navegador. Puedes responder por escrito.');
        return false;
      }
      if (microphone) return false;
      finishSpeech();

      let recognition;
      try {
        recognition = new Recognition();
      } catch {
        onStatus(MESSAGES['service-not-allowed']);
        return false;
      }
      recognition.lang = LANGUAGE;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const turn = {recognition, finalIndices: new Set(), hasText: false, finishing: false, timeout: 0};
      microphone = turn;
      recognition.onstart = () => {
        if (microphone === turn && !turn.finishing) onStatus('Te escucho… pulsa Detener al terminar.');
      };
      recognition.onresult = event => {
        if (microphone !== turn) return;
        const final = [];
        const interim = [];
        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
          const result = event.results[i];
          const phrase = result?.[0]?.transcript?.trim();
          if (!phrase) continue;
          if (result.isFinal) {
            if (turn.finalIndices.has(i)) continue;
            turn.finalIndices.add(i);
            final.push(phrase);
          } else {
            interim.push(phrase);
          }
        }
        if (final.length) {
          turn.hasText = true;
          onTranscript(final.join(' '));
        }
        if (microphone !== turn) return;
        if (!turn.finishing && interim.length) {
          onStatus('Escuchando… «' + interim.join(' ').slice(0, 140) + '»');
        } else if (!turn.finishing) {
          onStatus('Transcripción en curso… pulsa Detener al terminar.');
        }
      };
      recognition.onend = () => finishMicrophone(turn, turn.hasText ? READY : EMPTY);
      recognition.onerror = event => {
        const message = event.error === 'aborted' ? (turn.hasText ? READY : EMPTY) :
          (event.error === 'no-speech' && turn.hasText ? READY : (MESSAGES[event.error] || EMPTY));
        finishMicrophone(turn, message);
      };
      recognition.onnomatch = () => {
        if (microphone === turn && !turn.hasText) onStatus('No entendí esa parte. Habla con claridad o escribe tu respuesta.');
      };

      onListening(true);
      onStatus('Activando el micrófono…');
      turn.timeout = root.setTimeout(stop, MAX_LISTEN_MS);
      try {
        recognition.start();
      } catch (error) {
        finishMicrophone(turn, error.name === 'NotAllowedError' ? MESSAGES['not-allowed'] : MESSAGES['service-not-allowed'], true);
        return false;
      }
      return true;
    }

    function finishSpeech() {
      const turn = speech;
      if (!turn) return;
      speech = null;
      root.clearTimeout(turn.timeout);
      turn.controller.abort();
      if (turn.source) {
        turn.source.onended = null;
        try { turn.source.stop(); } catch {}
        turn.source.disconnect();
      }
      if (turn.playing) onSpeaking(false);
    }

    function failSpeech(turn, message) {
      if (speech !== turn) return;
      finishSpeech();
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
        source.connect(context.destination);
        source.onended = () => {
          if (speech === turn) finishSpeech();
        };
        source.start();
        turn.playing = true;
        root.clearTimeout(turn.timeout);
        turn.timeout = root.setTimeout(() => {
          if (speech === turn) finishSpeech();
        }, Math.ceil(clip.duration * 1000) + 3000);
        onSpeaking(true);
        onStatus('');
      } catch (error) {
        const messages = [SPEECH_ERROR, 'La voz pública alcanzó su límite temporal.', 'La voz pública no está habilitada para esta dirección.'];
        failSpeech(turn, messages.some(message => error?.message?.startsWith(message)) ? error.message : SPEECH_ERROR);
      }
    }

    function speak(text) {
      const question = String(text || '').trim().replace(/\s+/g, ' ');
      if (!question || question.length > 1600) return false;
      if (!canSpeak) {
        onStatus('La lectura en voz alta no está disponible. La pregunta está en pantalla.');
        return false;
      }
      let resumed;
      try {
        context ||= new AudioContext();
        // Start resume inside the initiating tap, before waiting for ElevenLabs.
        resumed = context.state === 'running' ? Promise.resolve() : context.resume().catch(() => {});
      } catch {
        onStatus(ENABLE_AUDIO);
        return false;
      }
      if (speech?.text === question && !speech.playing) return true;
      if (microphone) finishMicrophone(microphone, '', true);
      finishSpeech();
      const turn = {text: question, controller: new root.AbortController(), source: null, timeout: 0, playing: false};
      speech = turn;
      turn.timeout = root.setTimeout(() => failSpeech(turn, SPEECH_ERROR), REQUEST_MS);
      if (lastAudio?.text !== question) onStatus('Preparando la voz del entrevistador…');
      void playQuestion(turn, resumed);
      return true;
    }

    function cancel() {
      if (microphone) finishMicrophone(microphone, '', true);
      finishSpeech();
      lastAudio = null;
    }

    root.addEventListener('pagehide', cancel);
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.visibilityState === 'hidden') cancel();
    });
    return Object.freeze({canListen, canSpeak, listen, stop, speak, cancel});
  }

  root.AtlasHiringVoice = Object.freeze({create});
})(window);
