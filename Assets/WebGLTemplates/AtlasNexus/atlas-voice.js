/* LiveKit browser transport. Provider credentials remain on the Atlas server. */
(function(){
'use strict';const connections=new Map(),decoder=new TextDecoder();let volume=1,epoch=0;
function unity(receiver,payload,c){if(!window.unityInstance||c.closed)return;payload._epoch=c.epoch;window.unityInstance.SendMessage(receiver,'ReceiveWeb',JSON.stringify(payload));}
function quiet(c,value){c.muted=value;for(const audio of c.elements)audio.muted=value;}
async function close(receiver){const c=connections.get(receiver);if(!c)return;c.closed=true;connections.delete(receiver);clearInterval(c.hello);clearInterval(c.meter);clearTimeout(c.flush);for(const pending of c.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Connection closed'));}c.pending.clear();for(const meter of c.analysers){try{meter.source.disconnect();meter.analyser.disconnect();meter.silent.disconnect();}catch{}}for(const audio of c.elements){audio.pause();audio.srcObject=null;audio.remove();}try{await c.room.disconnect(true);}catch{}}
function rpc(receiver,c,method,data){return new Promise((resolve,reject)=>{if(c.closed||!c.agent||data.callerIdentity!==c.agent){reject(new Error('Agent not authorized'));return;}const id=crypto.randomUUID();const timer=setTimeout(()=>{c.pending.delete(id);reject(new Error('Unity action timed out'));},Math.min(12000,data.responseTimeout||10000));c.pending.set(id,{resolve,reject,timer});unity(receiver,{type:'__rpc',id,method,payload:data.payload,_sender:data.callerIdentity},c);});}
async function open(receiver,config){
 const generation=epoch;
 if(window.AtlasApp?.sceneVoiceAllowed?.()===false)return;
 window.AtlasApp?.voiceError?.('');await close(receiver);
 if(epoch!==generation||window.AtlasApp?.sceneVoiceAllowed?.()===false)return;
 const LK=window.LivekitClient;if(!LK){throw new Error('LiveKit SDK not loaded');}
 const capture=window.AtlasMicrophone?.captureOptions?.()||{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1};
 const room=new LK.Room({adaptiveStream:false,dynacast:false,audioCaptureDefaults:capture});
 const c={room,epoch:config._epoch,mode:config.mode,closed:false,elements:[],pending:new Map(),analysers:[],agent:'',muted:false,hello:0,meter:0};connections.set(receiver,c);
 room.on(LK.RoomEvent.DataReceived,(bytes,participant,kind,topic)=>{if(c.closed||topic!=='atlas.event'||!participant||bytes.byteLength>15000||c.agent&&participant.identity!==c.agent)return;try{const value=JSON.parse(decoder.decode(bytes));c.agent=participant.identity;value._sender=participant.identity;if(value.type==='ready')clearInterval(c.hello);if(value.type==='agent_state'&&value.state==='speaking')quiet(c,false);unity(receiver,value,c);}catch{}});
 room.on(LK.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
  if(track.kind!==LK.Track.Kind.Audio||c.closed||c.agent&&participant.identity!==c.agent||c.audioTracks?.has(track))return;c.agent=participant.identity;
  if(!c.audioTracks)c.audioTracks=new Set();c.audioTracks.add(track);
  const audio=track.attach();audio.volume=volume;audio.muted=c.muted;audio.autoplay=true;audio.style.display='none';document.body.appendChild(audio);c.elements.push(audio);audio.play().catch(()=>window.AtlasApp?.error('Pulsa Hablar o Comenzar para habilitar el audio.'));
  try{
   const context=window.AtlasAudioContext||(window.AtlasAudioContext=new AudioContext());const source=context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])),analyser=context.createAnalyser(),silent=context.createGain();analyser.fftSize=512;silent.gain.value=0;source.connect(analyser);analyser.connect(silent);silent.connect(context.destination);c.analysers.push({source,analyser,silent,data:new Float32Array(analyser.fftSize)});
  }catch{}
 });
 room.on(LK.RoomEvent.Disconnected,()=>{if(!c.closed)unity(receiver,{type:'__error'},c);});
 room.localParticipant.registerRpcMethod('atlas.context',data=>rpc(receiver,c,'atlas.context',data));room.localParticipant.registerRpcMethod('atlas.execute',data=>rpc(receiver,c,'atlas.execute',data));
 let stage='connection';
 try{
  await room.connect(config.url,config.token,{autoSubscribe:true});if(c.closed)return;
  await room.startAudio();if(c.closed)return;
  stage='microphone';await room.localParticipant.setMicrophoneEnabled(true,capture);
  if(c.closed){await room.disconnect(true);return;}
  if(c.mode==='patient')await mic(c,false);
  if(c.closed)return;
  const hello=()=>room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({type:'hello'})),{reliable:true,topic:'atlas.control'}).catch(()=>{});
  hello();c.hello=setInterval(hello,1000);c.meter=setInterval(()=>{let sum=0,n=0;for(const m of c.analysers){m.analyser.getFloatTimeDomainData(m.data);for(const value of m.data){sum+=value*value;n++;}}const rms=n?Math.sqrt(sum/n):0;const level=c.muted?0:Math.sqrt(Math.max(0,Math.min(1,(rms-.0015)*12)));unity(receiver,{type:'__level',level},c);},50);
 }catch(error){if(!c.closed){window.AtlasApp?.voiceError?.(stage==='microphone'?(window.AtlasMicrophone?.describeError(error)||'Revisa el permiso del micrófono.'):'No se pudo conectar con el servicio de voz. Comprueba la red y vuelve a intentarlo.');unity(receiver,{type:'__error'},c);await close(receiver);}}
}
async function mic(c,enabled){const publication=c.room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone);if(!publication?.track)return;if(enabled)await publication.track.unmute();else await publication.track.mute();}
async function send(receiver,value){
 const c=connections.get(receiver);if(!c||c.closed)return;
 try{
  if(value.type==='ptt_start'){clearTimeout(c.flush);quiet(c,true);await mic(c,true);}
  if(value.type==='interrupt')quiet(c,true);
  await c.room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(value)),{reliable:true,topic:'atlas.control'});
  if(value.type==='ptt_end'&&c.mode==='patient')c.flush=setTimeout(()=>mic(c,false).catch(()=>{}),180);
 }catch{unity(receiver,{type:'__error'},c);}
}
window.AtlasVoice={setInputDevice:async id=>{for(const c of connections.values())if(!c.closed)await c.room.switchActiveDevice('audioinput',id||'default');},open:(r,c)=>open(r,c).catch(()=>{}),close,send,mute:(r,value)=>{const c=connections.get(r);if(c)quiet(c,value);},resolve:(receiver,id,payload,error)=>{const c=connections.get(receiver),pending=c?.pending.get(id);if(!pending)return;clearTimeout(pending.timer);c.pending.delete(id);if(error)pending.reject(new Error(payload));else pending.resolve(payload);},setVolume:value=>{volume=Math.max(0,Math.min(1,value));for(const c of connections.values())for(const e of c.elements)e.volume=volume;},closeAll:()=>{epoch++;return Promise.all([...connections.keys()].map(close));}};
window.addEventListener('pagehide',()=>window.AtlasVoice.closeAll());document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const c of connections.values()){mic(c,false).catch(()=>{});quiet(c,true);}});
})();
