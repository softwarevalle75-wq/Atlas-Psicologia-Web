'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../Builds/AtlasPages'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(html.includes('{{{')||html.includes('gatewayUrl')||html.includes('labKey'))throw Error('El build contiene una plantilla sin compilar o configuración retirada.');
for(const file of ['atlas-client.js','atlas-voice.js','atlas-config.js','livekit-client.js','atlas.css'].concat(html.includes('atlas-microphone.js')?['atlas-microphone.js']:[],html.includes('atlas-touch.js')?['atlas-touch.js']:[]))if(!fs.statSync(path.join(root,file)).size)throw Error('Falta '+file);
if (html.includes('href="seleccion/"')) {
 const level = ['index.html','seleccion.css','profiles.js','evaluacion.js','seleccion.js','office.webp'];
 const interviewPage = fs.readFileSync(path.join(root,'seleccion','index.html'),'utf8');
 if (interviewPage.includes('escena.js')) level.push('escena.js','voz.js','respuestas.js','consultorio.glb','entrevistador.glb','three-LICENSE.txt');
 if (interviewPage.includes('compras-ui.js')) level.push('compras.js','compras-ui.js','compras-archivo.js');
 if (interviewPage.includes('entrevista.js')) level.push('entrevista.js','escucha.js');
 for (const file of level) if (!fs.statSync(path.join(root,'seleccion',file)).size) throw Error('Falta selección laboral: '+file);
}

const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else{const bytes=fs.readFileSync(full);if(bytes.subarray(0,45).toString().startsWith('version https://git-lfs.github.com/spec'))throw Error('Puntero LFS sin descargar: '+full);files.push({path:path.relative(root,full).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}walk(root);
for(const suffix of ['.loader.js','.framework.js.unityweb','.wasm.unityweb','.data.unityweb'])if(!files.some(f=>f.path.endsWith(suffix)))throw Error('Falta el recurso '+suffix);
const total=files.reduce((n,f)=>n+f.bytes,0);if(total>1024**3)throw Error('El build supera 1 GiB.');
console.log(JSON.stringify({ok:true,files:files.length,bytes:total,manifest:files},null,2));
