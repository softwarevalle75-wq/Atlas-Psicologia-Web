/* Static Atlas client for GitHub Pages and a Nexus host. No credentials on disk. */
(function(){
'use strict';const $=id=>document.getElementById(id),cfg=window.ATLAS_CONFIG||{};
let unity=null,receiver='',state={},toastTimer=0,firstFrame=false,expectedLanding=null,selectedTab='systems',devPrevious=null;
let voiceFailure='',touch=null,markTimer=0;
let sessionKind='none',testLinkStatus='',validatingTest=false,publicStatus='',guestRequest=null,sessionRevision=0,sceneAction=0;
let homePending=false;
let accessToken='',profile='practice',expiresAt=0,expiryTimer=0,checkpoint=empty();
const hostOrigins=new Set(cfg.nexusOrigins||[]),mobile=matchMedia('(pointer:coarse)').matches,input={moveX:0,moveY:0,lookX:0,lookY:0,x:.5,y:.5,talk:false,typing:false,ui:false};
const text=(id,v)=>{if($(id)&&$(id).textContent!==String(v??''))$(id).textContent=String(v??'');};
function empty(){return {schemaVersion:1,missions:[],milestones:[],flags:{},reports:{},poses:[]};}
function emit(method,payload){if(unity&&receiver)unity.SendMessage(receiver,method,typeof payload==='string'?payload:JSON.stringify(payload));}
function configuration(){return {apiBaseUrl:cfg.apiBaseUrl||'https://api.oscar-vr.iudcdesarrollo.tech/api/v1/atlas',accessToken,profileKey:profile,evaluated:false,checkpoint};}
function hasVoiceSession(){return !!accessToken&&Date.now()<expiresAt;}
function canStartPublic(){return !devPrevious&&!validatingTest;}
function pendingVoiceText(){return testLinkStatus||publicStatus||(devPrevious?'Voz desactivada en el modo de pruebas.':'Activa la voz para conversar con Atlas o María.');}
function voiceUI(){
 const enabled=hasVoiceSession();
 const waiting=!!guestRequest,canActivate=canStartPublic()&&!waiting;
 text('speech-status',enabled?(voiceFailure||state.status||'Conectando con el servicio de voz…'):pendingVoiceText());
 text('voice-state',enabled?(voiceFailure?'Revisa el panel Asistente':state.talk?'Te escucho':state.speaking?(state.patientOpen?'María habla':'Atlas habla'):state.thinking?'Preparando respuesta…':'Mantén para hablar'):pendingVoiceText());
 text('talk',enabled?'Mantén para hablar':waiting?'Activando la voz…':canStartPublic()?'Activar voz':'Probar micrófono');
 const toggle=document.querySelector('[data-op="listen"]');
 toggle.disabled=!enabled&&!canActivate;
 toggle.textContent=enabled?'Activar / detener voz':'Activar voz';
 $('talk').classList.toggle('recording',enabled&&!!state.talk);
 if(!enabled)text('transcript','Cuando la voz esté activa, mantén Hablar mientras haces tu pregunta. También puedes probar el micrófono en este panel.');
}
function configure(withCheckpoint=true){
 const value=configuration();if(!withCheckpoint)delete value.checkpoint;
 emit('Configure',value);voiceUI();
 text('profile-label',devPrevious?'Modo de pruebas':sessionKind==='test'?'Prueba privada · voz habilitada':sessionKind==='nexus'?'Nexus · voz vinculada':'Acceso público');
 text('session-help',testLinkStatus||publicStatus||(sessionKind==='nexus'?'Nexus habilitó la voz de Atlas y María.':'Entra en anatomía o en la entrevista para conversar. El navegador te pedirá permiso para usar el micrófono.'));
 $('logout').hidden=sessionKind!=='nexus'&&sessionKind!=='test';
}
function toast(message){text('toast',message);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function error(message){toast(message);if(!firstFrame)text('loading-text',message);}
function draftKey(){return 'atlas.psicologia.progress.v1.'+profile;}
function readDraft(){try{const v=JSON.parse(localStorage.getItem(draftKey())||'null');return v?.schemaVersion===1?v:empty();}catch{return empty();}}
function notify(type,payload){const message={type,version:1,profileId:profile,...payload};for(const origin of hostOrigins){if(window.parent!==window)window.parent.postMessage(message,origin);if(window.opener)window.opener.postMessage(message,origin);}window.dispatchEvent(new CustomEvent(type,{detail:message}));}
function save(value){if(!value||value.schemaVersion!==1)return;checkpoint=structuredClone(value);try{localStorage.setItem(draftKey(),JSON.stringify(checkpoint));text('sync','Avance guardado en este navegador');}catch{text('sync','No se pudo guardar el avance local');}if(sessionKind==='nexus'&&hasVoiceSession())notify('atlas:progress',{checkpoint});}
function stopPublicRequest(){
 if(guestRequest)guestRequest.controller.abort();
 guestRequest=null;publicStatus='';
}
function ensurePublic(){
 if(hasVoiceSession()||!canStartPublic())return Promise.resolve(hasVoiceSession());
 if(guestRequest)return guestRequest.promise;
 const ticket={controller:new AbortController()};
 const revision=sessionRevision;
 const timer=setTimeout(()=>ticket.controller.abort(),8500);
 guestRequest=ticket;
 testLinkStatus='';publicStatus='Activando la voz pública…';voiceUI();text('session-help',publicStatus);
 ticket.promise=(async()=>{
  try{
   const response=await fetch(configuration().apiBaseUrl.replace(/\/$/,'')+'/web/public-session',{
    method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'omit',cache:'no-store',redirect:'error',signal:ticket.controller.signal});
   if(!response.ok)throw new Error(response.status===429?'La voz pública alcanzó su límite temporal. Vuelve a intentarlo más tarde.':response.status===403?'La voz pública todavía no está habilitada para esta dirección.':'El servicio de voz pública no está disponible. Pulsa Activar voz para reintentar.');
   const value=await response.json();
   if(revision!==sessionRevision||guestRequest!==ticket||!canStartPublic())return hasVoiceSession();
   if(typeof value?.accessToken!=='string'||value.accessToken.length<32||value.accessToken.length>8192||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now())throw new Error('El servicio no entregó un acceso de voz válido. Pulsa Activar voz para reintentar.');
   accessToken=value.accessToken;expiresAt=Math.min(value.expiresAt,Date.now()+3600000);sessionKind='guest';publicStatus='';voiceFailure='';
   clearTimeout(expiryTimer);
   expiryTimer=setTimeout(()=>{
    if(sessionKind!=='guest')return;
    accessToken='';expiresAt=0;sessionKind='none';publicStatus='Terminó el acceso temporal. Pulsa Activar voz para continuar.';
    configure(false);
   },expiresAt-Date.now());
   if(window.AtlasMicrophone?.isTesting())window.AtlasMicrophone.stop('Prueba finalizada al activar la conversación.');
   configure(false);return true;
  }catch(e){
   if(guestRequest===ticket&&revision===sessionRevision)publicStatus=e.name==='TypeError'||e.name==='AbortError'?'No se pudo conectar con la voz pública. Comprueba tu conexión y pulsa Activar voz.':e.message;
   return false;
  }finally{
   clearTimeout(timer);
   if(guestRequest===ticket){guestRequest=null;voiceUI();if(publicStatus)text('session-help',publicStatus);}
  }
 })();return ticket.promise;
}
async function connect(value,source='nexus'){
 if(!value||typeof value.accessToken!=='string'||value.accessToken.length<32||value.accessToken.length>8192||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now())throw new Error('Nexus debe entregar un acceso de voz temporal válido.');
 if(typeof value.profileId!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(value.profileId))throw new Error('Nexus debe entregar un identificador de perfil válido.');
 const revision=++sessionRevision;stopPublicRequest();
 const changed=profile!==value.profileId||sessionKind==='guest';if(changed){save(checkpoint);await window.AtlasVoice?.closeAll();}
 if(revision!==sessionRevision)return;
 if(window.AtlasMicrophone?.isTesting())window.AtlasMicrophone.stop('Prueba finalizada al activar la conversación.');voiceFailure='';
 accessToken=value.accessToken;expiresAt=Math.min(value.expiresAt,Date.now()+3600000);profile=value.profileId;devPrevious=null;
 sessionKind=source;testLinkStatus='';
 checkpoint=value.checkpoint?.schemaVersion===1?structuredClone(value.checkpoint):readDraft();clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{const expiredTest=sessionKind==='test';logout();if(!expiredTest)notify('atlas:session-required',{});toast('Terminó el acceso vinculado. Puedes continuar desde el menú público.');},expiresAt-Date.now());
 if(changed&&unity&&!state.landing)command('home');configure();notify('atlas:connected',{});
}
async function logout(){const revision=++sessionRevision;stopPublicRequest();voiceFailure='';save(checkpoint);clearTimeout(expiryTimer);await window.AtlasVoice?.closeAll();if(revision!==sessionRevision)return;accessToken='';expiresAt=0;sessionKind='none';testLinkStatus='';profile='practice';devPrevious=null;checkpoint=readDraft();if(unity&&!state.landing)command('home');configure();}
async function api(route,payload={}){
 if(!hasVoiceSession())throw new Error('Activa la voz en Atlas para conversar.');
 if(!['/health','/speech','/livekit/session','/patient/feedback'].includes(route))throw new Error('Operación no disponible.');
 const response=await fetch(configuration().apiBaseUrl.replace(/\/$/,'')+route,{method:route==='/health'?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},...(route==='/health'?{}:{body:JSON.stringify(payload)}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)});
 if(!response.ok)throw new Error(response.status===401?'El acceso de voz caducó. Vuelve a activar la voz.':'El servicio de voz no está disponible ('+response.status+').');return response.json();
}
window.addEventListener('message',event=>{
 const trusted=(event.source===window.parent&&window.parent!==window)||(window.opener&&event.source===window.opener);if(!trusted||!hostOrigins.has(event.origin)||!event.data||event.data.version!==1)return;
 if(event.data.type==='atlas:session')connect(event.data).catch(e=>toast(e.message));
 if(event.data.type==='atlas:logout')logout();
 if(event.data.type==='atlas:progress-ack'&&sessionKind==='nexus'&&event.data.profileId===profile)text('sync','Nexus confirmó la recepción del avance');
});
function unlockAudio(){try{const C=window.AudioContext||window.webkitAudioContext;if(!window.AtlasAudioContext)window.AtlasAudioContext=new C();window.AtlasAudioContext.resume().catch(()=>{});}catch{}}
function command(op,extra={}){
 if(!unity||!receiver){toast('Espera a que termine de cargar el laboratorio.');return;}
 if(op==='home'){
  ++sceneAction;homePending=true;stopPublicRequest();resetInput();
  void window.AtlasVoice?.closeAll();window.speechSynthesis?.cancel();
  if(window.AtlasMicrophone?.isTesting())window.AtlasMicrophone.stop('Prueba finalizada al volver al inicio.');
 }
 if(op==='start_atlas'||op==='start_patient')homePending=false;
 const needsSession=['start_atlas','start_patient','patient','listen'].includes(op);
 if(needsSession&&!hasVoiceSession()&&canStartPublic()){
  unlockAudio();
  const action=++sceneAction;
  if(op==='start_atlas'||op==='start_patient')$('scene-loading').hidden=false;
  void ensurePublic().then(enabled=>{
   if(action!==sceneAction||homePending)return;
   if(!enabled&&(op==='start_patient'||op==='patient')){
    $('scene-loading').hidden=true;toast(publicStatus||'Vuelve a pulsar el botón de la entrevista para activar la voz.');return;
   }
   if(!enabled&&op==='listen'){tab('assistant');setPanel(true);voiceUI();return;}
   runCommand(op,extra);
  });
  return;
 }
 if(needsSession&&validatingTest&&!hasVoiceSession()){toast('Espera un momento mientras se valida el pase de voz.');return;}
 if(op==='listen'&&!hasVoiceSession()){tab('assistant');voiceUI();return;}
 runCommand(op,extra);
}
function runCommand(op,extra){
 if(op==='listen'&&window.AtlasMicrophone?.isTesting())window.AtlasMicrophone.stop('Prueba finalizada al activar la conversación.');
 unlockAudio();
 if(op==='start_atlas'||op==='start_patient'||op==='home'){expectedLanding=op==='home';$('scene-loading').hidden=false;setTimeout(()=>{if(expectedLanding!==null){$('scene-loading').hidden=true;expectedLanding=null;toast('La carga está tardando más de lo esperado. Revisa el estado del laboratorio.');}},45000);}
 emit('Command',{op,...extra});
 if(['patient','start_patient','case','finish'].includes(op))tab('patient');
 if(['mission','neuro','tutorial','lesson','exam','time','detective','survival','dissection'].includes(op))tab('learning');
}
function tab(name){selectedTab=name;for(const section of document.querySelectorAll('[data-page]'))section.hidden=section.dataset.page!==name;for(const button of document.querySelectorAll('[data-tab]'))button.classList.toggle('active',button.dataset.tab===name);}
function list(container,values,key,make,update){const parent=$(container),existing=new Map([...parent.children].map(child=>[child.dataset.key,child]));for(const value of values||[]){const id=String(key(value));let item=existing.get(id);if(!item){item=make(value);item.dataset.key=id;parent.appendChild(item);}existing.delete(id);update(item,value);}for(const old of existing.values())old.remove();}
function updateTouchUI(){
 const exploring=mobile&&!state.landing&&!state.vr&&!state.patientOpen&&$('panel').hidden;
 $('touch-studybar').hidden=$('touch-actions').hidden=!exploring;
 const details=$('touch-details');
 let hasDetail=false;
 for(const button of details.children){
  const visible=button.dataset.family.split(' ').includes(state.study)&&button.dataset.study!==state.study;
  button.hidden=!visible;hasDetail=hasDetail||visible;
 }
 details.hidden=!exploring||!hasDetail;
 $('joystick').hidden=!state.patientOpen;
 $('touch-fact').hidden=!state.part;
 if(state.part)text('touch-fact',state.part.name+' · Ficha');
 for(const button of document.querySelectorAll('[data-study]')){const pressed=String(button.dataset.study===state.study);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}
}
function setPanel(open){
 $('panel').dataset.collapsed=String(!open);
 $('panel').hidden=!!state.landing||!open;
 $('menu-toggle').setAttribute('aria-expanded',String(open));
 updateTouchUI();
}
function receive(value){
 if(value.error){error(value.error);return;}const previous=state;state=value;
 if(value.ready&&!firstFrame){firstFrame=true;requestAnimationFrame(()=>requestAnimationFrame(()=>$('loading').hidden=true));notify('atlas:ready',{version:1});}
 if(expectedLanding!==null&&value.landing===expectedLanding&&value.ready){expectedLanding=null;$('scene-loading').hidden=true;}
 document.body.classList.toggle('in-vr',!!value.vr);$('home').hidden=!value.landing;$('panel').hidden=!!value.landing||$('panel').dataset.collapsed==='true';$('voice-dock').hidden=!!value.landing;$('touch-controls').hidden=!mobile||value.landing||value.vr;$('crosshair').hidden=!!value.landing||mobile||value.vr;
 if(mobile&&value.ready&&!value.vr&&!value.landing&&(previous.landing||!previous.ready||previous.vr||!!previous.patientOpen!==!!value.patientOpen)){
  touch?.cancel();
  setPanel(!!value.patientOpen);
  if(!value.patientOpen)emit('TouchGesture',{kind:'enable'});
 }
 updateTouchUI();
 if(value.landing){
  if(previous.landing===false){++sceneAction;homePending=true;stopPublicRequest();void window.AtlasVoice?.closeAll();window.speechSynthesis?.cancel();}
  return;
 }
 // WebXR controllers can enter the lab through Unity's own menu.
 if(previous.landing===true&&expectedLanding!==true){
  homePending=false;
  if(!hasVoiceSession()&&canStartPublic()&&!publicStatus)void ensurePublic();
 }
 document.querySelector('[data-tab="systems"]').hidden=!!value.patientOpen;if(value.patientOpen&&selectedTab==='systems')tab('patient');
 text('assistant-help',value.patientOpen?'Habla con María como en una entrevista educativa. Comienza con un saludo y una pregunta abierta, escucha su respuesta y utiliza Terminar y evaluar para revisar las evidencias.':'Puedes preguntar «¿qué es esto?», «¿para qué sirve?» o pedir «oculta todo menos el corazón». Señala la pieza antes de hablar.');
 voiceUI();
 text('speaker-heading',value.patientOpen?'María · entrevista':'Atlas · asistente');if(hasVoiceSession())text('transcript',value.transcript||'Mantén Hablar o espacio y suelta al terminar.');text('answer',value.answer||'');
 $('talk').classList.toggle('recording',hasVoiceSession()&&!!value.talk);window.AtlasVoice?.setVolume(value.volume??1);
 list('systems',value.systems,v=>v.id,v=>{const b=document.createElement('button');b.addEventListener('click',()=>command('system',{index:(state.systems||[]).findIndex(s=>s.id===v.id)}));return b;},(b,v)=>{
  const partial=v.visible&&!!value.study&&!(value.study==='arteries'&&v.id==='arterial')&&!(value.study==='digestive'&&v.id==='digestive');
  const label=(partial?'◐ ':v.visible?'● ':'○ ')+v.name+(partial?' · parcial':'');
  if(b.textContent!==label)b.textContent=label;
  b.setAttribute('aria-pressed',partial?'mixed':String(v.visible));
 });
 list('missions',value.missions,v=>v.index,v=>{const b=document.createElement('button');b.addEventListener('click',()=>command('mission',{index:v.index}));return b;},(b,v)=>{b.textContent=(v.done?'✓ ':'○ ')+v.title;});
 const selection=$('case-select');if(selection.options.length!==(value.cases||[]).length){selection.replaceChildren(...(value.cases||[]).map((c,i)=>new Option(c.title,String(i))));}
 if(document.activeElement!==selection)selection.value=String(value.caseIndex||0);
 text('case-brief',value.cases?.[value.caseIndex||0]?.brief||'');$('patient-session').hidden=!value.patientOpen;
 if(value.emotion){$('comfort').value=value.emotion.comfort;text('comfort-label',value.emotion.comfort+'%');text('emotion-signal',value.emotion.signal);text('advice',value.emotion.advice);}
 text('learning-status',value.learning?.status);text('learning-progress',value.learning?.progress);text('mission-question',value.neuro?.question);text('mission-feedback',value.neuro?.feedback);text('tutorial-text',value.neuro?.tutorial);
 $('part').hidden=!value.part;if(value.part){text('part-name',value.part.name);text('part-description',value.part.description);text('part-function',value.part.function);}
 $('results').hidden=!value.results;
 if(value.results){
  const result=value.results,score=result.score_percent??(result.total?100*result.observed/result.total:0);text('result-score',Math.round(score)+'%');text('result-summary',result.summary||'Revisa las evidencias de tu entrevista.');
  list('criteria',result.criteria,(c)=>c.name,c=>{const article=document.createElement('article');article.className='criterion';for(const tag of ['h4','meter','p','p'])article.appendChild(document.createElement(tag));return article;},(article,c)=>{const percent=c.score_percent??(c.observed?100:0);article.children[0].textContent=c.name+' · '+Math.round(percent)+'%';article.children[1].min=0;article.children[1].max=100;article.children[1].value=percent;article.children[2].textContent=c.evidence?'Evidencia: '+c.evidence:'Sin evidencia suficiente';article.children[3].textContent=c.suggestion||c.recommendation||'';});
 }
}
function sendInput(patch){if(!hasVoiceSession()){input.talk=false;if(patch.talk)patch.talk=false;}Object.assign(input,patch);emit('ReceiveInput',input);input.lookX=input.lookY=0;delete input.down;delete input.up;delete input.cancel;}
function resetInput(){touch?.cancel();sendInput({moveX:0,moveY:0,lookX:0,lookY:0,talk:false,cancel:true});$('talk').classList.remove('recording');}
for(const b of document.querySelectorAll('[data-op]'))b.addEventListener('click',()=>command(b.dataset.op,{value:Number(b.dataset.value||0)}));
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>tab(b.dataset.tab));
$('case-select').addEventListener('change',e=>command('case',{index:Number(e.target.value)}));$('voice-volume').addEventListener('input',e=>command('volume',{value:Number(e.target.value)}));
$('logout').addEventListener('click',logout);
$('menu-toggle').addEventListener('click',()=>setPanel($('panel').hidden));
for(const button of document.querySelectorAll('[data-study]'))button.addEventListener('click',()=>{
 command('study',{target:button.dataset.study});
 if(mobile)setPanel(false);
});
$('touch-frame').addEventListener('click',()=>emit('TouchGesture',{kind:'frame'}));
$('touch-fact').addEventListener('click',()=>{tab('systems');setPanel(true);requestAnimationFrame(()=>$('part').scrollIntoView({block:'nearest'}));});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Este navegador no permite cambiar a pantalla completa.');}});
$('vr').addEventListener('click',()=>command('vr'));
$('talk').addEventListener('pointerdown',e=>{
 e.preventDefault();unlockAudio();
 if(!hasVoiceSession()){
  tab('assistant');setPanel(true);
  if(canStartPublic())void ensurePublic().then(enabled=>{if(enabled&&!homePending)toast('Voz activa. Mantén Hablar mientras haces tu pregunta.');});
  else window.AtlasMicrophone?.test();
  return;
 }
 e.currentTarget.setPointerCapture(e.pointerId);sendInput({talk:true});
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('talk').addEventListener(type,()=>sendInput({talk:false}));
document.addEventListener('focusin',e=>sendInput({typing:!!e.target.closest('input,textarea,select')}));
document.addEventListener('focusout',()=>sendInput({typing:false}));
document.addEventListener('pointermove',e=>{const ui=!!e.target.closest('button,input,select,#panel,#home,#toolbar,dialog');if(ui!==input.ui)sendInput({ui});},{passive:true});
const stick=$('joystick');let stickId=null;
stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(stickId);updateStick(e);});
function updateStick(e){if(e.pointerId!==stickId)return;const r=stick.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.35))),y=Math.max(-1,Math.min(1,(r.top+r.height/2-e.clientY)/(r.height*.35)));sendInput({moveX:x,moveY:y});stick.firstElementChild.style.transform='translate('+x*29+'px,'+-y*29+'px)';}
stick.addEventListener('pointermove',updateStick);for(const kind of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(kind,e=>{if(e.pointerId!==stickId)return;stickId=null;sendInput({moveX:0,moveY:0});stick.firstElementChild.style.transform='';});
touch=window.AtlasTouch?.bind($('look-pad'),{
 canvas:$('unity-canvas'),enabled:()=>mobile&&!state.landing&&!state.vr,patient:()=>!!state.patientOpen,
 send:gesture=>emit('TouchGesture',gesture),onLook:(x,y)=>sendInput({lookX:x,lookY:y,ui:false}),
 mark:(point,kind)=>{const marker=$('touch-mark');marker.hidden=false;marker.dataset.kind=kind;
  marker.style.left=point.x+'px';marker.style.top=point.y+'px';
  clearTimeout(markTimer);markTimer=setTimeout(()=>marker.hidden=true,240);}
});
window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();}});
window.addEventListener('pagehide',()=>{++sceneAction;stopPublicRequest();resetInput();save(checkpoint);});

$('send-report').addEventListener('click',()=>{
 const report={schemaVersion:1,createdAt:new Date().toISOString(),checkpoint,interview:state.results||null};
 if(sessionKind==='nexus'&&hasVoiceSession())notify('atlas:results',{report});
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='atlas-resultados.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);text('report-status','Resultados exportados.');
});
$('developer').addEventListener('click',async()=>{
 ++sessionRevision;stopPublicRequest();await window.AtlasVoice?.closeAll();if(!devPrevious){save(checkpoint);devPrevious={accessToken,profile,checkpoint:structuredClone(checkpoint),expiresAt,sessionKind};sessionKind='none';accessToken='';profile='developer';checkpoint=readDraft();$('developer').textContent='Salir del modo de pruebas';}
 else{({accessToken,profile,checkpoint,expiresAt,sessionKind}=devPrevious);devPrevious=null;if(!hasVoiceSession()){accessToken='';expiresAt=0;sessionKind='none';} $('developer').textContent='Modo de pruebas separado';}
 if(unity&&!state.landing)command('home');configure();
});
async function openTestLink(){
 const prefix='#atlas_voice=';
 if(!location.hash.startsWith(prefix))return;
 const token=location.hash.slice(prefix.length);
 history.replaceState(history.state,'',location.pathname+location.search);
 if(window.parent!==window)return;

 const invalid='El acceso temporal no es válido o ya venció. Pide un enlace de prueba nuevo.';
 let claims;
 try{
  if(token.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw new Error();
  const encoded=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  claims=JSON.parse(atob(encoded));
  const now=Math.floor(Date.now()/1000);
  if(claims.role!=='atlas_web'||claims.aud!=='atlas-web'||claims.origin!==location.origin||
   typeof claims.profile_id!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(claims.profile_id)||
   !Number.isSafeInteger(claims.exp)||claims.exp<=now||claims.exp>now+660)throw new Error();
 }catch{
  testLinkStatus=invalid;configure();return;
 }

 const revision=sessionRevision;
 validatingTest=true;testLinkStatus='Validando el acceso de voz temporal…';configure();
 try{
  const url=configuration().apiBaseUrl.replace(/\/$/,'')+'/health';
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(revision!==sessionRevision)return;
  if(response.status===401||response.status===403){testLinkStatus=invalid;configure();return;}
  if(!response.ok)throw new Error();
  const health=await response.json();
  if(!health.ready||!health.livekit?.enabled||health.tts_configured===false)throw new Error();
  if(revision===sessionRevision)await connect({accessToken:token,profileId:claims.profile_id,expiresAt:claims.exp*1000},'test');
 }catch{
  if(revision!==sessionRevision)return;
  testLinkStatus='El servicio de voz no está disponible en este momento. Vuelve a abrir el enlace original para reintentar.';
  configure();
 }finally{validatingTest=false;voiceUI();}
}

window.AtlasApp={sceneVoiceAllowed:()=>!homePending,voiceError:message=>{if(!homePending){voiceFailure=message;voiceUI();}},bind:instance=>{unity=instance;window.unityInstance=instance;configure();},ready:name=>{receiver=name;configure();},receive,save,error,command,connect,logout,haptic:()=>{},api};
void openTestLink();
checkpoint=readDraft();tab('systems');configure();notify('atlas:ready',{});if(navigator.xr)navigator.xr.isSessionSupported('immersive-vr').then(ok=>{$('vr').hidden=!ok;}).catch(()=>{});
})();
