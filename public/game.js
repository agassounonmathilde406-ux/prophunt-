// game.js — Etape 1 : deplacement 3D multijoueur en temps reel.
// Pas encore de mecanique de jeu (props/hunters/armes), juste la base :
// se voir bouger les uns les autres, en 3D, avec des controles tactiles.

const statusEl = document.getElementById('status');

if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(10, 20, 10);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x4caf50 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(200, 100, 0x2e7d32, 0x2e7d32));

function addDecorBox(x, z, size, color) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color })
  );
  box.position.set(x, size / 2, z);
  scene.add(box);
}
addDecorBox(5, 5, 2, 0x8d6e63);
addDecorBox(-6, 3, 1.5, 0xffb74d);
addDecorBox(3, -7, 2.5, 0x90a4ae);
addDecorBox(-4, -4, 1, 0xef5350);

function makePlayerMesh(color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });

  const legGeo = new THREE.BoxGeometry(0.28, 0.8, 0.28);
  const legL = new THREE.Mesh(legGeo, bodyMat); legL.position.set(-0.16, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, bodyMat); legR.position.set(0.16, 0.4, 0);
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), bodyMat);
  torso.position.y = 1.2;
  group.add(torso);

  const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
  const armL = new THREE.Mesh(armGeo, bodyMat); armL.position.set(-0.425, 1.2, 0);
  const armR = new THREE.Mesh(armGeo, bodyMat); armR.position.set(0.425, 1.2, 0);
  group.add(armL, armR);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
  head.position.y = 1.85;
  group.add(head);

  return group;
}

const localState = { x: 0, y: 0, z: 0, rotY: 0 };
let myId = null;
let localMesh = null;
const others = {};

let cameraYaw = 0;
const CAMERA_DISTANCE = 6;
const CAMERA_HEIGHT = 3;

function updateCamera() {
  const camX = localState.x - Math.sin(cameraYaw) * CAMERA_DISTANCE;
  const camZ = localState.z - Math.cos(cameraYaw) * CAMERA_DISTANCE;
  camera.position.set(camX, localState.y + CAMERA_HEIGHT, camZ);
  camera.lookAt(localState.x, localState.y + 1.3, localState.z);
}

function setupVirtualJoystick(zoneEl, baseEl, stickEl, onMove, onEnd) {
  let active = false;
  let touchId = null;
  let originX = 0, originY = 0;

  zoneEl.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    active = true;
    touchId = t.identifier;
    originX = t.clientX;
    originY = t.clientY;
    if (baseEl) {
      baseEl.style.left = `${originX - 50}px`;
      baseEl.style.top = `${originY - 50}px`;
      baseEl.style.display = 'block';
    }
    if (stickEl) {
      stickEl.style.left = `${originX - 23}px`;
      stickEl.style.top = `${originY - 23}px`;
      stickEl.style.display = 'block';
    }
  }, { passive: true });

  zoneEl.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = [...e.changedTouches].find((t) => t.identifier === touchId);
    if (!t) return;
    let dx = t.clientX - originX;
    let dy = t.clientY - originY;
    const max = 50;
    const dist = Math.min(Math.hypot(dx, dy), max);
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    if (stickEl) {
      stickEl.style.left = `${originX + dx - 23}px`;
      stickEl.style.top = `${originY + dy - 23}px`;
    }
    onMove(dx / max, dy / max);
  }, { passive: true });

  function end(e) {
    if (!active) return;
    const t = [...e.changedTouches].find((t) => t.identifier === touchId);
    if (touchId !== null && !t) return;
    active = false;
    touchId = null;
    if (baseEl) baseEl.style.display = 'none';
    if (stickEl) stickEl.style.display = 'none';
    onEnd();
  }
  zoneEl.addEventListener('touchend', end, { passive: true });
  zoneEl.addEventListener('touchcancel', end, { passive: true });
}

let moveVec = { x: 0, y: 0 };
setupVirtualJoystick(
  document.getElementById('joystick-zone'),
  document.getElementById('joystick-base'),
  document.getElementById('joystick-stick'),
  (dx, dy) => { moveVec = { x: dx, y: dy }; },
  () => { moveVec = { x: 0, y: 0 }; }
);

let lookDelta = 0;
setupVirtualJoystick(
  document.getElementById('look-zone'),
  null,
  null,
  (dx) => { lookDelta = dx * 0.05; },
  () => { lookDelta = 0; }
);

const socket = io();

socket.on('connect', () => { statusEl.textContent = 'Connecté'; });
socket.on('disconnect', () => { statusEl.textContent = 'Déconnecté — reconnexion…'; });

socket.on('init', (data) => {
  myId = data.id;
  localState.x = data.players[myId].x;
  localState.z = data.players[myId].z;
  localMesh = makePlayerMesh(data.players[myId].color);
  localMesh.position.set(localState.x, 0, localState.z);
  scene.add(localMesh);
  Object.values(data.players).forEach((p) => {
    if (p.id === myId) return;
    addOtherPlayer(p);
  });
  statusEl.textContent = `Connecté — ${Object.keys(data.players).length} joueur(s)`;
});

socket.on('player_joined', (p) => { addOtherPlayer(p); });

socket.on('player_moved', (p) => {
  const o = others[p.id];
  if (!o) return;
  o.target.x = p.x; o.target.y = p.y; o.target.z = p.z; o.target.rotY = p.rotY;
});

socket.on('player_left', (id) => {
  const o = others[id];
  if (!o) return;
  scene.remove(o.mesh);
  delete others[id];
});

function addOtherPlayer(p) {
  if (others[p.id] || p.id === myId) return;
  const mesh = makePlayerMesh(p.color);
  mesh.position.set(p.x, 0, p.z);
  scene.add(mesh);
  others[p.id] = { mesh, target: { x: p.x, y: p.y, z: p.z, rotY: p.rotY } };
}

setInterval(() => {
  if (!myId) return;
  socket.emit('move', { x: localState.x, y: localState.y, z: localState.z, rotY: localState.rotY });
}, 66);

const MOVE_SPEED = 4;
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  cameraYaw += lookDelta;

  if (moveVec.x !== 0 || moveVec.y !== 0) {
    const forward = -moveVec.y;
    const strafe = moveVec.x;
    const dirX = Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe;
    const dirZ = Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe;
    localState.x += dirX * MOVE_SPEED * dt;
    localState.z += dirZ * MOVE_SPEED * dt;
    localState.rotY = Math.atan2(dirX, dirZ);
  }

  Object.values(others).forEach((o) => {
    o.mesh.position.x += (o.target.x - o.mesh.position.x) * 0.25;
    o.mesh.position.z += (o.target.z - o.mesh.position.z) * 0.25;
    o.mesh.rotation.y += (o.target.rotY - o.mesh.rotation.y) * 0.25;
  });

  if (localMesh) {
    localMesh.position.set(localState.x, localState.y, localState.z);
    localMesh.rotation.y = localState.rotY;
  }

  updateCamera();
  renderer.render(scene, camera);
}
animate();
