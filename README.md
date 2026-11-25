# Atlas Psicología Web

▶ **[Abrir Atlas en el navegador](https://softwarevalle75-wq.github.io/Atlas-Psicologia-Web/)**

Abre el enlace, elige Anatomía o la entrevista con María y permite el micrófono para hablar. El botón **Menú de inicio** del panel vuelve a la pantalla donde se elige la actividad.

Copia independiente de Atlas para Unity **6000.4.10f1**, preparada para navegador de PC, celular y WebVR. Incluye anatomía, Atlas, María, cuatro casos educativos, misiones y juegos.

GitHub Pages distribuye el cliente estático. Para las visitas públicas, el backend de Atlas entrega un pase temporal de voz al navegador. Nexus también puede vincular una cuenta de alumno. Las credenciales de proveedores permanecen en el servidor.

## Entrega al colaborador

1. Descargar `Atlas-Psicologia-Web.zip` de la versión `web-v0.1.10` o posterior.
2. Descomprimirlo: `index.html`, `Build/`, `StreamingAssets/` y los archivos de interfaz deben conservarse juntos.
3. Publicarlo desde la raíz de un sitio HTTPS. Los recursos usan rutas relativas y admiten la subcarpeta de un repositorio de GitHub Pages.
4. Para usar el workflow preparado, habilitar **Settings → Pages → GitHub Actions** y ejecutar **Publicar build en GitHub Pages** con la etiqueta de la release.
5. Si la plataforma necesita vincular el avance a la cuenta de un alumno, seguir la [integración opcional de Nexus](Docs/INTEGRACION-NEXUS.txt).

El repositorio y la aplicación de GitHub Pages son **públicos**. El colaborador puede abrir el enlace anterior o integrar la aplicación en Nexus. GitHub Free permite Pages en repositorios públicos; Pages desde un repositorio privado requiere un plan compatible. [Documentación de GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Estado de la IA

El transporte web conserva LiveKit, los comandos de Atlas, el contexto de la pieza y las respuestas de la paciente. Mantiene la voz seleccionada en el backend.

La visita pública obtiene un pase de diez minutos en `POST /api/v1/atlas/web/public-session` y guarda su avance en el navegador. El servidor aplica cuotas de uso a la voz pública. Al cambiar de dominio de publicación, configura su origen HTTPS en `ATLAS_WEB_ORIGINS` del backend.

## Proyecto Unity

El archivo anatómico grande y las bibliotecas nativas del SDK utilizan Git LFS:

```powershell
git lfs install
git clone https://github.com/odsanchezuniversitaria-web/Atlas-Psicologia-Web.git
cd Atlas-Psicologia-Web
git lfs pull
```

Abrir con Unity 6000.4.10f1 y el módulo WebGL instalado. Las escenas son:

- `Assets/@Xyla/Scenes/AtlasWebInicio.unity`
- `Assets/@Xyla/Scenes/AtlasWebLab.unity`

En Hierarchy, `AtlasWeb` contiene las referencias editables de cámara, jugador, controles y rayo. La paciente y el consultorio conservan sus objetos de escena. La interfaz de PC/celular está en `Assets/WebGLTemplates/AtlasNexus`.

Para compilar, usar **Atlas Web → Compilar Web PC, Celular y WebVR**. El destino es `Builds/AtlasPages/`. Las carpetas de caché, credenciales, servidores antiguos y builds incompletos quedan fuera de Git.

LiveKit nativo queda excluido del player WebGL; allí se utiliza su SDK JavaScript. Los inicializadores nativos de MRUK también se desactivan en navegador. Los cambios se describen en los archivos `ATLAS-WEBGL-PATCHES.txt` de esos paquetes.

## Acabados anatómicos

Para ajustar los músculos, selecciona `Assets/@Xyla/Resources/SkeletalMuscle.mat` en Unity. En el Inspector puedes cambiar el albedo (mapa de color), las repeticiones por metro y la intensidad. Los materiales de miocardio, hígado, riñón, piel y cerebro están en esa misma carpeta. El hueso cortical se ajusta en `Assets/Resources/CorticalBone.mat`.

`Assets/@Xyla/Resources/AtlasSurfaceDetail.png` contiene el detalle fino compartido por varios tejidos. Si lo editas, conserva sus canales RGBA, la importación lineal y los mipmaps. Al agarrar, girar o ampliar una pieza, conserva el tejido y la orientación de la textura que tenía en el cuerpo.

La orientación de las fibras se aproxima a partir de la forma de cada malla. Si cambias la geometría o el orden de las piezas, ejecuta `python WebBuildTools/bake-surface-frames.py` desde la raíz con Python 3 y NumPy. Se regeneran `AtlasSurfaceFrames.bytes` (ejes) y `AtlasDistalTendons.bytes` (transiciones tendinosas estimadas) en `Assets/@Xyla/Resources`. Puedes añadir `--check` para comprobar que las tablas corresponden al modelo.

## Comprobaciones locales

```powershell
cd WebBuildTools
npm ci
node --test client.test.cjs voice.test.cjs
node verify-build.cjs ../Builds/AtlasPages
node serve.cjs
```

Después de verificar el juego en navegador, `WebBuildTools/prepare-release.ps1` genera el ZIP, el manifiesto y su checksum en `ReleaseArtifacts/`.

Node recomendado: **22.22.0 o posterior**. La vista local abre en `http://127.0.0.1:8860`.

Los ensayos automatizados usan dobles de LiveKit, no consumen proveedores de IA y no equivalen a una prueba física del visor. Ver [VALIDACION-WEB.json](Docs/VALIDACION-WEB.json) para el alcance verificado de la entrega.

## Controles

- **PC:** WASD, botón derecho para mirar, arrastrar piezas con botón izquierdo, rueda para escalar y espacio para hablar.
- **Celular:** toca una pieza para identificarla, desliza un dedo para girar y usa dos dedos para acercar, alejar o desplazar la vista. Mantén pulsada una pieza para moverla y añade un segundo dedo para cambiar su tamaño. Corazón, Digestivo, Arterias y Venas tienen accesos directos. En la entrevista, usa el joystick para caminar y desliza para mirar.
- **WebVR:** botón Entrar en VR; palancas para caminar/girar, agarre para piezas, gatillo para paneles y A/X para hablar. El soporte depende del navegador del visor.

## Atribuciones

Se conservan los avisos de licencia de los modelos, materiales, SDK de Meta, LiveKit y WebXR incluidos en sus directorios. Los ejemplos opcionales `Samples~` de los SDK se excluyen de la entrega, incluidas sus configuraciones de acceso de demostración; no son necesarios para Atlas. Esta entrega no sustituye sus licencias ni concede permisos adicionales sobre esos recursos.

## Token temporal de Nexus

La integración de servidor y navegador está en [NexusIntegration](NexusIntegration/README.md). El backend emite JWT web de diez minutos limitados al perfil y al origen de Atlas. El host renueva la sesión y cierra la voz al salir; el secreto de aplicación permanece en el servidor de Nexus.

La conexión con el inicio de sesión y la matrícula debe montarse en el repositorio real de Nexus. El dominio nexus.oscar-vr.iudcdesarrollo.tech sigue sirviendo el antiguo proxy QR.

## Comprobar el micrófono

En el panel **Asistente**, pulsa **Probar micrófono** para comprobar la entrada durante ocho segundos. Para conversar con Atlas o María, mantén pulsado **Hablar** mientras haces la pregunta y suelta al terminar.

Selecciona **Entrada de micrófono** para elegir el dispositivo de tus auriculares. **Actualizar entradas** vuelve a consultar los dispositivos disponibles. Atlas y María utilizan esa misma entrada.
