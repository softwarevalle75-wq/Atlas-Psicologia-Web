(function (root) {
  'use strict';

  const PROCESSOR = 'atlas-interview-pcm';
  const PCM_RATE = 16000;
  const FRAME_SAMPLES = PCM_RATE / 50;

  if (typeof root.registerProcessor === 'function') {
    class InterviewPCM extends root.AudioWorkletProcessor {
      constructor() {
        super();
        this.port.onmessage = ({data}) => {
          this.capture = data.capture;
          this.pending = 0;
          this.total = 0;
          this.frames = 0;
          this.frame = new DataView(new ArrayBuffer(FRAME_SAMPLES * 2));
        };
      }

      process(inputs) {
        const channel = inputs[0]?.[0];
        if (!this.capture || !channel) return true;
        // Weighted downsampling preserves phase across render quanta, including 44.1 kHz.
        const width = root.sampleRate / PCM_RATE;
        for (const value of channel) {
          let remaining = 1;
          while (remaining > 1e-9) {
            const portion = Math.min(remaining, width - this.pending);
            this.total += value * portion;
            this.pending += portion;
            remaining -= portion;
            if (this.pending < width - 1e-9) continue;
            const sample = Math.min(1, Math.max(-1, this.total / width));
            this.frame.setInt16(this.frames++ * 2, Math.min(32767, Math.round(sample * 32768)), true);
            this.total = this.pending = 0;
            if (this.frames === FRAME_SAMPLES) {
              const pcm = this.frame.buffer;
              this.port.postMessage({capture: this.capture, pcm}, [pcm]);
              this.frame = new DataView(new ArrayBuffer(FRAME_SAMPLES * 2));
              this.frames = 0;
            }
          }
        }
        return true;
      }
    }
    root.registerProcessor(PROCESSOR, InterviewPCM);
    return;
  }

  const workletUrl = root.document.currentScript?.src;
  const CONNECT_MS = 7500;
  const LISTEN_MS = 90000;
  const FINISH_MS = 5500;
  const PRE_SPEECH_MS = 25000;
  const BROWSER_PAUSE_MS = 2100;
  const MAX_BACKLOG = PCM_RATE * 2;
  const MISSING_RESPONSE = 'No detecté una respuesta. Puedes volver a hablar.';
  const DISCONNECTED = 'Se interrumpió la transcripción. Vuelve a intentar esta respuesta.';
  const PERMISSION = 'Permite el acceso al micrófono en el navegador para seguir.';
  const UNSUPPORTED = 'La transcripción no está disponible en este navegador.';
  const AUDIO = {audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true}, video: false};

  function create({
    connect,
    onPartial = () => {},
    onFinal = () => {},
    onState = () => {},
    onError = () => {},
  } = {}) {
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    const getMedia = root.navigator.mediaDevices?.getUserMedia?.bind(root.navigator.mediaDevices);
    const canStream = Boolean(getMedia) && typeof connect === 'function' && typeof root.WebSocket === 'function' &&
      typeof AudioContext === 'function' && typeof root.AudioWorkletNode === 'function' && Boolean(workletUrl);
    let preferBrowser = !canStream;
    let graph;
    let pending;
    let granted = false;
    let active;
    let epoch = 0;
    let captureId = 0;
    let destroyed = false;

    function release(input) {
      if (!input) return;
      input.stream?.getTracks().forEach(track => track.stop());
      input.source?.disconnect();
      input.node?.disconnect();
      input.node?.port.close();
      if (input.context && input.context.state !== 'closed') void input.context.close().catch(() => {});
    }

    function report(message) {
      onState('unavailable');
      onError(message);
      return false;
    }

    function prepare() {
      if (destroyed) return Promise.resolve(false);
      if (granted) return Promise.resolve(true);
      if (pending) return pending;
      if (root.isSecureContext === false || (!canStream && typeof Recognition !== 'function')) {
        return Promise.resolve(report(UNSUPPORTED));
      }
      const attempt = ++epoch;
      const input = {};
      if (!preferBrowser) {
        try {
          input.context = new AudioContext();
          // Begin resume in the initiating tap, before awaiting permission.
          void input.context.resume().catch(() => {});
        } catch {
          preferBrowser = true;
        }
      }

      pending = (async () => {
        try {
          input.stream = await getMedia?.(AUDIO);
          input.stream?.getAudioTracks().forEach(track => { track.enabled = false; });
          if (attempt !== epoch) return false;
          if (!preferBrowser && input.stream) {
            await input.context.audioWorklet.addModule(workletUrl);
            if (attempt !== epoch) return false;
            input.source = input.context.createMediaStreamSource(input.stream);
            input.node = new root.AudioWorkletNode(input.context, PROCESSOR, {channelCount: 1, outputChannelCount: [1]});
            input.node.port.onmessage = ({data}) => streamAudio(input, data);
            input.source.connect(input.node);
            // The processor writes silence. Connecting to the destination keeps it scheduled.
            input.node.connect(input.context.destination);
            graph = input;
          }
          if (!graph && typeof Recognition !== 'function') return report(UNSUPPORTED);
          granted = true;
          return true;
        } catch (error) {
          if (attempt !== epoch) return false;
          if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return report(PERMISSION);
          if (error?.name === 'NotFoundError' || error?.name === 'NotReadableError') {
            return report('No pude usar el micrófono. Revisa la entrada de audio y vuelve a intentar.');
          }
          if (typeof Recognition === 'function' && input.stream) {
            preferBrowser = true;
            granted = true;
            return true;
          }
          return report(UNSUPPORTED);
        } finally {
          if (graph !== input) release(input);
          if (attempt === epoch) pending = null;
        }
      })();
      return pending;
    }

    function streamAudio(input, {capture, pcm}) {
      const turn = active;
      if (graph !== input || !turn?.streaming || capture !== turn.id || turn.socket.readyState !== 1) return;
      if (turn.socket.bufferedAmount > MAX_BACKLOG) {
        fail(turn, DISCONNECTED);
        return;
      }
      try {
        turn.socket.send(pcm);
      } catch {
        fail(turn, DISCONNECTED);
      }
    }

    function clearTimers(turn) {
      root.clearTimeout(turn.timer);
      root.clearTimeout(turn.pause);
    }

    function stopCapture(turn) {
      if (!turn.streaming) return;
      turn.streaming = false;
      graph?.node.port.postMessage({capture: 0});
      graph?.stream.getAudioTracks().forEach(track => { track.enabled = false; });
    }

    function closeSocket(turn) {
      stopCapture(turn);
      turn.connection.abort();
      const socket = turn.socket;
      turn.socket = null;
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        socket.close();
      }
    }

    function detach(turn) {
      if (active !== turn) return false;
      active = null;
      clearTimers(turn);
      closeSocket(turn);
      if (turn.recognition) {
        const recognizer = turn.recognition;
        recognizer.onstart = recognizer.onend = recognizer.onerror = recognizer.onresult = null;
        recognizer.onspeechstart = recognizer.onspeechend = null;
        try { recognizer.abort(); } catch {}
      }
      onState('idle', turn.engine);
      return true;
    }

    function fail(turn, message) {
      if (detach(turn)) onError(message);
    }

    function complete(turn, rawText) {
      const answer = rawText.trim().slice(0, 10000);
      if (!detach(turn)) return;
      if (answer) onFinal(answer);
      else onError(MISSING_RESPONSE);
    }

    function tryBrowser(turn) {
      if (active !== turn) return;
      clearTimers(turn);
      closeSocket(turn);
      if (typeof Recognition !== 'function') {
        fail(turn, 'La transcripción en directo no está disponible. Vuelve a conectar y prueba de nuevo.');
        return;
      }
      preferBrowser = true;
      release(graph);
      graph = undefined;
      let recognition;
      try {
        recognition = new Recognition();
      } catch {
        fail(turn, UNSUPPORTED);
        return;
      }
      turn.recognition = recognition;
      turn.engine = 'browser';
      recognition.lang = 'es-CO';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { if (active === turn) onState('listening', turn.engine); };
      recognition.onspeechstart = () => {
        turn.speaking = true;
        root.clearTimeout(turn.pause);
      };
      recognition.onspeechend = () => {
        turn.speaking = false;
        scheduleBrowserPause(turn);
      };
      recognition.onresult = event => {
        if (active !== turn) return;
        const live = [];
        const confirmed = [];
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index];
          const phrase = result[0]?.transcript?.trim();
          if (!phrase) continue;
          live.push(phrase);
          if (result.isFinal) confirmed.push(phrase);
        }
        turn.preview = live.join(' ').slice(0, 10000);
        turn.confirmed = confirmed.join(' ').slice(0, 10000);
        onPartial(turn.preview);
        scheduleBrowserPause(turn);
      };
      recognition.onend = () => complete(turn, turn.preview || turn.confirmed || '');
      recognition.onerror = event => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') fail(turn, PERMISSION);
        else if (event.error === 'no-speech') complete(turn, turn.confirmed || '');
        else fail(turn, DISCONNECTED);
      };
      turn.timer = root.setTimeout(() => stop(), PRE_SPEECH_MS);
      try {
        recognition.start();
      } catch {
        fail(turn, 'El navegador no pudo iniciar el dictado. Pulsa «Volver a escuchar».');
      }
    }

    function scheduleBrowserPause(turn) {
      if (active !== turn || turn.finishing || !turn.preview) return;
      root.clearTimeout(turn.timer);
      root.clearTimeout(turn.pause);
      turn.timer = root.setTimeout(() => stop(), Math.max(0, LISTEN_MS - (Date.now() - turn.started)));
      if (!turn.speaking) turn.pause = root.setTimeout(() => stop(), BROWSER_PAUSE_MS);
    }

    async function useSocket(turn) {
      try {
        const endpoint = await connect(turn.connection.signal);
        if (active !== turn || turn.connection.signal.aborted) return;
        if (!endpoint) {
          tryBrowser(turn);
          return;
        }
        const url = new URL(endpoint.url, root.location.href);
        if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && /^(localhost|127\.0\.0\.1)$/u.test(url.hostname))) {
          throw new Error('WebSocket must use TLS.');
        }
        const token = endpoint.token;
        if (typeof token !== 'string' || !/^[A-Za-z0-9_.-]{1,8192}$/u.test(token)) throw new Error('Invalid voice pass.');
        const socket = new root.WebSocket(url.href, ['atlas-interview-v1', 'auth.' + token]);
        turn.socket = socket;
        const lost = () => {
          if (active !== turn || turn.socket !== socket) return;
          if (turn.ready) fail(turn, DISCONNECTED);
          else tryBrowser(turn);
        };
        socket.onclose = socket.onerror = lost;
        socket.onmessage = async ({data}) => {
          if (active !== turn || turn.socket !== socket || typeof data !== 'string' || data.length > 64 * 1024) return;
          let event;
          try { event = JSON.parse(data); } catch { return; }
          if (event?.type === 'ready' && !turn.ready) {
            try {
              await graph.context.resume();
            } catch {
              lost();
              return;
            }
            if (active !== turn || turn.socket !== socket || turn.ready) return;
            root.clearTimeout(turn.timer);
            turn.ready = true;
            turn.streaming = true;
            graph.stream.getAudioTracks().forEach(track => { track.enabled = true; });
            graph.node.port.postMessage({capture: turn.id});
            turn.timer = root.setTimeout(() => stop(), PRE_SPEECH_MS);
            onState('listening', turn.engine);
          } else if (event?.type === 'partial' && turn.ready && typeof event.text === 'string') {
            if (!turn.receivedWords && event.text.trim() && !turn.finishing) {
              turn.receivedWords = true;
              root.clearTimeout(turn.timer);
              turn.timer = root.setTimeout(() => stop(), Math.max(0, LISTEN_MS - (Date.now() - turn.started)));
            }
            turn.preview = event.text.slice(0, 10000);
            onPartial(turn.preview);
          } else if (event?.type === 'final' && turn.ready && typeof event.text === 'string') {
            complete(turn, event.text);
          } else if (event?.type === 'error') {
            lost();
          }
        };
      } catch {
        if (active === turn && !turn.connection.signal.aborted) tryBrowser(turn);
      }
    }

    function start() {
      if (destroyed || active || !granted) return false;
      const turn = {id: ++captureId, connection: new AbortController(), started: Date.now(), preview: '', engine: 'deepgram'};
      active = turn;
      onState('connecting', preferBrowser || !graph ? 'browser' : turn.engine);
      if (preferBrowser || !graph) tryBrowser(turn);
      else {
        turn.timer = root.setTimeout(() => tryBrowser(turn), CONNECT_MS);
        void useSocket(turn);
      }
      return true;
    }

    function stop() {
      const turn = active;
      if (!turn || turn.finishing) return false;
      if (!turn.ready && !turn.recognition) {
        fail(turn, MISSING_RESPONSE);
        return true;
      }
      turn.finishing = true;
      clearTimers(turn);
      stopCapture(turn);
      onState('finishing', turn.engine);
      turn.timer = root.setTimeout(() => {
        if (turn.recognition) complete(turn, turn.preview || turn.confirmed || '');
        else fail(turn, turn.preview ? DISCONNECTED : MISSING_RESPONSE);
      }, FINISH_MS);
      try {
        if (turn.recognition) turn.recognition.stop();
        else turn.socket.send(JSON.stringify({type: 'end'}));
      } catch {
        fail(turn, DISCONNECTED);
      }
      return true;
    }

    function cancel() {
      ++epoch;
      pending = null;
      granted = false;
      if (active) detach(active);
      release(graph);
      graph = undefined;
      preferBrowser = !canStream;
    }

    function pauseWhenHidden() {
      if (root.document.visibilityState === 'hidden') cancel();
    }

    function destroy() {
      destroyed = true;
      cancel();
      root.removeEventListener('pagehide', cancel);
      root.document.removeEventListener('visibilitychange', pauseWhenHidden);
    }

    root.addEventListener('pagehide', cancel);
    root.document.addEventListener('visibilitychange', pauseWhenHidden);
    return Object.freeze({prepare, start, stop, cancel, destroy});
  }

  root.AtlasInterviewMic = Object.freeze({create});
})(globalThis);
