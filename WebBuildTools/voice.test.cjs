'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
test('Volver al menú descarta aperturas de voz tardías y evita reabrir el micro',async()=>{
 const f=fixture();let allowed=true;f.window.AtlasApp.sceneVoiceAllowed=()=>allowed;
 const pending=f.voice.open('Atlas',{mode:'atlas',_epoch:1});allowed=false;await f.voice.closeAll();await pending;
 assert.equal(f.rooms.length,0);
 await f.voice.open('Patient',{mode:'patient',_epoch:2});assert.equal(f.rooms.length,0);
});
function fixture(){
 const rooms=[],messages=[],intervals=new Set(),timeouts=new Set(),listeners={},elements=[];
 class Room {
  constructor(options){rooms.push(this);this.captureOptions=options.audioCaptureDefaults;this.handlers={};this.micMuted=false;this.sent=[];this.track={mute:async()=>{this.micMuted=true;},unmute:async()=>{this.micMuted=false;}};this.localParticipant={registerRpcMethod:(n,f)=>this.handlers[n]=f,setMicrophoneEnabled:async()=>{},getTrackPublication:()=>({track:this.track}),publishData:async(bytes)=>{this.sent.push(JSON.parse(new TextDecoder().decode(bytes)));}};}
  on(event,handler){this.handlers[event]=handler;return this;}async switchActiveDevice(kind,id){this.inputSwitch=[kind,id];}async connect(){}async startAudio(){}async disconnect(){this.disconnected=true;}
 }
 const window={addEventListener:(n,f)=>listeners[n]=f,unityInstance:{SendMessage:(r,m,v)=>messages.push({r,m,value:JSON.parse(v)})},AtlasApp:{error:message=>messages.push({error:message})}};
 const document={hidden:false,addEventListener:(n,f)=>listeners[n]=f,body:{appendChild:e=>elements.push(e)}};
 const ctx={window,document,LivekitClient:{Room,RoomEvent:{DataReceived:'data',TrackSubscribed:'track',Disconnected:'disconnected'},Track:{Kind:{Audio:'audio'},Source:{Microphone:'mic'}}},TextDecoder,TextEncoder,Float32Array,Map,crypto:{randomUUID},console,
 setInterval:(f)=>{intervals.add(f);return f;},clearInterval:f=>intervals.delete(f),setTimeout:(f)=>{timeouts.add(f);return f;},clearTimeout:f=>timeouts.delete(f)};
 window.LivekitClient=ctx.LivekitClient;vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../Assets/WebGLTemplates/AtlasNexus/atlas-voice.js'),'utf8'),ctx);
 const audio=()=>({volume:1,muted:false,style:{},play:async()=>{},pause(){this.paused=true;},remove(){this.removed=true;}});
 return {window,voice:window.AtlasVoice,rooms,messages,intervals,timeouts,listeners,document,elements,audio};
}
test('Paciente usa PTT, recibe una sola pista y elimina el audio al cerrar',async()=>{
 const f=fixture();await f.voice.open('Patient',{mode:'patient',url:'wss://fixture',token:'fixture',_epoch:7});const room=f.rooms[0];assert.equal(room.micMuted,true);
 room.handlers.data(new TextEncoder().encode('{"type":"ready"}'),{identity:'agent'},null,'atlas.event');
 const audio=f.audio(),track={kind:'audio',attach:()=>audio};room.handlers.track(track,{},{identity:'agent'});room.handlers.track(track,{},{identity:'agent'});assert.equal(f.elements.length,1);
 await f.voice.send('Patient',{type:'ptt_start'});assert.equal(room.micMuted,false);assert.equal(audio.muted,true);
 await f.voice.send('Patient',{type:'ptt_end'});for(const fn of [...f.timeouts])await fn();assert.equal(room.micMuted,true);
 room.handlers.data(new TextEncoder().encode('{"type":"agent_state","state":"speaking"}'),{identity:'agent'},null,'atlas.event');assert.equal(audio.muted,false);
 assert.ok(f.messages.every(m=>m.value?m.value._epoch===7:true));await f.voice.closeAll();assert.equal(room.disconnected,true);assert.equal(audio.removed,true);assert.equal(f.intervals.size,0);
});
test('RPC solo acepta al agente vinculado y devuelve la respuesta de Unity',async()=>{
 const f=fixture();await f.voice.open('Atlas',{mode:'atlas',_epoch:1});const room=f.rooms[0];
 room.handlers.data(new TextEncoder().encode('{"type":"ready"}'),{identity:'trusted'},null,'atlas.event');
 await assert.rejects(room.handlers['atlas.execute']({callerIdentity:'stranger',payload:'{}'}),/not authorized/);
 const response=room.handlers['atlas.context']({callerIdentity:'trusted',payload:'{}'});const request=f.messages.at(-1).value;assert.equal(request.type,'__rpc');f.voice.resolve('Atlas',request.id,'{"part":"corazon"}',false);assert.equal(await response,'{"part":"corazon"}');await f.voice.closeAll();
});
test('Reconectar cierra la sesión anterior; ocultar la pestaña silencia el micro',async()=>{
 const f=fixture();await f.voice.open('Atlas',{mode:'atlas',_epoch:1});const previous=f.rooms[0];await f.voice.open('Atlas',{mode:'atlas',_epoch:2});assert.equal(previous.disconnected,true);
 f.document.hidden=true;f.listeners.visibilitychange();await Promise.resolve();assert.equal(f.rooms[1].micMuted,true);await f.voice.closeAll();assert.equal(f.intervals.size,0);
});
test('Both roles use the selected microphone and can switch inputs without changing voice output',async()=>{
 const f=fixture();f.window.AtlasMicrophone={captureOptions:()=>({deviceId:{exact:'physical-headset'},echoCancellation:true})};
 await f.voice.open('Atlas',{mode:'atlas',_epoch:1});await f.voice.open('Patient',{mode:'patient',_epoch:2});
 for(const room of f.rooms)assert.equal(room.captureOptions.deviceId.exact,'physical-headset');
 await f.voice.setInputDevice('other-headset');for(const room of f.rooms)assert.deepEqual(room.inputSwitch,['audioinput','other-headset']);
 await f.voice.closeAll();
});
