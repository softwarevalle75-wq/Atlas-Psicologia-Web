import {
  ACESFilmicToneMapping, AmbientLight, AnimationMixer, Box3, BoxGeometry, CanvasTexture,
  Color, DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const box = new BoxGeometry(1, 1, 1);
const focus = new Vector3(0, 1.10, -2.62);
const eyes = new Vector3(0, 1.49, -.17);
const rest = 'idle';
const pickName = (names, pattern) => names.find(name => pattern.test(name));
const localAsset = name => new URL(name, location.href).href;

function deskAndChair(scene) {
  const grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const context = grain.getContext('2d');
  context.fillStyle = '#976744';
  context.fillRect(0, 0, 128, 128);
  for (let line = 0; line < 128; line++) {
    const color = (line * 83 + 59) % 29;
    context.fillStyle = 'rgba(' + (45 + color) + ',28,17,' + (0.04 + color / 210) + ')';
    context.fillRect(0, line, 128, 1);
  }
  const texture = new CanvasTexture(grain);
  texture.colorSpace = SRGBColorSpace;
  const wood = new MeshStandardMaterial({map: texture, roughness: .61, color: 0xffdab6});
  const darkOak = new MeshStandardMaterial({color: 0x392d26, roughness: .77});
  const fabric = new MeshStandardMaterial({color: 0x2d4550, roughness: .99});
  const paper = new MeshStandardMaterial({color: 0xe5dfcb, roughness: .91});
  const leather = new MeshStandardMaterial({color: 0x252e31, roughness: .7});
  const added = new Group();
  const piece = (material, x,y,z, w,h,d) => {
    const mesh = new Mesh(box, material);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    added.add(mesh);
    return mesh;
  };
  piece(wood, 0,.765,-1.91, 1.95,.07,.83);
  piece(darkOak, 0,.70,-1.75, 1.88,.071,.045);
  piece(darkOak, -.84,.36,-1.91, .10,.72,.72);
  piece(darkOak, .84,.36,-1.91, .10,.72,.72);
  piece(leather, -.55,.81,-1.95, .44,.027,.32).rotation.y = -.16;
  piece(paper, .13,.806,-1.94, .27,.012,.32).rotation.y = .19;
  piece(leather, .27,.817,-1.92, .019,.014,.15).rotation.y = -.32;
  piece(fabric, 0,.43,-2.64, .6,.10,.56);
  piece(fabric, 0,.85,-2.96, .60,.74,.10).rotation.x = -.11;
  piece(darkOak, 0,.22,-2.67, .085,.38,.085);
  scene.add(added);
}

function lightOffice(scene) {
  const fill = new HemisphereLight(0xe9f2ff, 0xba9a7a, 1.33);
  scene.add(fill, new AmbientLight(0xfff0dc,.46));
  const windowLight = new DirectionalLight(0xffecd6,2.4);
  windowLight.position.set(-3,3.5,1.8);
  scene.add(windowLight);
  const rim = new DirectionalLight(0xd4e7ff,1.1);
  rim.position.set(3,2.5,-3.6);
  scene.add(rim);
}

function poseAvatar(gltf, modeConfig) {
  const avatar = gltf.scene;
  avatar.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(avatar);
  const size = bounds.getSize(new Vector3());
  if (!(size.y > 0) || size.y > 200) throw Error('Invalid avatar dimensions');
  const center = bounds.getCenter(new Vector3());
  const scale = (modeConfig.height || 1.52) / size.y;
  const placement = new Group();
  avatar.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  avatar.scale.multiplyScalar(scale);
  placement.add(avatar);
  placement.position.set(0, modeConfig.lift || 0, -2.62);
  placement.rotation.y = modeConfig.turn || 0;

  const mixer = new AnimationMixer(avatar);
  const clipNames = gltf.animations.map(clip => clip.name);
  const clip = pattern => {
    const name = pickName(clipNames, pattern);
    return name ? mixer.clipAction(gltf.animations.find(action => action.name === name)) : null;
  };
  const actions = {
    idle: clip(/idle|reposo/i),
    talking: clip(/talk|speak|pregunt/i),
    listening: clip(/listen|escucha/i),
    thinking: clip(/think|revis/i),
    acknowledge: clip(/nod|confirm/i)
  };
  let active;
  const morphs = {mouth: [], blink: []};
  const bones = [];
  avatar.traverse(mesh => {
    if (mesh.isBone || mesh.name.startsWith('Recruiter')) bones.push(mesh);
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    const dictionary = mesh.morphTargetDictionary;
    const names = Object.keys(dictionary);
    const mouth = pickName(names, /^(jawopen|mouthopen|mouth_open|viseme_aa|vrc\.v_aa|ah|aa)$/i);
    if (mouth) morphs.mouth.push([mesh.morphTargetInfluences, dictionary[mouth]]);
    names.filter(name => /blink|eyes?closed/i.test(name))
      .forEach(name => morphs.blink.push([mesh.morphTargetInfluences, dictionary[name]]));
  });

  const findBone = pattern => bones.find(bone => pattern.test(bone.name));
  const head = findBone(/(^|[:_. -])head$|recruiterhead/i);
  const body = findBone(/(^|[:_. -])(spine1|chest)$|recruiterchest/i);
  const arm = findBone(/rightforearm$|recruiterrightarm/i);
  const jaw = findBone(/(^|[:_. -])jaw$|recruiterjaw/i);
  const restPoses = [head, body, arm, jaw].map(node => node?.quaternion.clone());
  const yAxis = new Vector3(0,1,0);
  const xAxis = new Vector3(1,0,0);
  const offset = new Quaternion();
  const rotate = (node, index, angle, axis=xAxis) => {
    if (node) node.quaternion.copy(restPoses[index]).multiply(offset.setFromAxisAngle(axis, angle));
  };

  function tick(dt, time, mode, muted) {
    const action = actions[mode] || actions.idle;
    if (action !== active) {
      if (active) active.fadeOut(.25);
      action?.reset().fadeIn(.25).play();
      active = action;
    }
    mixer.update(dt);
    if (!actions[mode]) {
      const talk = !muted && mode === 'talking';
      const listen = !muted && mode === 'listening';
      rotate(head,0,Math.sin(time*(listen ? 3.1 : 1.65))*(talk ? .085 : listen ? .060 : .018));
      rotate(body,1,Math.sin(time*1.9)*(talk ? .032 : .014));
      rotate(arm,2,talk ? Math.sin(time*2.95)*.20 : Math.sin(time*1.2)*.018,yAxis);
    }
    const speaking = mode === 'talking' && !muted;
    const mouth = speaking ? Math.max(0,Math.sin(time*24)*.15+.35+Math.sin(time*37)*.10) : 0;
    for (const [weights,index] of morphs.mouth) weights[index] = mouth;
    const jawInClip = jaw && action?.getClip().tracks.some(track => track.name.startsWith(jaw.name + '.'));
    if (!morphs.mouth.length && jaw && !jawInClip) rotate(jaw,3,mouth*.33);
    const blinkCycle = time % 4.85;
    const blink = blinkCycle > 4.68 ? Math.sin((blinkCycle-4.68)/.17*Math.PI) : 0;
    for (const [weights,index] of morphs.blink) weights[index] = blink;
  }

  return {placement, tick};
}

export function mount(container, announce) {
  let renderer, rig, enabled = true, inViewport = true;
  let mode = rest;
  let cameraX = 0, cameraY = 0, desiredX = 0, desiredY = 0;
  let elapsed = 0, last = 0, request = 0, lastFrame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new Scene();
  scene.background = new Color(0xaac8d3);
  const camera = new PerspectiveCamera(39, 1, .07, 38);
  const world = container.closest('.office');

  function layout() {
    if (!renderer) return;
    const {clientWidth: width, clientHeight: height} = container;
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < .85 ? 45 : 37;
    camera.updateProjectionMatrix();
    queue();
  }
  function queue() {
    if (!request && rig && enabled && inViewport && !document.hidden) request = requestAnimationFrame(frame);
  }
  function frame(now) {
    request = 0;
    if (!enabled || !inViewport || document.hidden) {last = 0;return;}
    if (now - lastFrame >= (reduced ? 63 : 30)) {
      const dt = last ? Math.min(.08, (now - last) / 1000) : 0;
      lastFrame = last = now;
      elapsed += dt;
      cameraX = MathUtils.damp(cameraX,desiredX,4,dt);
      cameraY = MathUtils.damp(cameraY,desiredY,4,dt);
      camera.position.copy(eyes);
      camera.position.x += cameraX;
      camera.position.y += cameraY;
      camera.lookAt(focus);
      rig.tick(dt,elapsed,mode,reduced);
      renderer.render(scene,camera);
    }
    queue();
  }
  const size = new ResizeObserver(layout);
  size.observe(container);
  const visibility = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    queue();
  },{rootMargin:'60px'});
  visibility.observe(container);
  document.addEventListener('visibilitychange',queue);
  world.addEventListener('pointermove', event => {
    if (reduced || event.pointerType !== 'mouse') return;
    const rect = world.getBoundingClientRect();
    desiredX = ((event.clientX-rect.left)/rect.width-.5)*.36;
    desiredY = (.5-(event.clientY-rect.top)/rect.height)*.13;
  },{passive:true});
  world.addEventListener('pointerleave', () => {desiredX = desiredY = 0;});

  Promise.resolve().then(async () => {
    const context = container.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'low-power'});
    if (!context) throw Error('WebGL 2 unavailable');
    renderer = new WebGLRenderer({canvas:container,context});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.10;
    const loader = new GLTFLoader();
    const [office,interviewer] = await Promise.all([
      loader.loadAsync(localAsset('consultorio.glb')),
      loader.loadAsync(localAsset('entrevistador.glb'))
    ]);
    office.scene.traverse(node => {
      const name = node.name.replace(/[_\s]+/g, ' ');
      if (node.isLight || /^(Mesa -|Sillon paciente)/i.test(name)) node.visible = false;
    });
    scene.add(office.scene);
    deskAndChair(scene);
    lightOffice(scene);
    rig = poseAvatar(interviewer,{height:1.49});
    scene.add(rig.placement);
    world.dataset.scene = '3d';
    announce('Oficina 3D lista');
    layout();
    queue();
  }).catch(() => {
    world.dataset.scene = 'fallback';
    announce('Vista fotográfica · el navegador no pudo abrir la escena 3D');
    renderer?.dispose();
  });
  container.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    enabled = false;
    world.dataset.scene = 'fallback';
    announce('Vista fotográfica · se interrumpió la escena 3D');
  });
  return {
    setMode(next) {mode=next;queue();},
    setVisible(visible) {enabled=visible;queue();}
  };
}

window.AtlasHiringScene = Object.freeze({mount});
