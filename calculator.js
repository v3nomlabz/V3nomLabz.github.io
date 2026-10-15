// ==========================================
// V3NOM LABZ — STL viewer + cost calculator
// ==========================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// -----------------------------------------------------
// State (single source of truth for pricing — all values in INR)
// -----------------------------------------------------
const state = {
  volumeCm3: 0,          // pre-infill solid volume in cm³
  boundingBox: null,     // THREE.Box3
  triangles: 0,
  material: { key: 'pla', pricePerG: 5, densityGcm3: 1.24, label: 'PLA' },
  quality:  { key: 'standard', mult: 1.0, layer: 0.20 },
  infill: 20,            // %
  quantity: 1,
  rush: false,
  hasFile: false,
  wireframe: false
};

// Pricing constants (₹ INR)
const SETUP_FEE = 400;                    // ₹400 setup + finishing
const MACHINE_RATE_PER_HR = 300;          // ₹300 / hour of print time
const BASE_PRINT_SPEED_MMPS = 60;         // theoretical
const INFILL_SHELL_RATIO = 0.35;          // portion of volume that's always solid (shells+top/bottom)

// Currency formatter — Indian numbering (₹1,23,456)
const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// -----------------------------------------------------
// Viewer scene setup
// -----------------------------------------------------
const canvas = document.getElementById('viewer-canvas');
const viewerBody = canvas.parentElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewerBody.clientWidth, viewerBody.clientHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, viewerBody.clientWidth / viewerBody.clientHeight, 0.1, 2000);
camera.position.set(120, 100, 140);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);

// Lights (studio product photography, dark theme)
scene.add(new THREE.AmbientLight(0xffffff, 0.42));
scene.add(new THREE.HemisphereLight(0x808080, 0x0a0a0a, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(100, 200, 100);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -200;
key.shadow.camera.right = key.shadow.camera.top = 200;
key.shadow.camera.near = 1; key.shadow.camera.far = 800;
scene.add(key);
const rim = new THREE.DirectionalLight(0xd4ff00, 0.55);
rim.position.set(-100, 60, -80);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(50, 30, -80);
scene.add(fill);

// Ground plane w/ grid
const groundGeom = new THREE.PlaneGeometry(600, 600);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(600, 30, 0x555555, 0x2a2a2a);
grid.material.transparent = true;
grid.material.opacity = 0.55;
grid.position.y = 0.1;
scene.add(grid);

// Empty-state placeholder — lime wireframe cube on dark
const placeholder = new THREE.Group();
const cubeGeom = new THREE.BoxGeometry(60, 60, 60);
const cubeWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(cubeGeom),
  new THREE.LineBasicMaterial({ color: 0xd4ff00, transparent: true, opacity: 0.75 })
);
placeholder.add(cubeWire);
const cubeSolid = new THREE.Mesh(cubeGeom, new THREE.MeshStandardMaterial({
  color: 0xd4ff00, transparent: true, opacity: 0.06,
  emissive: 0xd4ff00, emissiveIntensity: 0.15, roughness: 0.6
}));
placeholder.add(cubeSolid);
placeholder.position.y = 40;
scene.add(placeholder);

// The active mesh (loaded STL)
let currentMesh = null;
const modelMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4ff00,
  metalness: 0.1,
  roughness: 0.55,
  flatShading: false
});
const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0xd4ff00, wireframe: true, transparent: true, opacity: 0.85
});

function render() {
  controls.update();
  if (placeholder.visible) {
    placeholder.rotation.y += 0.005;
    placeholder.rotation.x += 0.002;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

function resize() {
  const w = viewerBody.clientWidth;
  const h = viewerBody.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);

// -----------------------------------------------------
// STL upload + parse
// -----------------------------------------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const loaderEl = document.getElementById('viewer-loader');
const viewerTitle = document.getElementById('viewer-title');

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

['dragenter', 'dragover'].forEach(ev => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(ev => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
});
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.stl')) {
    alert('Please upload a .stl file');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    alert('File too large — 50MB max');
    return;
  }
  loaderEl.classList.add('active');
  viewerTitle.textContent = file.name.toUpperCase();

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const loader = new STLLoader();
      const geometry = loader.parse(e.target.result);
      loadGeometry(geometry, file.name);
    } catch (err) {
      console.error('STL parse error', err);
      alert('Failed to parse STL — is the file valid?');
      loaderEl.classList.remove('active');
    }
  };
  reader.onerror = () => {
    alert('File read failed');
    loaderEl.classList.remove('active');
  };
  reader.readAsArrayBuffer(file);
}

function loadGeometry(geometry, filename) {
  // Remove previous mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  // Center at origin, sit on ground plane
  const bbox = geometry.boundingBox;
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  geometry.translate(-center.x, -bbox.min.y, -center.z);
  geometry.computeBoundingBox();

  currentMesh = new THREE.Mesh(geometry, state.wireframe ? wireMaterial : modelMaterial);
  currentMesh.castShadow = true;
  currentMesh.receiveShadow = true;
  scene.add(currentMesh);

  // Hide placeholder, dropzone
  placeholder.visible = false;
  dropzone.classList.add('hidden');

  // Compute stats
  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  const volume = computeVolume(geometry);      // in whatever unit STL is in — assume mm
  const volumeCm3 = volume / 1000;              // mm³ → cm³
  const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

  state.volumeCm3 = volumeCm3;
  state.boundingBox = geometry.boundingBox.clone();
  state.triangles = tris | 0;
  state.hasFile = true;

  // Frame the model in the camera
  frameObject(currentMesh);

  // Update stats UI
  document.getElementById('stat-tris').textContent = state.triangles.toLocaleString();
  document.getElementById('stat-vol').textContent  = volumeCm3.toFixed(2) + ' cm³';
  document.getElementById('stat-dim').textContent  =
    `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;
  document.getElementById('stat-wgt').textContent  =
    (volumeCm3 * state.material.densityGcm3).toFixed(1) + ' g';

  loaderEl.classList.remove('active');
  updatePrice();

  // Enable order button
  const orderBtn = document.getElementById('order-btn');
  orderBtn.disabled = false;
  orderBtn.querySelector('span, svg')?.remove?.();
  orderBtn.innerHTML = 'Place Order <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
}

function frameObject(mesh) {
  const bbox = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3(); bbox.getSize(size);
  const center = new THREE.Vector3(); bbox.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 2.2;
  camera.position.set(dist, dist * 0.85, dist);
  controls.target.copy(center);
  controls.update();
}

// -----------------------------------------------------
// Volume via signed-tetrahedron sum
// (works for closed manifold meshes; approximate otherwise)
// -----------------------------------------------------
function computeVolume(geometry) {
  const posAttr = geometry.attributes.position;
  const index = geometry.index;
  let volume = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  const triCount = index ? index.count / 3 : posAttr.count / 3;
  for (let i = 0; i < triCount; i++) {
    if (index) {
      a.fromBufferAttribute(posAttr, index.getX(i * 3));
      b.fromBufferAttribute(posAttr, index.getX(i * 3 + 1));
      c.fromBufferAttribute(posAttr, index.getX(i * 3 + 2));
    } else {
      a.fromBufferAttribute(posAttr, i * 3);
      b.fromBufferAttribute(posAttr, i * 3 + 1);
      c.fromBufferAttribute(posAttr, i * 3 + 2);
    }
    // Signed volume of tetrahedron formed by triangle and origin
    volume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }
  return Math.abs(volume);
}

// -----------------------------------------------------
// Viewer controls (wireframe / reset / clear)
// -----------------------------------------------------
document.getElementById('btn-wire').addEventListener('click', (e) => {
  state.wireframe = !state.wireframe;
  e.currentTarget.classList.toggle('active', state.wireframe);
  if (currentMesh) currentMesh.material = state.wireframe ? wireMaterial : modelMaterial;
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (currentMesh) frameObject(currentMesh);
  else { camera.position.set(120, 100, 140); controls.target.set(0, 0, 0); }
});
document.getElementById('btn-clear').addEventListener('click', clearFile);

function clearFile() {
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh = null;
  }
  placeholder.visible = true;
  dropzone.classList.remove('hidden');
  fileInput.value = '';
  viewerTitle.textContent = 'MODEL PREVIEW';

  state.hasFile = false;
  state.volumeCm3 = 0;
  state.triangles = 0;

  document.getElementById('stat-tris').textContent = '—';
  document.getElementById('stat-vol').textContent = '—';
  document.getElementById('stat-dim').textContent = '—';
  document.getElementById('stat-wgt').textContent = '—';

  camera.position.set(120, 100, 140);
  controls.target.set(0, 0, 0);

  const orderBtn = document.getElementById('order-btn');
  orderBtn.disabled = true;
  orderBtn.innerHTML = 'Upload a file to order <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  updatePrice();
}

// -----------------------------------------------------
// Config UI wiring
// -----------------------------------------------------
// Material selector
document.getElementById('material-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.mat');
  if (!btn) return;
  document.querySelectorAll('.mat').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.material = {
    key: btn.dataset.mat,
    pricePerG: parseFloat(btn.dataset.price),
    densityGcm3: parseFloat(btn.dataset.density),
    label: btn.querySelector('.mat-name').textContent
  };
  // Refresh weight stat
  if (state.hasFile) {
    document.getElementById('stat-wgt').textContent =
      (state.volumeCm3 * state.material.densityGcm3).toFixed(1) + ' g';
  }
  updatePrice();
});
// Default active
document.querySelector('.mat[data-mat="pla"]').classList.add('active');

// Quality segmented
document.getElementById('quality-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#quality-seg button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.quality = {
    key: btn.dataset.q,
    mult: parseFloat(btn.dataset.mult),
    layer: parseFloat(btn.dataset.layer)
  };
  updatePrice();
});

// Infill slider
const infillEl = document.getElementById('infill');
const infillVal = document.getElementById('infill-val');
infillEl.addEventListener('input', () => {
  state.infill = parseInt(infillEl.value, 10);
  infillVal.textContent = state.infill + '%';
  updatePrice();
});

// Quantity
const qtyEl = document.getElementById('qty');
document.getElementById('qty-minus').addEventListener('click', () => {
  qtyEl.value = Math.max(1, parseInt(qtyEl.value, 10) - 1);
  state.quantity = parseInt(qtyEl.value, 10);
  updatePrice();
});
document.getElementById('qty-plus').addEventListener('click', () => {
  qtyEl.value = Math.min(999, parseInt(qtyEl.value, 10) + 1);
  state.quantity = parseInt(qtyEl.value, 10);
  updatePrice();
});
qtyEl.addEventListener('input', () => {
  const v = parseInt(qtyEl.value, 10);
  state.quantity = isNaN(v) || v < 1 ? 1 : Math.min(v, 999);
  updatePrice();
});

// Rush
document.getElementById('rush').addEventListener('change', (e) => {
  state.rush = e.target.checked;
  updatePrice();
});

// Order button
document.getElementById('order-btn').addEventListener('click', () => {
  if (!state.hasFile) return;
  const total = document.getElementById('p-total').textContent;
  alert(
    `Order received — ${total}\n\n` +
    `Material: ${state.material.label}\n` +
    `Quality: ${state.quality.key} (${state.quality.layer}mm)\n` +
    `Infill: ${state.infill}%\n` +
    `Quantity: ${state.quantity}\n` +
    `Rush: ${state.rush ? 'Yes' : 'No'}\n\n` +
    `A V3nom Labz specialist will confirm your quote via email shortly.`
  );
});

// -----------------------------------------------------
// Price calculation
// -----------------------------------------------------
function updatePrice() {
  if (!state.hasFile) {
    document.getElementById('p-material').textContent = fmt(0);
    document.getElementById('p-machine').textContent = fmt(0);
    document.getElementById('p-time-h').textContent = '0h 0m';
    document.getElementById('p-setup').textContent   = fmt(SETUP_FEE);
    document.getElementById('p-rush').textContent    = fmt(0);
    document.getElementById('p-total').textContent   = fmt(0);
    document.getElementById('p-qty').textContent     = '×' + state.quantity;
    return;
  }

  // Effective volume factoring in infill
  // Shells + top/bottom are always solid (~35% of the vol), rest scales with infill
  const solidPortion = INFILL_SHELL_RATIO + (1 - INFILL_SHELL_RATIO) * (state.infill / 100);
  const effectiveVolCm3 = state.volumeCm3 * solidPortion;

  // Weight
  const weightG = effectiveVolCm3 * state.material.densityGcm3;

  // Material cost
  const materialCost = weightG * state.material.pricePerG;

  // Machine time: derived from volume + quality multiplier
  // baseline speed prints ~15 cm³/hour at standard quality
  const baseCm3PerHour = 15;
  const printHours = (effectiveVolCm3 / baseCm3PerHour) * state.quality.mult;
  const printMinutes = printHours * 60;
  const machineCost = printHours * MACHINE_RATE_PER_HR;

  const subtotal = materialCost + machineCost + SETUP_FEE;
  const rushSurcharge = state.rush ? subtotal * 0.40 : 0;
  const perUnit = subtotal + rushSurcharge;
  const total = perUnit * state.quantity;

  // Render
  document.getElementById('p-material').textContent = fmt(materialCost);
  document.getElementById('p-machine').textContent = fmt(machineCost);
  document.getElementById('p-setup').textContent = fmt(SETUP_FEE);
  document.getElementById('p-rush').textContent = fmt(rushSurcharge);
  document.getElementById('p-total').textContent = fmt(total);
  document.getElementById('p-qty').textContent = '×' + state.quantity;

  const h = Math.floor(printMinutes / 60);
  const m = Math.round(printMinutes % 60);
  document.getElementById('p-time-h').textContent = `${h}h ${m}m`;
}

// Initial paint
updatePrice();
