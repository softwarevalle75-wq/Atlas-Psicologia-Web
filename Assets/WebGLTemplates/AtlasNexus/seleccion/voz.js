(function (root) {
  'use strict';

  const LANGUAGE = 'es-CO';
  const MAX_LISTEN_MS = 110000;
  const FINALIZE_MS = 8000;
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
  const SPEECH_ERROR = 'El navegador no pudo leer la pregunta. Puedes seguir con el texto en pantalla.';

  function create({onTranscript = () => {}, onStatus = () => {},
    onSpeaking = () => {}, onListening = () => {}} = {}) {
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    const synthesis = root.speechSynthesis;
    const canListen = typeof Recognition === 'function' && root.isSecureContext !== false;
    const canSpeak = Boolean(synthesis && typeof root.SpeechSynthesisUtterance === 'function');
    let microphone = null;
    let utterance = null;
    let reading = false;

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
      finishSpeech(true);

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

    function finishSpeech(cancel = false) {
      const previous = utterance;
      if (!previous) return;
      utterance = null;
      root.clearTimeout(previous.timeout);
      if (cancel) synthesis.cancel();
      if (reading) {
        reading = false;
        onSpeaking(false);
      }
    }

    function speak(text) {
      const question = String(text || '').trim();
      if (!question) return false;
      if (!canSpeak) {
        onStatus('La lectura en voz alta no está disponible. La pregunta está en pantalla.');
        return false;
      }
      if (microphone) finishMicrophone(microphone, '', true);
      finishSpeech(true);

      const readingTurn = {message: new root.SpeechSynthesisUtterance(question), timeout: 0};
      const message = readingTurn.message;
      const voices = synthesis.getVoices().filter(voice => /^es(?:[-_]|$)/i.test(voice.lang));
      const voice = voices.find(voice => /^es[-_]CO$/i.test(voice.lang) && voice.localService) ||
        voices.find(voice => /^es[-_]CO$/i.test(voice.lang)) ||
        voices.find(voice => voice.localService) || voices[0];
      message.lang = voice?.lang || LANGUAGE;
      if (voice) message.voice = voice;
      message.rate = 0.96;

      utterance = readingTurn;
      const fail = () => {
        if (utterance !== readingTurn) return;
        finishSpeech(true);
        onStatus(SPEECH_ERROR);
      };
      message.onstart = () => {
        if (utterance !== readingTurn) return;
        root.clearTimeout(readingTurn.timeout);
        readingTurn.timeout = root.setTimeout(fail, Math.max(15000, question.length * 180));
        reading = true;
        onSpeaking(true);
      };
      message.onend = () => {
        if (utterance === readingTurn) finishSpeech();
      };
      message.onerror = event => {
        if (utterance !== readingTurn) return;
        if (event.error === 'canceled' || event.error === 'interrupted') finishSpeech();
        else fail();
      };

      readingTurn.timeout = root.setTimeout(fail, 8000);
      try {
        synthesis.speak(message);
      } catch {
        fail();
        return false;
      }
      return true;
    }

    function cancel() {
      if (microphone) finishMicrophone(microphone, '', true);
      finishSpeech(true);
    }

    root.addEventListener('pagehide', cancel);
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.visibilityState === 'hidden') cancel();
    });
    return Object.freeze({canListen, canSpeak, listen, stop, speak, cancel});
  }

  root.AtlasHiringVoice = Object.freeze({create});
})(window);
