import {
  ACESFilmicToneMapping, AmbientLight, AnimationMixer, Box3, BoxGeometry, CanvasTexture,
  Color, DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const box = new BoxGeometry(1, 1, 1);
const avatarPosition = new Vector3(0, 0, -2.62);
const focus = new Vector3(0, 1.11, avatarPosition.z);
const eyes = new Vector3(0, 1.40, -.25);
const rest = 'idle';
const pickName = (names, pattern) => names.find(name => pattern.test(name));
const localAsset = name => new URL(name, location.href).href;

function deskAndChair(scene) {
  const grain = document.createElement('canvas');
  grain.width = grain.height = 192;
  const context = grain.getContext('2d');
  const pixels = context.createImageData(grain.width, grain.height);
  for (let y = 0; y < grain.height; y++) {
    for (let x = 0; x < grain.width; x++) {
      const wave = y + Math.sin(x * .036 + y * .041) * 2.3 + Math.sin(x * .013) * 2;
      const shade = Math.sin(wave * 1.82) * 1.45 + Math.sin(wave * .51) * 2.15 + Math.sin(wave * .08) * 3.2;
      const noise = ((x * 37 + y * 73 + x * y * 23) % 17 - 8) * .31;
      pixels.data.set([114 + shade + noise, 83 + shade + noise, 61 + shade + noise, 255], (x + y * grain.width) * 4);
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(grain);
  texture.colorSpace = SRGBColorSpace;
  const wood = new MeshStandardMaterial({map: texture, roughness: .37, color: 0xebded1});
  const darkOak = new MeshStandardMaterial({color: 0x392d26, roughness: .77});
  const fabric = new MeshStandardMaterial({color: 0x303b3b, roughness: .98});
  const paper = new MeshStandardMaterial({color: 0xe5dfcb, roughness: .91});
  const graphite = new MeshStandardMaterial({color: 0x2a3032, roughness: .49, metalness: .2});
  const machine = new MeshStandardMaterial({color: 0x767e7d, roughness: .42, metalness: .45});
  const added = new Group();
  const piece = (material, x,y,z, w,h,d, radius = 0) => {
    const geometry = radius ? new RoundedBoxGeometry(w,h,d,2,radius) : box;
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x,y,z);
    if (!radius) mesh.scale.set(w,h,d);
    added.add(mesh);
    return mesh;
  };
  piece(wood, 0,.754,-1.91, 1.95,.064,.88,.019);
  piece(darkOak, 0,.70,-1.75, 1.88,.071,.045);
  piece(darkOak, -.84,.36,-1.91, .10,.72,.72);
  piece(darkOak, .84,.36,-1.91, .10,.72,.72);
  piece(machine, -.56,.793,-1.87, .40,.014,.29,.006);
  piece(graphite, -.56,.802,-1.91, .31,.005,.12);
  piece(machine, -.56,.907,-2, .40,.237,.013,.004).rotation.x = -.19;
  piece(graphite, .21,.793,-1.91, .282,.013,.314,.006).rotation.y = .19;
  piece(paper, .21,.801,-1.91, .263,.008,.296,.004).rotation.y = .19;
  piece(graphite, .31,.812,-1.91, .012,.012,.15,.005).rotation.y = -.25;
  piece(fabric, 0,.43,-2.64, .56,.10,.53,.042);
  piece(fabric, 0,.87,-2.96, .55,.67,.12,.05).rotation.x = -.11;
  piece(darkOak, 0,.22,-2.67, .085,.38,.085);
  scene.add(added);
}

function lightOffice(scene) {
  const fill = new HemisphereLight(0xe9f3ff, 0xe7bf9c, .93);
  scene.add(fill, new AmbientLight(0xfff0dc,.28));
  const windowLight = new DirectionalLight(0xffecd7,2.6);
  windowLight.position.set(-3,3.1,1.25);
  scene.add(windowLight);
  const bounce = new DirectionalLight(0xe2ebff, .68);
  bounce.position.set(2.4, 1.8, .2);
  const rim = new DirectionalLight(0xffdfbb,.72);
  rim.position.set(2.5,2.4,-3.6);
  scene.add(bounce);
  scene.add(rim);
}

function poseAvatar(gltf, modeConfig) {
  const avatar = gltf.scene;
  avatar.updateMatrixWorld(true);
  avatar.traverse(mesh => {
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
  });
  const bounds = new Box3().setFromObject(avatar, true);
  const size = bounds.getSize(new Vector3());
  if (!(size.y > 0) || size.y > 200) throw Error('Invalid avatar dimensions');
  const center = bounds.getCenter(new Vector3());
  const scale = modeConfig.height / size.y;
  const placement = new Group();
  avatar.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  avatar.scale.multiplyScalar(scale);
  placement.add(avatar);
  placement.position.copy(avatarPosition);
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
  const body = findBone(/(^|[:_. -])(spine1|chest)$|^spine_03$|recruiterchest/i);
  const arm = findBone(/rightforearm$|^lowerarm_r$|recruiterrightarm/i);
  const jaw = findBone(/(^|[:_. -])jaw$|recruiterjaw/i);
  const restPoses = [head, body, arm, jaw].map(node => node?.quaternion.clone());
  const yAxis = new Vector3(0,1,0);
  const xAxis = new Vector3(1,0,0);
  const offset = new Quaternion();
  let mouthLevel = 0;
  let stateAge = 0;
  let previousMode = rest;
  const rotate = (node, index, angle, axis=xAxis) => {
    if (node) node.quaternion.copy(restPoses[index]).multiply(offset.setFromAxisAngle(axis, angle));
  };

  function tick(dt, time, mode, reduced, speechLevel) {
    if (mode !== previousMode) {
      previousMode = mode;
      stateAge = 0;
    }
    stateAge += dt;
    const action = actions[mode] || actions.idle;
    if (action !== active) {
      if (active) active.fadeOut(.25);
      action?.reset().fadeIn(.25).play();
      active = action;
    }
    mixer.update(dt);
    if (!actions[mode]) {
      const talk = !reduced && mode === 'talking';
      const listen = !reduced && mode === 'listening';
      const thinking = !reduced && mode === 'thinking';
      const nod = !reduced && mode === 'acknowledge' && stateAge < .68
        ? Math.sin(stateAge / .68 * Math.PI) * .095 : 0;
      const tilt = Math.sin(time * 1.6) * (talk ? .024 : listen ? .016 : .009);
      rotate(head,0,reduced ? 0 : tilt + nod + (thinking ? .028 : 0));
      rotate(body,1,reduced ? 0 : Math.sin(time*1.35)*(talk ? .010 : .006));
      rotate(arm,2,talk ? Math.sin(time*1.82)*.045 : 0,yAxis);
    }
    const speaking = mode === 'talking';
    const defaultMouth = reduced ? 0 : Math.max(0, Math.sin(time*21)*.12 + .25);
    const target = speaking ? (speechLevel ?? defaultMouth) : 0;
    mouthLevel = MathUtils.damp(mouthLevel, target, target > mouthLevel ? 27 : 20, dt);
    for (const [weights,index] of morphs.mouth) weights[index] = mouthLevel;
    const jawInClip = jaw && action?.getClip().tracks.some(track => track.name.startsWith(jaw.name + '.'));
    if (!morphs.mouth.length && jaw && !jawInClip) rotate(jaw,3,mouthLevel*.31);
    const blinkCycle = (time + Math.sin(time * .62) * .55) % 4.45;
    const blink = !reduced && blinkCycle > 4.24 ? Math.sin((blinkCycle-4.24)/.21*Math.PI) : 0;
    for (const [weights,index] of morphs.blink) weights[index] = blink;
  }

  return {placement, tick};
}

export function mount(container, announce) {
  let renderer, rig, enabled = true, inViewport = true;
  let mode = rest;
  let speechLevel;
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
    camera.fov = camera.aspect > 1.55 ? 25 : camera.aspect < .85 ? 35 : 32;
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
      rig.tick(dt,elapsed,mode,reduced,speechLevel);
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
    desiredX = ((event.clientX-rect.left)/rect.width-.5)*.18;
    desiredY = (.5-(event.clientY-rect.top)/rect.height)*.08;
  },{passive:true});
  world.addEventListener('pointerleave', () => {desiredX = desiredY = 0;});

  Promise.resolve().then(async () => {
    const context = container.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'low-power'});
    if (!context) throw Error('WebGL 2 unavailable');
    renderer = new WebGLRenderer({canvas:container,context});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.15 : 1.35));
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
    rig = poseAvatar(interviewer,{height:1.41});
    scene.add(rig.placement);
    world.dataset.scene = '3d';
    announce('Oficina 3D lista');
    layout();
    queue();
  }).catch(() => {
    world.dataset.scene = 'fallback';
    announce('Vista estática · el navegador no pudo abrir la escena 3D');
    renderer?.dispose();
  });
  container.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    enabled = false;
    world.dataset.scene = 'fallback';
    announce('Vista estática · se interrumpió la escena 3D');
  });
  return {
    setMode(next) {mode=next;queue();},
    setSpeechLevel(level) {speechLevel=Number.isFinite(level) ? MathUtils.clamp(level,0,1) : undefined;},
    setVisible(visible) {enabled=visible;queue();}
  };
}

window.AtlasHiringScene = Object.freeze({mount});
