/*
  The forest: a night flight through a wild forest. The drone cruises on autopilot until a
  visitor takes the controls. Six signals are hidden among the trees; flying into one opens a
  chapter from the "Inside my head" section. When the battery runs low, a service drone arrives
  and swaps it in mid-air.

  Needs WebGL. Without it, or with reduced motion, the page shows a still scene and the six
  signals as plain buttons.
*/
import * as THREE from '/assets/vendor/three/three.module.min.js';

const root = document.getElementById('experience');
const canvas = document.getElementById('xp-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}


/* ---------- Shared: the signal list and the chapter dialog ---------- */

function chapterFor(id) { return document.getElementById('mind-' + id); }

function openCard(id, onClose) {
  const dialog = document.getElementById('xp-card');
  const body = document.getElementById('xp-card-body');
  const chapter = chapterFor(id);
  if (!dialog || !body || !chapter) return;
  body.innerHTML = '';
  const clone = chapter.querySelector('.mind-inner').cloneNode(true);
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  body.appendChild(clone);
  const done = () => { dialog.removeEventListener('close', done); if (onClose) onClose(); };
  dialog.addEventListener('close', done);
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
}

function setupStaticSignals() {
  document.querySelectorAll('.xp-signal').forEach((btn) => {
    btn.addEventListener('click', () => openCard(btn.dataset.id));
  });
}

/* ---------- Noise for the terrain ---------- */

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { v += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return v;
}
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  const hills = (fbm(x * 0.012, z * 0.012) - 0.45) * 46;
  const ridge = smoothstep(150, 260, d) * 28;
  return hills * (0.25 + 0.75 * smoothstep(10, 70, d)) + ridge;
}

/* ---------- Random with a fixed seed so the forest is the same for everyone ---------- */
let seed = 20260611;
function rand() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

/* ---------- Palettes for night (dark theme) and dawn (light theme) ---------- */
const PALETTES = {
  dark: {
    skyTop: 0x02060d, skyBottom: 0x0b2a35, fog: 0x07161d, fogDensity: 0.0105,
    ground: 0x0d2a24, trunk: 0x1d1714, leafA: 0x0f3b31, leafB: 0x16483a,
    hemiSky: 0x5d7fa8, hemiGround: 0x0a1410, hemi: 0.55, moon: 0x9fc4ff, moonI: 0.55,
    firefly: 0xc9ff7a, stars: 1, beacon: 0x5cf2c8, exposure: 1.05
  },
  light: {
    skyTop: 0x7fa6c2, skyBottom: 0xe9d9c6, fog: 0xc9d6d4, fogDensity: 0.0085,
    ground: 0x5f7f55, trunk: 0x4a3a30, leafA: 0x2f5e45, leafB: 0x3f7350,
    hemiSky: 0xffffff, hemiGround: 0x46553c, hemi: 1.05, moon: 0xfff1d8, moonI: 1.1,
    firefly: 0xffd27a, stars: 0, beacon: 0x0aa37f, exposure: 1.0
  }
};

function start() {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07161d, 0.0105);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);

  /* Sky dome with a vertical gradient */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.05, 0.6, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }'
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  scene.add(sky);

  /* Stars */
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1600 * 3);
  for (let i = 0; i < 1600; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(0.15 + rand() * 0.85);
    const r = 650;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xdfe9ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* Lights */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xffffff, 0.6);
  moon.position.set(-120, 200, -80);
  scene.add(moon);

  /* Terrain */
  const SIZE = 640, SEG = 128;
  const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  scene.add(new THREE.Mesh(groundGeo, groundMat));

  /* Signals: positions spread around the forest */
  const signalButtons = Array.from(document.querySelectorAll('.xp-signal'));
  const signals = signalButtons.map((btn, i) => {
    const a = (i / signalButtons.length) * Math.PI * 2 + 0.6;
    const r = 70 + (i % 2) * 45 + rand() * 15;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    return { id: btn.dataset.id, name: btn.dataset.name, btn, x, z, y: groundHeight(x, z), found: false };
  });

  /* Trees */
  const trees = [];
  const GRID = 10, grid = new Map();
  const TREE_COUNT = isTouch ? 900 : 1500;
  let tries = 0;
  while (trees.length < TREE_COUNT && tries < 20000) {
    tries++;
    const r = 18 + Math.sqrt(rand()) * 280;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (signals.some((s) => Math.hypot(s.x - x, s.z - z) < 11)) continue;
    if (fbm(x * 0.02 + 40, z * 0.02) < 0.38) continue; // natural clearings
    const h = 7 + rand() * 9 + fbm(x * 0.05, z * 0.05) * 6;
    const t = { x, z, y: groundHeight(x, z), h, w: 0.6 + rand() * 0.5 };
    trees.push(t);
    const key = Math.floor(x / GRID) + ',' + Math.floor(z / GRID);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(t);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 5);
  trunkGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.ConeGeometry(1, 1, 7);
  leafGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, trees.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const leafTone = [];
  trees.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(v3.set(t.x, t.y - 0.3, t.z), q, sc.set(t.w, t.h * 0.45, t.w));
    trunks.setMatrixAt(i, m4);
    const tone = rand();
    m4.compose(v3.set(t.x, t.y + t.h * 0.22, t.z), q, sc.set(t.h * 0.26 * t.w + 1.2, t.h * 0.62, t.h * 0.26 * t.w + 1.2));
    leaves.setMatrixAt(i * 2, m4); leafTone.push(tone);
    m4.compose(v3.set(t.x, t.y + t.h * 0.52, t.z), q, sc.set(t.h * 0.17 * t.w + 0.8, t.h * 0.5, t.h * 0.17 * t.w + 0.8));
    leaves.setMatrixAt(i * 2 + 1, m4); leafTone.push(tone);
  });
  scene.add(trunks, leaves);

  /* Fireflies */
  const FF = isTouch ? 260 : 480;
  const ffGeo = new THREE.BufferGeometry();
  const ffPos = new Float32Array(FF * 3), ffPhase = new Float32Array(FF);
  for (let i = 0; i < FF; i++) {
    const r = 10 + Math.sqrt(rand()) * 220, a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    ffPos[i * 3] = x; ffPos[i * 3 + 1] = groundHeight(x, z) + 1 + rand() * 9; ffPos[i * 3 + 2] = z;
    ffPhase[i] = rand() * 100;
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('phase', new THREE.BufferAttribute(ffPhase, 1));
  const ffMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color() }, scale: { value: 1 }, strength: { value: 1 } },
    vertexShader: `
      attribute float phase; uniform float time; uniform float scale; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(time*0.35 + phase)*1.6; p.y += sin(time*0.6 + phase*1.7)*0.9; p.z += cos(time*0.3 + phase)*1.6;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vA = 0.35 + 0.65*pow(0.5+0.5*sin(time*1.7 + phase*3.0), 3.0);
        gl_PointSize = min(12.0, max(2.0, scale * 0.5 / -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float strength; varying float vA;
      void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(color, a*vA*strength); }`
  });
  scene.add(new THREE.Points(ffGeo, ffMat));

  /* Signal beacons: a beam of light and a slowly turning ring */
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color() }, time: { value: 0 } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float time; varying float vY; void main(){ float a = (1.0 - vY) * 0.55 + 0.08*sin(time*3.0 + vY*20.0); gl_FragColor = vec4(color, a*(1.0-vY)); }'
  });
  const beamGeo = new THREE.CylinderGeometry(1.6, 2.6, 70, 20, 1, true);
  beamGeo.translate(0, 35, 0);
  const ringGeo = new THREE.TorusGeometry(4.2, 0.12, 6, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
  signals.forEach((s) => {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const beam = new THREE.Mesh(beamGeo, beamMat.clone());
    const ring = new THREE.Mesh(ringGeo, ringMat.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 10;
    const ring2 = ring.clone(); ring2.material = ringMat.clone(); ring2.position.y = 22; ring2.scale.setScalar(0.7);
    g.add(beam, ring, ring2);
    scene.add(g);
    s.group = g; s.beam = beam; s.rings = [ring, ring2];
  });

  /* Drones */
  function buildDrone(scale, ledColor) {
    const d = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2328, roughness: 0.55, metalness: 0.4 });
    const shell = new THREE.MeshStandardMaterial({ color: 0xdfe6e8, roughness: 0.35, metalness: 0.15, emissive: 0x30444c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.1), shell);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.1), dark);
    top.position.y = 0.33;
    d.add(body, top);
    const props = [];
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 2.1), dark);
      arm.position.set(sx * 0.85, 0.05, sz * 0.85);
      arm.rotation.y = Math.atan2(sx, sz);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), dark);
      motor.position.set(sx * 1.6, 0.2, sz * 1.6);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.14), new THREE.MeshBasicMaterial({ color: 0x9aa7ad, transparent: true, opacity: 0.55 }));
      prop.position.set(sx * 1.6, 0.38, sz * 1.6);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0xbfd0d6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.copy(prop.position);
      d.add(arm, motor, prop, disc);
      props.push(prop);
    });
    const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
    const ledL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3bff8a }));
    ledL.position.set(-1.6, 0.05, 1.6); ledR.position.set(1.6, 0.05, 1.6);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), ledMat);
    strip.position.set(0, 0.05, 1.07);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.08), dark);
    legs.position.set(0, -0.45, 0.6);
    const legs2 = legs.clone(); legs2.position.z = -0.6;
    d.add(ledL, ledR, strip, legs, legs2);
    d.scale.setScalar(scale);
    d.userData.props = props;
    return d;
  }

  const drone = buildDrone(1, 0x5cf2c8);
  const frame = new THREE.Group(); // position + yaw
  const tilt = new THREE.Group(); // pitch + roll
  tilt.add(drone);
  frame.add(tilt);
  const spot = new THREE.SpotLight(0xd8fff2, 40, 60, 0.55, 0.6, 1.6);
  spot.position.set(0, -0.2, 0.4);
  spot.target.position.set(0, -10, 4);
  frame.add(spot, spot.target);
  const glow = new THREE.PointLight(0x5cf2c8, 6, 14, 2);
  glow.position.set(0, 0.6, 0);
  frame.add(glow);
  scene.add(frame);

  const service = buildDrone(1.15, 0xff7a1a);
  service.visible = false;
  scene.add(service);
  const cellMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), cellMat);
  cell.visible = false;
  scene.add(cell);
  const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xffb27a }));
  tether.visible = false;
  scene.add(tether);

  /* ---------- Theme ---------- */
  function applyPalette() {
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const p = PALETTES[theme];
    skyMat.uniforms.top.value.setHex(p.skyTop);
    skyMat.uniforms.bottom.value.setHex(p.skyBottom);
    scene.fog.color.setHex(p.fog);
    scene.fog.density = p.fogDensity;
    renderer.setClearColor(p.fog);
    groundMat.color.setHex(p.ground);
    trunkMat.color.setHex(p.trunk);
    const ca = new THREE.Color(p.leafA), cb = new THREE.Color(p.leafB), c = new THREE.Color();
    for (let i = 0; i < leaves.count; i++) { c.copy(ca).lerp(cb, leafTone[i]); leaves.setColorAt(i, c); }
    leaves.instanceColor.needsUpdate = true;
    hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround); hemi.intensity = p.hemi;
    moon.color.setHex(p.moon); moon.intensity = p.moonI;
    ffMat.uniforms.color.value.setHex(p.firefly);
    ffMat.uniforms.strength.value = theme === 'dark' ? 1 : 0.55;
    starMat.opacity = p.stars;
    stars.visible = p.stars > 0;
    signals.forEach((s) => {
      s.beam.material.uniforms.color.value.setHex(s.found ? 0xffffff : p.beacon);
      s.rings.forEach((r) => r.material.color.setHex(s.found ? 0xffffff : p.beacon));
    });
    renderer.toneMappingExposure = p.exposure;
    spot.intensity = theme === 'dark' ? 40 : 8;
    glow.intensity = theme === 'dark' ? 6 : 1.5;
    palette = p;
  }
  let palette = PALETTES.dark;
  applyPalette();
  new MutationObserver(applyPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Flight state ---------- */
  const state = {
    x: 0, z: -30, alt: 18, yaw: 0, vx: 0, vz: 0, vy: 0, yawRate: 0,
    mode: 'intro', battery: 100, swap: null, bump: 0, target: null, lastInput: 0
  };
  const keys = new Set();
  const touch = { fwd: 0, turn: 0, up: 0 };

  /* Autopilot: a loop through the forest, high above the canopy */
  const route = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 60 + Math.sin(i * 1.7) * 30;
    route.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(route, true, 'catmullrom', 0.5);
  let routeT = 0;

  /* ---------- DOM: HUD ---------- */
  const hud = {
    alt: document.getElementById('hud-alt'), spd: document.getElementById('hud-spd'),
    bat: document.getElementById('hud-bat'), batBar: document.getElementById('hud-bat-bar'),
    found: document.getElementById('hud-found'), mode: document.getElementById('hud-mode'),
    toast: document.getElementById('xp-toast'), radar: document.getElementById('xp-radar'),
    markers: document.getElementById('xp-markers')
  };
  const radarCtx = hud.radar ? hud.radar.getContext('2d') : null;
  const markers = signals.map((s) => {
    const el = document.createElement('div');
    el.className = 'xp-marker';
    el.innerHTML = '<span class="xp-marker-dot"></span><span class="xp-marker-text"></span>';
    hud.markers.appendChild(el);
    return el;
  });

  let toastTimer = null;
  function toast(text, ms) {
    if (!hud.toast) return;
    hud.toast.textContent = text;
    hud.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hud.toast.classList.remove('is-on'), ms || 3200);
  }

  function updateFound() {
    const n = signals.filter((s) => s.found).length;
    if (hud.found) hud.found.textContent = n + ' of ' + signals.length;
    root.classList.toggle('xp-complete', n === signals.length);
    return n;
  }

  function setMode(mode) {
    state.mode = mode;
    root.dataset.mode = mode;
    if (hud.mode) hud.mode.textContent = mode === 'pilot' ? 'Manual' : mode === 'seek' ? 'Autopilot to signal' : 'Autopilot';
  }
  setMode('intro');

  /* Buttons */
  const takeBtn = document.getElementById('xp-take');
  const exitBtn = document.getElementById('xp-exit');
  if (takeBtn) takeBtn.addEventListener('click', () => {
    setMode('pilot');
    state.lastInput = performance.now();
    root.focus({ preventScroll: true });
    toast(isTouch ? 'Left stick to fly, right buttons to climb and descend.' : 'W A S D or arrows to fly. Space to climb, Shift to descend.', 5200);
  });
  if (exitBtn) exitBtn.addEventListener('click', () => { setMode('intro'); keys.clear(); });

  signals.forEach((s) => {
    s.btn.addEventListener('click', () => {
      if (s.found || reduceMotion) { openCard(s.id); return; }
      state.target = s;
      if (state.mode === 'intro') root.classList.add('xp-flying');
      setMode('seek');
      toast('Autopilot: flying to the ' + s.name.toLowerCase() + ' signal.', 2600);
    });
  });

  /* Keyboard */
  const FLIGHT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE'];
  window.addEventListener('keydown', (e) => {
    if (state.mode !== 'pilot' && state.mode !== 'seek') return;
    if (!FLIGHT_KEYS.includes(e.code)) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const dialog = document.getElementById('xp-card');
    if (dialog && dialog.open) return;
    if (!inView) return;
    e.preventDefault();
    if (state.mode === 'seek') setMode('pilot');
    keys.add(e.code);
    state.lastInput = performance.now();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('keydown', (e) => {
    const dialog = document.getElementById('xp-card');
    if (e.key === 'Escape' && state.mode === 'pilot' && !(dialog && dialog.open)) { setMode('intro'); keys.clear(); }
  });
  window.addEventListener('blur', () => keys.clear());

  /* Touch: joystick on the left, climb and descend on the right */
  const stick = document.getElementById('xp-stick');
  const knob = document.getElementById('xp-knob');
  if (stick && knob) {
    let pid = null;
    const move = (e) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
      touch.turn = -dx; touch.fwd = -dy;
      knob.style.transform = 'translate(' + dx * 30 + 'px,' + dy * 30 + 'px)';
      state.lastInput = performance.now();
      if (state.mode === 'seek') setMode('pilot');
    };
    stick.addEventListener('pointerdown', (e) => { pid = e.pointerId; stick.setPointerCapture(pid); move(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
    const end = () => { pid = null; touch.turn = 0; touch.fwd = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  }
  document.querySelectorAll('[data-climb]').forEach((b) => {
    const v = parseFloat(b.dataset.climb);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.up = v; state.lastInput = performance.now(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { touch.up = 0; }));
  });

  /* ---------- Size and visibility ---------- */
  let inView = true, pageVisible = !document.hidden;
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 72 : 60;
    camera.updateProjectionMatrix();
    ffMat.uniforms.scale.value = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  }
  resize();
  window.addEventListener('resize', () => { resize(); renderedStill = false; });
  new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; });

  /* ---------- Collision with trees ---------- */
  function treeCollide() {
    const cx = Math.floor(state.x / GRID), cz = Math.floor(state.z / GRID);
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const list = grid.get(ix + ',' + iz); if (!list) continue;
      for (const t of list) {
        const ground = groundHeight(state.x, state.z);
        const top = t.y + t.h - ground;
        if (state.alt > top) continue;
        const dx = state.x - t.x, dz = state.z - t.z;
        const reach = 1.4 + (t.h * 0.26 * t.w + 1.2) * (1 - Math.max(0, state.alt - (t.y - ground)) / t.h) * 0.8;
        const d = Math.hypot(dx, dz);
        if (d < reach && d > 0.001) {
          state.x = t.x + dx / d * reach; state.z = t.z + dz / d * reach;
          const speed = Math.hypot(state.vx, state.vz);
          state.vx *= -0.3; state.vz *= -0.3;
          if (speed > 3 && state.bump <= 0) { state.bump = 0.35; toast('Branch strike. The frame is fine, the pride less so.', 2200); }
        }
      }
    }
  }

  /* ---------- Mid-air battery swap ---------- */
  function startSwap() {
    state.swap = { t: 0 };
    service.visible = true;
    toast('Battery low. Service drone inbound for a mid-air swap.', 3500);
  }
  function updateSwap(dt, dronePos) {
    const s = state.swap; s.t += dt;
    const fwd = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const dock = dronePos.clone().add(new THREE.Vector3(0, 4.2, 0));
    const away = dronePos.clone().addScaledVector(fwd, -60).add(new THREE.Vector3(0, 40, 0));
    let p;
    if (s.t < 3.5) p = away.clone().lerp(dock, smoothstep(0, 3.5, s.t));
    else if (s.t < 7) p = dock.clone();
    else p = dock.clone().lerp(away, smoothstep(7, 10, s.t));
    service.position.copy(p);
    service.rotation.y = state.yaw;
    service.userData.props.forEach((pr) => { pr.rotation.y += dt * 40; });
    const lower = s.t > 3.8 && s.t < 6.6;
    tether.visible = lower;
    cell.visible = s.t > 3.8 && s.t < 6.2;
    if (lower) {
      const k = smoothstep(3.8, 5.4, s.t);
      const cellPos = p.clone().add(new THREE.Vector3(0, -0.6 - k * 2.9, 0));
      cell.position.copy(cellPos);
      cell.rotation.y = state.yaw;
      const arr = tether.geometry.attributes.position;
      arr.setXYZ(0, p.x, p.y - 0.4, p.z); arr.setXYZ(1, cellPos.x, cellPos.y, cellPos.z); arr.needsUpdate = true;
    }
    if (s.t > 5.6 && state.battery < 99) { state.battery = 100; toast('Mid-air swap complete. Full battery, no landing. That is what Dronergy builds.', 4600); }
    if (s.t > 10) { state.swap = null; service.visible = false; tether.visible = false; cell.visible = false; }
  }

  /* ---------- Collecting signals ---------- */
  function collect(s) {
    s.found = true;
    s.btn.classList.add('is-found');
    s.btn.setAttribute('aria-label', s.name + ' signal, found. Open it.');
    applyPalette();
    const n = updateFound();
    keys.clear(); touch.fwd = touch.turn = touch.up = 0;
    paused = true;
    openCard(s.id, () => {
      paused = false;
      last = performance.now();
      if (n === signals.length) toast('All six signals found. You have seen inside my head. Scroll on for the long version.', 6000);
    });
  }

  /* ---------- Loop ---------- */
  let last = performance.now(), time = 0, paused = false, renderedStill = false;
  const camPos = new THREE.Vector3(0, 30, -70), camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let fpsAvg = 60, lowered = false;

  function step(now) {
    requestAnimationFrame(step);
    if (!inView || !pageVisible) { last = now; return; }
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (paused || reduceMotion) dt = 0;
    if (reduceMotion && renderedStill) return;
    time += dt;

    /* Adapt quality on slow devices */
    if (dt > 0) {
      fpsAvg = fpsAvg * 0.97 + (1 / Math.max(dt, 0.001)) * 0.03;
      if (!lowered && time > 4 && fpsAvg < 32) { lowered = true; renderer.setPixelRatio(1); resize(); }
    }

    /* Inputs */
    let fwdIn = 0, turnIn = 0, upIn = 0;
    if (state.mode === 'pilot') {
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwdIn += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwdIn -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) turnIn += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) turnIn -= 1;
      if (keys.has('Space') || keys.has('KeyE')) upIn += 1;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ')) upIn -= 1;
      fwdIn += touch.fwd; turnIn += touch.turn; upIn += touch.up;
    }

    /* Autopilot: cruise the route, or fly to a chosen signal */
    if (state.mode === 'intro' || state.mode === 'seek') {
      let goal, goalAlt;
      let seekDist = 0;
      if (state.mode === 'seek' && state.target) {
        goal = tmp.set(state.target.x, 0, state.target.z);
        seekDist = Math.hypot(goal.x - state.x, goal.z - state.z);
        goalAlt = seekDist < 30 ? 10 : 24;
      } else {
        routeT = (routeT + dt * 0.012) % 1;
        goal = curve.getPointAt((routeT + 0.02) % 1, tmp);
        goalAlt = 24;
      }
      const want = Math.atan2(goal.x - state.x, goal.z - state.z);
      let diff = want - state.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      turnIn = Math.max(-1, Math.min(1, diff * 2.2));
      fwdIn = state.mode === 'seek' ? (Math.abs(diff) < 0.5 ? Math.min(1.6, 0.25 + seekDist / 25) : 0) : 0.55;
      upIn = Math.max(-1, Math.min(1, (goalAlt - state.alt) * 0.25));
    }

    /* Physics */
    const maxSpeed = state.mode === 'intro' ? 9 : state.mode === 'seek' ? 22 : 15;
    state.yawRate += (turnIn * 1.5 - state.yawRate) * Math.min(1, dt * 4);
    state.yaw += state.yawRate * dt;
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
    state.vx += fx * fwdIn * 14 * dt; state.vz += fz * fwdIn * 14 * dt;
    const drag = Math.pow(0.35, dt);
    state.vx *= drag; state.vz *= drag;
    const sp = Math.hypot(state.vx, state.vz);
    if (sp > maxSpeed) { state.vx *= maxSpeed / sp; state.vz *= maxSpeed / sp; }
    state.vy += (upIn * 7 - state.vy) * Math.min(1, dt * 3);
    state.x += state.vx * dt; state.z += state.vz * dt; state.alt += state.vy * dt;
    state.alt = Math.max(2.2, Math.min(60, state.alt));
    const dist = Math.hypot(state.x, state.z);
    if (dist > 230) {
      state.x *= 230 / dist; state.z *= 230 / dist; state.vx *= 0.5; state.vz *= 0.5;
      if (state.mode === 'pilot') toast('Edge of the test range. Turning back is part of the job.', 2400);
    }
    if (dt > 0) treeCollide();
    state.bump = Math.max(0, state.bump - dt);

    const ground = groundHeight(state.x, state.z);
    frame.position.set(state.x, ground + state.alt + Math.sin(time * 2.1) * 0.08, state.z);
    frame.rotation.y = state.yaw;
    const forwardSpeed = state.vx * fx + state.vz * fz;
    tilt.rotation.x += ((forwardSpeed / maxSpeed) * 0.28 - tilt.rotation.x) * Math.min(1, dt * 5);
    tilt.rotation.z += (-state.yawRate * 0.18 - tilt.rotation.z) * Math.min(1, dt * 5);
    drone.userData.props.forEach((p, i) => { p.rotation.y += dt * (i % 2 ? -42 : 42); });

    /* Battery and the swap */
    if (state.mode !== 'intro' && dt > 0 && !state.swap) state.battery = Math.max(0, state.battery - dt * 0.75);
    if (state.mode === 'intro' && !state.swap && state.battery < 100) state.battery = Math.min(100, state.battery + dt * 4);
    if (!state.swap && state.battery < 18 && state.mode !== 'intro') startSwap();
    if (state.swap) updateSwap(dt, frame.position);

    /* Signals */
    signals.forEach((s) => {
      s.beam.material.uniforms.time.value = time;
      s.rings[0].rotation.z = time * 0.6; s.rings[1].rotation.z = -time * 0.9;
      s.rings[0].position.y = 9 + Math.sin(time * 1.3 + s.x) * 1.2;
      if (!s.found && state.mode !== 'intro') {
        const d = Math.hypot(s.x - state.x, s.z - state.z);
        if (d < 6.5 && state.alt < 34) { if (state.mode === 'seek') setMode('pilot'); state.target = null; collect(s); }
      }
    });

    /* Camera: cinematic orbit in the intro, chase camera when flying */
    const shake = state.bump > 0 ? (Math.random() - 0.5) * state.bump * 1.2 : 0;
    if (state.mode === 'intro') {
      const a = time * 0.05;
      tmp.set(frame.position.x - Math.sin(state.yaw + 0.9 + Math.sin(a) * 0.4) * 22, frame.position.y + 7, frame.position.z - Math.cos(state.yaw + 0.9 + Math.sin(a) * 0.4) * 22);
    } else {
      tmp.set(frame.position.x - fx * 13, frame.position.y + 4.8, frame.position.z - fz * 13);
    }
    const camGround = groundHeight(tmp.x, tmp.z) + 2;
    if (tmp.y < camGround) tmp.y = camGround;
    camPos.lerp(tmp, Math.min(1, dt * 2.4) || 1);
    camLook.lerp(new THREE.Vector3(frame.position.x + fx * 6, frame.position.y + 0.5, frame.position.z + fz * 6), Math.min(1, dt * 4) || 1);
    camera.position.copy(camPos); camera.position.y += shake;
    camera.lookAt(camLook);
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    ffMat.uniforms.time.value = time;

    renderer.render(scene, camera);
    drawHud();
    if (reduceMotion) renderedStill = true;
  }

  /* ---------- HUD ---------- */
  function drawHud() {
    const speed = Math.hypot(state.vx, state.vz);
    if (hud.alt) hud.alt.textContent = state.alt.toFixed(1);
    if (hud.spd) hud.spd.textContent = speed.toFixed(1);
    if (hud.bat) hud.bat.textContent = Math.round(state.battery);
    if (hud.batBar) {
      hud.batBar.style.transform = 'scaleX(' + (state.battery / 100).toFixed(3) + ')';
      hud.batBar.classList.toggle('is-low', state.battery < 25);
    }
    const w = root.clientWidth, h = root.clientHeight;
    signals.forEach((s, i) => {
      const el = markers[i];
      v3.set(s.x, s.y + 26, s.z).project(camera);
      const behind = v3.z > 1;
      const d = Math.hypot(s.x - state.x, s.z - state.z);
      if (behind || d > 200) { el.style.opacity = '0'; return; }
      el.style.opacity = '1';
      el.style.transform = 'translate(' + ((v3.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v3.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
      el.classList.toggle('is-found', s.found);
      el.lastChild.textContent = s.found ? s.name : Math.round(d) + ' m';
    });
    if (radarCtx) {
      const c = radarCtx, R = hud.radar.width / 2;
      c.clearRect(0, 0, R * 2, R * 2);
      const styles = getComputedStyle(root);
      const ink = styles.getPropertyValue('--xp-ink').trim() || '#e6f4f1';
      const acc = styles.getPropertyValue('--xp-accent').trim() || '#5cf2c8';
      c.strokeStyle = ink; c.globalAlpha = 0.25; c.lineWidth = 1.5;
      [1, 0.66, 0.33].forEach((k) => { c.beginPath(); c.arc(R, R, (R - 3) * k, 0, Math.PI * 2); c.stroke(); });
      c.beginPath(); c.moveTo(R, 3); c.lineTo(R, R * 2 - 3); c.moveTo(3, R); c.lineTo(R * 2 - 3, R); c.stroke();
      const sweep = (time * 1.4) % (Math.PI * 2);
      c.globalAlpha = 0.18; c.fillStyle = acc; c.beginPath(); c.moveTo(R, R); c.arc(R, R, R - 3, sweep - 0.6, sweep); c.closePath(); c.fill();
      c.globalAlpha = 1;
      const scale = (R - 8) / 230;
      signals.forEach((s) => {
        const dx = s.x - state.x, dz = s.z - state.z;
        const rx = dx * Math.cos(-state.yaw) - dz * Math.sin(-state.yaw);
        const rz = dx * Math.sin(-state.yaw) + dz * Math.cos(-state.yaw);
        let px = -rx * scale, py = -rz * scale;
        const len = Math.hypot(px, py); if (len > R - 8) { px *= (R - 8) / len; py *= (R - 8) / len; }
        c.fillStyle = s.found ? ink : acc;
        c.globalAlpha = s.found ? 0.5 : 1;
        c.beginPath(); c.arc(R + px, R + py, s.found ? 3 : 4.5, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1; c.fillStyle = ink;
      c.beginPath(); c.moveTo(R, R - 7); c.lineTo(R + 5, R + 5); c.lineTo(R, R + 2); c.lineTo(R - 5, R + 5); c.closePath(); c.fill();
    }
  }

  updateFound();
  root.classList.add('xp-ready');
  if (reduceMotion) {
    /* One still frame from a good angle; the signals work as plain buttons. */
    root.classList.add('xp-still');
    camPos.set(-30, 30, -70);
  }
  requestAnimationFrame((t) => { last = t; step(t); });
}

if (root && canvas) {
  if (!webglAvailable()) {
    root.classList.add('xp-static');
    setupStaticSignals();
  } else {
    try { start(); } catch (e) { root.classList.add('xp-static'); setupStaticSignals(); }
  }
}
