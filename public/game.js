// game.js — Prop Hunt : Contrôles, Animation de marche & Transformation (Étape 2)

const statusEl = document.getElementById('status');
const transformBtn = document.getElementById('transform-btn');

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

// --- DÉCOR & PROPS TRANSFORMABLES ---
const propsList = [];

function addDecorBox(x, z, size, color) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color })
  );
  box.position.set(x, size / 2, z);
  box.userData = { size, color };
  scene.add(box);
  propsList.push(box);
}

addDecorBox(5, 5, 2, 0x8d6e63);
addDecorBox(-6, 3, 1.5, 0xffb74d);
addDecorBox(3, -7, 2.5, 0x90a4ae);
addDecorBox(-4, -4, 1, 0xef5350);

// --- CREATION MESH JOUEUR / PROP ---
function createPlayerGroup(color, propData) {
  const group = new THREE.Group();

  if (propData) {
    // Apparence Objet (Prop)
    const propMesh = new THREE.Mesh(
      new THREE.BoxGeometry(propData.size, propData.size, propData.size),
      new THREE.MeshStandardMaterial({ color: propData.color })
    );
    propMesh.position.y = propData.size / 2;
    group.add(propMesh);
  } else {
    // Apparence Personnage Humanoïde
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });

    // Jambes (pivot décalé en haut pour l'articulation de la hanche)
    const legGeo = new THREE.BoxGeometry(0.28, 0.8, 0.28);
    legGeo.translate(0, -0.4, 0);

    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.16, 0.8, 0);
    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.16, 0.8, 0);
    group.add(legL, legR);

    // Torse
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), bodyMat);
    torso.position.y = 1.2;
    group.add(torso);

    // Bras (pivot décalé au niveau de l'épaule)
    const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    armGeo.translate(0, -0.4, 0);

    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-0.425, 1.6, 0);
    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(0.425, 1.6, 0);
    group.add(armL, armR);

    // Tête
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.85;
    group.add(head);

    // Sauvegarde des références pour l'animation
    group.userData = { legL, legR, armL, armR, walkTime: 0 };
  }

  return group;
}

// --- ÉTAT DU JOUEUR ---
const localState = { x: 0, y: 0, z: 0, rotY: 0, propData: null, color: 0xffffff };
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

// --- JOYSTICK GAUCHE ---
function setupVirtualJoystick(zoneEl, baseEl, stickEl, onMove, onEnd) {
  let active = false;
  let touchId = null;
  let originX = 0, originY = 0;

  const baseRadius = 50;
  const stickRadius = 23;
  const maxDistance = baseRadius - stickRadius; // 27px max pour rester dans le socle

  zoneEl.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    active = true;
    touchId = t.identifier;
    originX = t.clientX;
    originY = t.clientY;

    if (baseEl) {
      baseEl.style.left = `${originX - baseRadius}px`;
      baseEl.style.top = `${originY - baseRadius}px`;
      baseEl.style.display = 'block';
    }
    if (stickEl) {
      stickEl.style.left = `${originX - stickRadius}px`;
      stickEl.style.top = `${originY - stickRadius}px`;
      stickEl.style.display = 'block';
    }
  }, { passive: true });

  zoneEl.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = [...e.changedTouches].find((t) => t.identifier === touchId);
    if (!t) return;

    let dx = t.clientX - originX;
    let dy = t.clientY - originY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxDistance) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxDistance;
      dy = Math.sin(angle) * maxDistance;
    }

    if (stickEl) {
      stickEl.style.left = `${originX + dx - stickRadius}px`;
      stickEl.style.top = `${originY + dy - stickRadius}px`;
    }

    onMove(dx / maxDistance, dy / maxDistance);
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

// --- CAMÉRA DROITE ---
const lookZone = document.getElementById('look-zone');
let lastTouchX = 0;
let lookTouchId = null;

lookZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  lookTouchId = t.identifier;
  lastTouchX = t.clientX;
}, { passive: true });

lookZone.addEventListener('touchmove', (e) => {
  if (lookTouchId === null) return;
  const t = [...e.changedTouches].find((t) => t.identifier === lookTouchId);
  if (!t) return;

  const deltaX = t.clientX - lastTouchX;
  lastTouchX = t.clientX;
  cameraYaw -= deltaX * 0.005;
}, { passive: true });

function endLook(e) {
  const t = [...e.changedTouches].find((t) => t.identifier === lookTouchId);
  if (t) lookTouchId = null;
}
lookZone.addEventListener('touchend', endLook, { passive: true });
lookZone.addEventListener('touchcancel', endLook, { passive: true });

// --- CIBLAGE ET TRANSFORMATION ---
const raycaster = new THREE.Raycaster();
let targetedProp = null;

function checkTargetProp() {
  if (localState.propData) return; // Déjà transformé

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(propsList);

  if (intersects.length > 0 && intersects[0].distance < 8) {
    targetedProp = intersects[0].object.userData;
    transformBtn.style.display = 'block';
  } else {
    targetedProp = null;
    transformBtn.style.display = 'none';
  }
}

if (transformBtn) {
  transformBtn.addEventListener('click', () => {
    if (!targetedProp) return;
    localState.propData = targetedProp;
    transformBtn.style.display = 'none';

    if (localMesh) scene.remove(localMesh);
    localMesh = createPlayerGroup(localState.color, localState.propData);
    scene.add(localMesh);

    socket.emit('transform', localState.propData);
  });
}

// --- ANIMATION DE MARCHE ---
function animateWalking(mesh, isMoving, dt) {
  if (!mesh || !mesh.userData.legL) return;

  const { legL, legR, armL, armR } = mesh.userData;

  if (isMoving) {
    mesh.userData.walkTime += dt * 10;
    const angle = Math.sin(mesh.userData.walkTime) * 0.6;

    legL.rotation.x = angle;
    legR.rotation.x = -angle;
    armL.rotation.x = -angle;
    armR.rotation.x = angle;
  } else {
    mesh.userData.walkTime = 0;
    legL.rotation.x += (0 - legL.rotation.x) * 0.2;
    legR.rotation.x += (0 - legR.rotation.x) * 0.2;
    armL.rotation.x += (0 - armL.rotation.x) * 0.2;
    armR.rotation.x += (0 - armR.rotation.x) * 0.2;
  }
}

// --- RESEAU ---
const socket = io();

socket.on('connect', () => { statusEl.textContent = 'Connecté'; });
socket.on('disconnect', () => { statusEl.textContent = 'Déconnecté — reconnexion…'; });

socket.on('init', (data) => {
  myId = data.id;
  const p = data.players[myId];
  localState.x = p.x;
  localState.z = p.z;
  localState.color = p.color;
  localState.propData = p.propData;

  localMesh = createPlayerGroup(p.color, p.propData);
  localMesh.position.set(localState.x, 0, localState.z);
  scene.add(localMesh);

  Object.values(data.players).forEach((otherP) => {
    if (otherP.id === myId) return;
    addOtherPlayer(otherP);
  });
  statusEl.textContent = `Connecté — ${Object.keys(data.players).length} joueur(s)`;
});

socket.on('player_joined', (p) => { addOtherPlayer(p); });

socket.on('player_transformed', (data) => {
  if (data.id === myId) return;
  const o = others[data.id];
  if (!o) return;

  scene.remove(o.mesh);
  o.mesh = createPlayerGroup(o.color, data.propData);
  scene.add(o.mesh);
});

socket.on('state_update', (serverPlayers) => {
  Object.keys(serverPlayers).forEach((id) => {
    if (id === myId) return;

    if (!others[id]) {
      addOtherPlayer(serverPlayers[id]);
    } else {
      const p = serverPlayers[id];
      others[id].target.x = p.x;
      others[id].target.y = p.y;
      others[id].target.z = p.z;
      others[id].target.rotY = p.rotY;
    }
  });
});

socket.on('player_left', (id) => {
  const o = others[id];
  if (!o) return;
  scene.remove(o.mesh);
  delete others[id];
});

function addOtherPlayer(p) {
  if (others[p.id] || p.id === myId) return;
  const mesh = createPlayerGroup(p.color, p.propData);
  mesh.position.set(p.x, 0, p.z);
  scene.add(mesh);
  others[p.id] = { mesh, color: p.color, target: { x: p.x, y: p.y, z: p.z, rotY: p.rotY } };
}

setInterval(() => {
  if (!myId) return;
  socket.emit('move', { x: localState.x, y: localState.y, z: localState.z, rotY: localState.rotY });
}, 66);

// --- BOUCLE DE JEU ---
const MOVE_SPEED = 5;
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const isMoving = (moveVec.x !== 0 || moveVec.y !== 0);

  if (isMoving) {
    const forward = -moveVec.y;
    const strafe = -moveVec.x;

    const dirX = Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe;
    const dirZ = Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe;

    localState.x += dirX * MOVE_SPEED * dt;
    localState.z += dirZ * MOVE_SPEED * dt;
    localState.rotY = Math.atan2(dirX, dirZ);
  }

  if (localMesh) {
    localMesh.position.set(localState.x, localState.y, localState.z);
    localMesh.rotation.y = localState.rotY;
    animateWalking(localMesh, isMoving, dt);
  }

  Object.values(others).forEach((o) => {
    const dist = Math.hypot(o.target.x - o.mesh.position.x, o.target.z - o.mesh.position.z);
    const isOtherMoving = dist > 0.05;

    o.mesh.position.x += (o.target.x - o.mesh.position.x) * 0.25;
    o.mesh.position.z += (o.target.z - o.mesh.position.z) * 0.25;
    o.mesh.rotation.y += (o.target.rotY - o.mesh.rotation.y) * 0.25;

    animateWalking(o.mesh, isOtherMoving, dt);
  });

  updateCamera();
  checkTargetProp();
  renderer.render(scene, camera);
}

animate();
