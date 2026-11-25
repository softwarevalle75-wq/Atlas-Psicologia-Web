# Integrar la voz en el Nexus existente

Estos módulos se importan en el frontend/backend de Nexus. No crean un Gateway, no usan LabKey y no contienen secretos. El player de Pages sigue llamando directamente al backend central de Atlas; el servidor Nexus sólo obtiene el acceso temporal del alumno.

## Backend Nexus

`atlas-session-server.mjs` exporta `createAtlasSessionIssuer`. Usar Node 22 o posterior. El servidor necesita las credenciales de aplicación que ya existen en Game Auth; **jamás usar variables `VITE_*`, `NEXT_PUBLIC_*` ni incluir esos valores en Pages**.

```js
import {createAtlasSessionIssuer} from './atlas-session-server.mjs';

const issueAtlasSession = createAtlasSessionIssuer({
  appId: process.env.ATLAS_APP_ID,
  appSecret: process.env.ATLAS_APP_SECRET,
  atlasOrigin: 'https://softwarevalle75-wq.github.io',
  authorize: async ({user, courseId}) => {
    // Sustituir por la consulta de matrícula/permisos de Nexus.
    return await enrollmentService.canUseAtlas(user.id, courseId);
  }
});

// Ejemplo Express: conservar los middlewares reales de sesión y CSRF de Nexus.
app.post('/api/courses/:courseId/atlas/session', requireNexusSession, requireCsrf,
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await issueAtlasSession({
        user: {id: String(req.user.id)}, // identidad validada en el servidor
        courseId: req.params.courseId  // authorize comprueba el acceso
      });
      res.json(result);
    } catch (error) {
      res.status(error.status === 403 ? 403 : 503)
        .json({error: 'No se pudo habilitar la voz de Atlas.'});
    }
  });
```

La fábrica guarda el JWT completo de aplicación exclusivamente en memoria del servidor y devuelve sólo el JWT web de diez minutos. El perfil es un HMAC de alumno/curso sin datos personales; puede usarse un `profileSecret` privado independiente para mantener los perfiles estables al rotar el secreto de aplicación. El módulo no considera válido un alumno sin la función `authorize`.

## Frontend Nexus

```html
<iframe id="atlas" title="Atlas Psicología"
 src="https://softwarevalle75-wq.github.io/Atlas-Psicologia-Web/"
 allow="microphone; autoplay; xr-spatial-tracking; fullscreen"
 allowfullscreen></iframe>
```

El iframe apunta a Atlas publicado. La integración autenticada asocia la sesión al alumno y al curso. Quienes abren la página pública pueden hablar con Atlas y con María como visitantes.

```js
import {attachAtlas} from './atlas-host.mjs';

const atlas = attachAtlas({
  iframe: document.getElementById('atlas'),
  atlasUrl: 'https://softwarevalle75-wq.github.io/Atlas-Psicologia-Web/',
  sessionEndpoint: '/api/courses/ID_DEL_CURSO/atlas/session',
  getCsrfToken: () => nexusSession.csrfToken,
  onError: error => showAtlasError(error.message),
  // Estos adaptadores deben persistir bajo la identidad de la sesión Nexus.
  // No marcar progreso confirmado ni notas oficiales sólo por recibir un mensaje.
  onProgress: async data => await nexusProgress.save(data),
  onResults: async data => await nexusReports.submitForVerification(data)
});
// Al desmontar la vista o cerrar la sesión de Nexus:
// atlas.dispose();
```

El host valida el origen y la ventana emisora, entrega el token sólo al iframe exacto, renueva antes de caducar y cierra la voz con `atlas:logout`. No almacena tokens en localStorage. `onProgress` debe devolver `true` únicamente después de que Nexus confirme el guardado; sólo entonces se envía `atlas:progress-ack`. Las notas recibidas del navegador requieren verificación del servidor antes de ser oficiales.

## Dominios, CORS y micrófono

El backend de Atlas permite los orígenes actuales en `/api/v1/atlas/`. Al cambiar la cuenta de Pages, ajustar `ATLAS_WEB_ORIGINS` (lista de orígenes exactos HTTPS) en el backend Atlas y el `atlasOrigin` del módulo de Nexus. Si cambia el dominio de Nexus, añadirlo a `nexusOrigins` de `Assets/WebGLTemplates/AtlasNexus/atlas-config.js` y del build publicado.

Además del atributo `allow` del iframe, si Nexus envía cabeceras restrictivas, incluir el origen del player en Permissions-Policy y CSP:

```text
Permissions-Policy: microphone=(self "https://softwarevalle75-wq.github.io"), autoplay=(self "https://softwarevalle75-wq.github.io"), xr-spatial-tracking=(self "https://softwarevalle75-wq.github.io")
```

Añadir ese origen a la directiva `frame-src` ya existente. No reemplazar toda la CSP por un ejemplo. El alumno debe permitir el micrófono y pulsar Comenzar/Hablar si el navegador requiere interacción para audio. WebVR funciona con HTTPS y navegador compatible del visor.

## Validación

```sh
node --test NexusIntegration/atlas-session.test.mjs
```

Pruebas sin proveedores facturados: autorización de alumno, aislamiento de perfiles, ocultación de secretos, validación de origen/ventana y confirmación de progreso. La integración final con las cookies/matrícula de Nexus debe realizarse en su repositorio real; el dominio antiguo `nexus.oscar-vr.iudcdesarrollo.tech` sirve un proxy QR, no el LMS.
