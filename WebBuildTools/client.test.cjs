'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const dir=path.resolve(__dirname,'../Assets/WebGLTemplates/AtlasNexus');
function fixture(t,mobile=false,options={}){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.github.io/Atlas/'+(options.hash||''),runScripts:'outside-only'}),w=dom.window;
 t.after(()=>w.close());w.matchMedia=()=>({matches:mobile});w.structuredClone=structuredClone;w.requestAnimationFrame=f=>f();
 const sent=[],unity=[];const host={postMessage:(value,origin)=>sent.push({value,origin})};if(!options.topLevel)Object.defineProperty(w,'parent',{value:host});w.fetch=options.fetch;w.AbortSignal=AbortSignal;
 w.ATLAS_CONFIG={apiBaseUrl:'https://api.example/api/v1/atlas',nexusOrigins:['https://nexus.example']};
 w.eval(fs.readFileSync(path.join(dir,'atlas-client.js'),'utf8'));w.AtlasApp.bind({SendMessage:(target,method,payload)=>unity.push({target,method,value:JSON.parse(payload)})});w.AtlasApp.ready('AtlasWeb');
 const session=(profileId='student-a')=>({type:'atlas:session',version:1,accessToken:'fixture-not-a-real-credential-xxxxxxxx',profileId,expiresAt:Date.now()+600000});
 return {w,host,sent,unity,session,post:(data,origin='https://nexus.example',source=host)=>w.dispatchEvent(new w.MessageEvent('message',{data,origin,source}))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Carga sin configuración adicional y no hace solicitudes de autenticación',async t=>{
 const f=fixture(t);await assert.rejects(f.w.AtlasApp.api('/livekit/session',{}),/desde Nexus/);
 assert.equal(f.unity.at(-1).value.profileKey,'practice');assert.equal(f.unity.at(-1).value.accessToken,'');assert.equal(f.w.document.getElementById('qr-dialog'),null);
});
test('Rechaza mensajes de otros dominios o ventanas',async t=>{
 const f=fixture(t);f.post(f.session(),'https://stranger.example');f.post(f.session(),'https://nexus.example',f.w);await tick();assert.equal(f.unity.at(-1).value.accessToken,'');
 f.post(f.session());await tick();assert.equal(f.unity.at(-1).value.profileKey,'student-a');assert.ok(f.unity.at(-1).value.accessToken.length>32);
});
test('Los perfiles quedan separados y el token nunca se guarda en almacenamiento',async t=>{
 const f=fixture(t);await f.w.AtlasApp.connect(f.session());f.w.AtlasApp.save({schemaVersion:1,missions:['neuro.0'],flags:{},poses:[]});
 await f.w.AtlasApp.connect(f.session('student-b'));assert.deepEqual(Array.from(f.unity.at(-1).value.checkpoint.missions),[]);
 await f.w.AtlasApp.connect(f.session());assert.deepEqual(Array.from(f.unity.at(-1).value.checkpoint.missions),['neuro.0']);
 for(let i=0;i<f.w.localStorage.length;i++)assert.ok(!f.w.localStorage.getItem(f.w.localStorage.key(i)).includes('fixture-not-a-real-credential'));
 assert.equal(f.w.sessionStorage.length,0);await f.w.AtlasApp.logout();assert.equal(f.unity.at(-1).value.accessToken,'');
});
test('Una confirmación de progreso ajena no se presenta como guardada por Nexus',async t=>{
 const f=fixture(t);await f.w.AtlasApp.connect(f.session());f.post({type:'atlas:progress-ack',version:1,profileId:'student-b'});assert.notEqual(f.w.document.getElementById('sync').textContent,'Nexus confirmó la recepción del avance');
 f.post({type:'atlas:progress-ack',version:1,profileId:'student-a'});assert.equal(f.w.document.getElementById('sync').textContent,'Nexus confirmó la recepción del avance');
});
test('Sin sesión muestra la causa real y no presenta captura de voz activa',async t=>{
 const f=fixture(t);f.w.AtlasApp.receive({ready:true,landing:false,status:'Sin conexión · reintento en 8 s',talk:true,systems:[],cases:[]});
 assert.match(f.w.document.getElementById('speech-status').textContent,/IA sin sesión de Nexus/);
 assert.equal(f.w.document.getElementById('talk').textContent,'Probar micrófono');assert.equal(f.w.document.getElementById('talk').classList.contains('recording'),false);
 assert.equal(f.w.document.querySelector('[data-op="listen"]').disabled,true);
 let tests=0;f.w.AtlasMicrophone={test:()=>tests++,isTesting:()=>false};f.w.document.getElementById('talk').dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
 assert.equal(tests,1);assert.ok(!f.unity.some(m=>m.method==='ReceiveInput'&&m.value.talk===true));
 await f.w.AtlasApp.connect(f.session());f.w.AtlasApp.receive({ready:true,landing:false,status:'Escuchando con LiveKit',talk:false,systems:[],cases:[]});
 assert.equal(f.w.document.getElementById('speech-status').textContent,'Escuchando con LiveKit');assert.equal(f.w.document.querySelector('[data-op="listen"]').disabled,false);
});

test('Celular conserva el panel elegido, abre las fichas y libera los gestos al entrar a la entrevista',t=>{
 const {w,unity}=fixture(t,true),doc=w.document,get=id=>doc.getElementById(id);
 const receive=patch=>w.AtlasApp.receive({ready:true,landing:false,vr:false,patientOpen:false,systems:[],cases:[],...patch});
 receive({landing:true});receive({});
 assert.equal(get('panel').hidden,true);
 assert.equal(get('touch-studybar').hidden,false);
 assert.equal(get('joystick').hidden,true);
 assert.deepEqual(unity.filter(x=>x.method==='TouchGesture').map(x=>x.value.kind),['enable']);
 get('menu-toggle').click();receive({});assert.equal(get('panel').hidden,false);
 doc.querySelector('.study-grid [data-study="heart"]').click();
 assert.deepEqual(unity.at(-1).value,{op:'study',target:'heart'});assert.equal(get('panel').hidden,true);
 receive({study:'heart',part:{name:'Ventrículo izquierdo'}});
 assert.equal(doc.querySelector('#touch-studybar [data-study="heart"]').getAttribute('aria-pressed'),'true');
 assert.match(get('touch-fact').textContent,/Ventrículo izquierdo/);
 get('part').scrollIntoView=()=>{};get('touch-fact').click();assert.equal(get('panel').hidden,false);
 receive({patientOpen:true});assert.equal(get('touch-studybar').hidden,true);assert.equal(get('joystick').hidden,false);
 receive({});assert.equal(get('panel').hidden,true);assert.equal(get('joystick').hidden,true);
 assert.equal(unity.filter(x=>x.method==='TouchGesture'&&x.value.kind==='enable').length,2);
});
function privatePass(overrides={}){
 const claims={role:'atlas_web',aud:'atlas-web',profile_id:'qa-voice',origin:'https://example.github.io',exp:Math.floor(Date.now()/1000)+600,...overrides};
 return 'fixture.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.testsignature';
}
test('An access link clears the fragment and only enables voice after the server validates it',async t=>{
 const token=privatePass();
 let finish;
 const f=fixture(t,true,{hash:'#atlas_voice='+token,topLevel:true,fetch:(url,options)=>{
  assert.equal(url,'https://api.example/api/v1/atlas/health');
  assert.equal(options.headers.Authorization,'Bearer '+token);
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'error');
  return new Promise(resolve=>{finish=resolve;});
 }});
 assert.equal(f.w.location.hash,'');
 assert.equal(f.w.document.getElementById('talk').textContent,'Probar micrófono');
 finish({ok:true,status:200,json:async()=>({ready:true,livekit:{enabled:true},tts_configured:true})});
 await tick();
 assert.equal(f.w.document.getElementById('talk').textContent,'Mantén para hablar');
 assert.equal(f.unity.at(-1).value.profileKey,'qa-voice');
 for(let i=0;i<f.w.localStorage.length;i++)assert.ok(!f.w.localStorage.getItem(f.w.localStorage.key(i)).includes(token));
 assert.equal(f.w.sessionStorage.length,0);
});
test('Access links reject app tokens, another origin, expired tokens, and embedded usage',async t=>{
 let calls=0;
 for(const [token,topLevel] of [[privatePass({role:'app'}),true],[privatePass({origin:'https://different.example'}),true],[privatePass({exp:0}),true],[privatePass(),false]]){
  const f=fixture(t,true,{hash:'#atlas_voice='+token,topLevel,fetch:async()=>{calls++;}});
  await tick();
  assert.equal(f.w.location.hash,'');
  assert.equal(f.w.document.getElementById('talk').textContent,'Probar micrófono');
 }
 assert.equal(calls,0);
});
test('A rejected access link or unavailable LiveKit cannot enable voice',async t=>{
 for(const health of [{ok:false,status:401},{ok:true,status:200,json:async()=>({ready:true,livekit:{enabled:false}})}]){
  const f=fixture(t,true,{hash:'#atlas_voice='+privatePass(),topLevel:true,fetch:async()=>health});
  await tick();
  assert.equal(f.w.location.hash,'');
  assert.equal(f.w.document.getElementById('talk').textContent,'Probar micrófono');
  assert.match(f.w.document.getElementById('speech-status').textContent,/acceso temporal|no está disponible/);
 }
});
