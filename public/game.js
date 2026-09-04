// --- GESTION DU JOYSTICK GAUCHE (DÉPLACEMENT) ---
function setupVirtualJoystick(zoneEl, baseEl, stickEl, onMove, onEnd) {
  let active = false;
  let touchId = null;
  let originX = 0, originY = 0;

  // Rayons : base = 50px (diamètre 100), stick = 23px (diamètre 46)
  const baseRadius = 50;
  const stickRadius = 23;
  const maxDistance = baseRadius - stickRadius; // 27px max pour ne pas dépasser !

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

    // Normalisation de -1 à 1
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


// --- GESTION DE LA ZONE DROITE (ROTAION CAMÉRA TYPE FREE FIRE) ---
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

  // Sensibilité de la caméra
  cameraYaw -= deltaX * 0.005;
}, { passive: true });

function endLook(e) {
  const t = [...e.changedTouches].find((t) => t.identifier === lookTouchId);
  if (t) lookTouchId = null;
}
lookZone.addEventListener('touchend', endLook, { passive: true });
lookZone.addEventListener('touchcancel', endLook, { passive: true });


// --- BOUCLE D'ANIMATION ET DÉPLACEMENT T3D ---
const MOVE_SPEED = 5;
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Calcul fluide des déplacements relatifs à l'angle de la caméra
  if (moveVec.x !== 0 || moveVec.y !== 0) {
    const forward = -moveVec.y; // Haut = Avancer (+1)
    const strafe = moveVec.x;   // Droite = Droite (+1)

    // Orientation exacte par rapport au Yaw de la caméra
    const dirX = Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * strafe;
    const dirZ = Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * strafe;

    localState.x += dirX * MOVE_SPEED * dt;
    localState.z += dirZ * MOVE_SPEED * dt;

    // Le personnage s'oriente dans la direction où il marche
    localState.rotY = Math.atan2(dirX, dirZ);
  }

  // Interp d'affichage des autres joueurs
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
