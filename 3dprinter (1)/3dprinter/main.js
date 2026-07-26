// ==========================================
// V3NOM LABZ — Hero 3D Printer Scene
// ==========================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Split hero headline into per-word spans ----------
function splitWordsForAnimation(el) {
  let counter = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(node => {
    if (!node.textContent.trim()) return;
    const parts = node.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        const outer = document.createElement('span');
        outer.className = 'word';
        outer.style.setProperty('--i', counter++);
        const inner = document.createElement('span');
        inner.textContent = part;
        outer.appendChild(inner);
        frag.appendChild(outer);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
}
document.querySelectorAll('[data-split]').forEach(el => {
  splitWordsForAnimation(el);
  el.classList.add('split-ready');
});

const canvas = document.getElementById('hero-canvas');
const wrap = canvas.parentElement;

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0a0a, 15, 42);

const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
camera.position.set(7, 5.5, 8);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.target.set(0, 1.8, 0);

// ---------- Lighting ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x808080, 0x0a0a0a, 0.35);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(6, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 30;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(-6, 4, -4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xd4ff00, 0.9);
rim.position.set(-4, 2, 6);
scene.add(rim);

// Accent point light that pulses
const pl1 = new THREE.PointLight(0xd4ff00, 1.8, 10);
pl1.position.set(2, 3, 2);
scene.add(pl1);

// ---------- Ground / Grid ----------
const gridSize = 40;
const grid = new THREE.GridHelper(gridSize, gridSize, 0x555555, 0x2a2a2a);
grid.material.transparent = true;
grid.material.opacity = 0.55;
grid.position.y = 0.001;
scene.add(grid);

// Shadow-only floor (invisible except for shadows) — clean studio look
const floorGeom = new THREE.PlaneGeometry(gridSize, gridSize);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 });
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ==========================================
// 3D PRINTER MODEL (assembled from primitives)
// ==========================================
const printer = new THREE.Group();
scene.add(printer);

const frameColor = 0x1e1e1e;
const railColor = 0x3a3a3a;
const accentColor = 0xd4ff00;

const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.55, roughness: 0.42 });
const railMat  = new THREE.MeshStandardMaterial({ color: railColor,  metalness: 0.8,  roughness: 0.3 });
const accentMat = new THREE.MeshStandardMaterial({
  color: accentColor,
  emissive: accentColor,
  emissiveIntensity: 1.4,
  metalness: 0.2,
  roughness: 0.5
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.05,
  transmission: 0.9, thickness: 0.5, transparent: true, opacity: 0.15
});

// --- Base ---
const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 4.2), frameMat);
base.position.y = 0.2;
base.castShadow = true; base.receiveShadow = true;
printer.add(base);

// Base accent stripe
const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.05), accentMat);
stripe.position.set(0, 0.42, 2.05);
printer.add(stripe);

// --- Vertical frame posts (4 corners) ---
const postGeom = new THREE.BoxGeometry(0.25, 5.5, 0.25);
const postPositions = [
  [-2.4, 3.15,  1.9],
  [ 2.4, 3.15,  1.9],
  [-2.4, 3.15, -1.9],
  [ 2.4, 3.15, -1.9]
];
postPositions.forEach(p => {
  const post = new THREE.Mesh(postGeom, frameMat);
  post.position.set(...p);
  post.castShadow = true;
  printer.add(post);
});

// --- Top frame bars ---
const topBarX = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.25, 0.25), frameMat);
topBarX.position.set(0, 5.9,  1.9); printer.add(topBarX);
const topBarX2 = topBarX.clone(); topBarX2.position.z = -1.9; printer.add(topBarX2);
const topBarZ = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4.05), frameMat);
topBarZ.position.set(-2.4, 5.9, 0); printer.add(topBarZ);
const topBarZ2 = topBarZ.clone(); topBarZ2.position.x = 2.4; printer.add(topBarZ2);

// --- Print bed ---
const bedBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 3), new THREE.MeshStandardMaterial({ color: 0x0a0a0f, metalness: 0.5, roughness: 0.4 }));
bedBase.position.y = 0.55;
bedBase.receiveShadow = true;
printer.add(bedBase);

const bedGlass = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 2.9), new THREE.MeshPhysicalMaterial({
  color: 0x0a1a14, emissive: 0xd4ff00, emissiveIntensity: 0.15,
  metalness: 0.1, roughness: 0.15, clearcoat: 0.6
}));
bedGlass.position.y = 0.65;
bedGlass.receiveShadow = true;
printer.add(bedGlass);

// Bed grid lines (glowing)
const bedGrid = new THREE.GridHelper(3.5, 14, 0xd4ff00, 0xd4ff00);
bedGrid.material.transparent = true;
bedGrid.material.opacity = 0.28;
bedGrid.position.y = 0.68;
bedGrid.scale.z = 2.9 / 3.5;
printer.add(bedGrid);

// --- X-axis gantry (moves in Y over time) ---
const gantry = new THREE.Group();
printer.add(gantry);

const xRail = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.18, 0.18), railMat);
gantry.add(xRail);

const xRailBack = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 0.14), railMat);
xRailBack.position.z = -0.35;
gantry.add(xRailBack);

// Belt (accent)
const belt = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0xd4ff00, emissive: 0xd4ff00, emissiveIntensity: 0.6 }));
belt.position.y = 0.12;
gantry.add(belt);

gantry.position.y = 3.0;

// --- Print head (moves along X on gantry) ---
const head = new THREE.Group();
gantry.add(head);

const headBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), frameMat);
headBody.position.y = -0.05;
headBody.castShadow = true;
head.add(headBody);

// Head accent panel
const headPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), accentMat);
headPanel.position.set(0, 0.05, 0.36);
head.add(headPanel);

// Nozzle (cone pointing down)
const nozzle = new THREE.Mesh(
  new THREE.ConeGeometry(0.09, 0.28, 16),
  new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.2 })
);
nozzle.rotation.x = Math.PI;
nozzle.position.y = -0.52;
head.add(nozzle);

// Heater block (glowing red)
const heater = new THREE.Mesh(
  new THREE.BoxGeometry(0.35, 0.18, 0.25),
  new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xff2222, emissiveIntensity: 0.8 })
);
heater.position.y = -0.35;
head.add(heater);

// Filament tube going up
const filament = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 3, 12),
  new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.6 })
);
filament.position.set(-0.25, 1.4, 0);
head.add(filament);

// Filament spool (right side of printer)
const spoolGroup = new THREE.Group();
spoolGroup.position.set(-3.3, 4.2, 0);
spoolGroup.rotation.z = Math.PI / 2;
printer.add(spoolGroup);

const spoolCore = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 24), frameMat);
spoolGroup.add(spoolCore);
const spoolOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.55, 32), new THREE.MeshStandardMaterial({
  color: accentColor, emissive: accentColor, emissiveIntensity: 0.25, transparent: true, opacity: 0.9
}));
spoolGroup.add(spoolOuter);
const spoolSide1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 32), frameMat);
spoolSide1.position.y = 0.3; spoolGroup.add(spoolSide1);
const spoolSide2 = spoolSide1.clone(); spoolSide2.position.y = -0.3; spoolGroup.add(spoolSide2);

// --- Display screen (front left) ---
const screenGroup = new THREE.Group();
screenGroup.position.set(-1.8, 1.2, 2.15);
printer.add(screenGroup);
const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), frameMat);
screenGroup.add(screenBezel);
const screenGlass = new THREE.Mesh(
  new THREE.PlaneGeometry(1.05, 0.55),
  new THREE.MeshStandardMaterial({ color: 0x001a10, emissive: 0xd4ff00, emissiveIntensity: 0.5 })
);
screenGlass.position.z = 0.06;
screenGroup.add(screenGlass);

// Screen "text" bars
for (let i = 0; i < 3; i++) {
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xd4ff00 })
  );
  bar.position.set(-0.1, 0.15 - i * 0.15, 0.07);
  screenGroup.add(bar);
}

// --- Print in progress (layers being added) ---
const printedPart = new THREE.Group();
printedPart.position.y = 0.7;
printer.add(printedPart);

const partMat = new THREE.MeshStandardMaterial({
  color: 0xd4ff00,
  emissive: 0x556600,
  emissiveIntensity: 0.35,
  metalness: 0.1,
  roughness: 0.5
});

const totalLayers = 40;
const layerHeight = 0.055;
const layers = [];
for (let i = 0; i < totalLayers; i++) {
  // Layer is a twisted, tapering shape — looks like a vase
  const t = i / totalLayers;
  const radius = 0.6 - Math.sin(t * Math.PI) * 0.15 + t * 0.1;
  const geom = new THREE.CylinderGeometry(radius, radius + 0.02, layerHeight, 24);
  const layer = new THREE.Mesh(geom, partMat);
  layer.position.y = i * layerHeight;
  layer.rotation.y = t * Math.PI * 1.5; // twist
  layer.castShadow = true;
  layer.visible = false;
  printedPart.add(layer);
  layers.push(layer);
}

// Wireframe overlay on the current top layer for a "just printed" effect
const wireHelper = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.6, 0.6, layerHeight, 24)),
  new THREE.LineBasicMaterial({ color: 0xd4ff00, transparent: true, opacity: 0.9 })
);
wireHelper.visible = false;
printedPart.add(wireHelper);

// ==========================================
// Animation
// ==========================================
let currentLayer = 0;
let layerProgress = 0;
let headTargetX = 0;
let clock = new THREE.Clock();

// Camera intro
camera.position.set(14, 8, 14);
const introTargetPos = new THREE.Vector3(7, 5.5, 8);
let introT = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Intro camera glide
  if (introT < 1) {
    introT = Math.min(introT + dt * 0.5, 1);
    const e = 1 - Math.pow(1 - introT, 3);
    camera.position.lerpVectors(new THREE.Vector3(14, 8, 14), introTargetPos, e);
  }

  // Head sweeps back and forth (X axis)
  headTargetX = Math.sin(time * 1.6) * 1.4;
  head.position.x = headTargetX;

  // Second axis sweep (front-back tracing motion)
  head.position.z = Math.sin(time * 3.2) * 0.7;

  // Gantry rises as layers build
  const targetY = 3.0 + currentLayer * layerHeight * 0.5;
  gantry.position.y += (targetY - gantry.position.y) * 0.05;

  // Progressive layer reveal
  layerProgress += dt * 0.9;
  if (layerProgress >= 1 && currentLayer < totalLayers) {
    layers[currentLayer].visible = true;
    // Flash the wire helper on the newest layer
    wireHelper.position.copy(layers[currentLayer].position);
    wireHelper.rotation.copy(layers[currentLayer].rotation);
    wireHelper.geometry.dispose();
    const t = currentLayer / totalLayers;
    const r = 0.6 - Math.sin(t * Math.PI) * 0.15 + t * 0.1;
    wireHelper.geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r + 0.02, layerHeight, 24));
    wireHelper.visible = true;
    currentLayer++;
    layerProgress = 0;
  }

  // Fade wire helper
  wireHelper.material.opacity = Math.max(0, 0.9 - layerProgress * 1.5);

  // Reset print cycle
  if (currentLayer >= totalLayers) {
    // Wait a beat, then hide all and restart
    if (layerProgress > 3) {
      layers.forEach(l => l.visible = false);
      currentLayer = 0;
      layerProgress = 0;
    }
  }

  // Pulse accent lights
  pl1.intensity = 1.2 + Math.sin(time * 2) * 0.4;
  accentMat.emissiveIntensity = 1.2 + Math.sin(time * 2.5) * 0.3;

  // Belt scroll effect (subtle)
  belt.material.emissiveIntensity = 0.4 + Math.sin(time * 8) * 0.2;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ==========================================
// Resize handling
// ==========================================
function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// ==========================================
// UX niceties — cursor glow, year, smooth scroll
// ==========================================
const glow = document.getElementById('cursorGlow');
if (glow && window.matchMedia('(pointer: fine)').matches) {
  document.addEventListener('mousemove', (e) => {
    glow.style.opacity = '1';
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
}

document.getElementById('year').textContent = new Date().getFullYear();

// Nav auto-hide on scroll down (subtle)
let lastY = 0;
const nav = document.querySelector('.nav');
let navScrollY = 0;
window.addEventListener('scroll', () => {
  navScrollY = window.scrollY;
  nav.style.transform = (navScrollY > 100 && navScrollY > lastY) ? 'translateY(-100%)' : 'translateY(0)';
  nav.style.transition = 'transform 0.3s';
  lastY = navScrollY;
}, { passive: true });

// ==========================================
// PARALLAX + ANIMATIONS
// ==========================================

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- IntersectionObserver: reveal on scroll ----
const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
if (revealEls.length) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });
  revealEls.forEach(el => revealObs.observe(el));
}

// ---- Number counter (fires when hero stats scroll into view or on load if already visible) ----
const counterEls = document.querySelectorAll('[data-count]');
if (counterEls.length) {
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const duration = 1600;
      const startTime = performance.now();
      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = target * eased;
        el.textContent = val.toFixed(decimals) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target.toFixed(decimals) + suffix;
      }
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.4 });
  counterEls.forEach(el => counterObs.observe(el));
}

// ---- Scroll + mouse parallax loop ----
if (!prefersReduced) {
  const heroCanvasEl = document.querySelector('.hero-canvas-wrap');
  const heroTextEl   = document.querySelector('.hero-text');

  let sY = 0;
  let mX = 0, mY = 0;
  let cX = 0, cY = 0;

  window.addEventListener('scroll', () => { sY = window.scrollY; }, { passive: true });

  const canvasHost = heroCanvasEl;
  if (canvasHost && window.matchMedia('(pointer: fine)').matches) {
    canvasHost.addEventListener('mousemove', (e) => {
      const rect = canvasHost.getBoundingClientRect();
      mX = (e.clientX - rect.left) / rect.width - 0.5;
      mY = (e.clientY - rect.top) / rect.height - 0.5;
    });
    canvasHost.addEventListener('mouseleave', () => { mX = 0; mY = 0; });
  }

  // Wait until hero intro animations settle (~2s) before we start applying transforms
  // to hero-canvas-wrap — otherwise CSS keyframes fight the JS transform.
  let started = false;
  setTimeout(() => { started = true; }, 1900);

  let pT0 = performance.now();
  function parallaxLoop(now) {
    const time = (now - pT0) / 1000;

    // Damp mouse
    cX += (mX - cX) * 0.07;
    cY += (mY - cY) * 0.07;

    // Hero text moves slower than scroll — depth effect
    if (heroTextEl) heroTextEl.style.transform = `translate3d(0, ${sY * 0.18}px, 0)`;

    // Canvas: scroll parallax + mouse tilt (wait for intro)
    if (started && heroCanvasEl) {
      heroCanvasEl.style.transform =
        `translate3d(0, ${sY * -0.12}px, 0) perspective(1200px) rotateX(${-cY * 4}deg) rotateY(${cX * 3.5}deg)`;
    }


    requestAnimationFrame(parallaxLoop);
  }
  requestAnimationFrame(parallaxLoop);
}

// ---- Card / step 3D tilt on hover ----
if (window.matchMedia('(pointer: fine)').matches && !prefersReduced) {
  document.querySelectorAll('.card, .step').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}
