/* Health Radar Cloud 1.0
   Firebase Auth + Firestore sync
   Data path: users/{uid}/healthRadar/state
*/

const healthRadarFirebaseConfig = {
  "apiKey": "AIzaSyBzulT70FbuvkgTEaumslB9sd0uj3hND5Y",
  "authDomain": "health-radar-f3c53.firebaseapp.com",
  "projectId": "health-radar-f3c53",
  "storageBucket": "health-radar-f3c53.firebasestorage.app",
  "messagingSenderId": "1095762724727",
  "appId": "1:1095762724727:web:eb50dbff7350923e518372",
  "measurementId": "G-F4B4XP54B7"
};

let cloudApp = null;
let cloudAuth = null;
let cloudDb = null;
let cloudUser = null;
let cloudUnsub = null;
let cloudReady = false;
let cloudSaving = false;
let cloudDebounceTimer = null;
let lastCloudUpdatedAt = null;

function initHealthRadarCloud(){
  try {
    if (!window.firebase) {
      setCloudStatus('Firebase SDK не завантажився. Відкрийте сайт через https або перевірте інтернет.');
      return;
    }
    const savedConfig = (() => {
      try {
        const rawState = JSON.parse(localStorage.getItem('healthRadarAI_v1') || '{}');
        const raw = rawState?.settings?.firebaseConfig;
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })();
    const finalFirebaseConfig = savedConfig || healthRadarFirebaseConfig;
    cloudApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(finalFirebaseConfig);
    cloudAuth = firebase.auth();
    cloudDb = firebase.firestore();
    cloudReady = true;

    wrapLocalSaveForCloud();

    cloudAuth.onAuthStateChanged(async (user) => {
      cloudUser = user || null;
      updateCloudUI();
      if (cloudUser) {
        startCloudListener();
        await cloudMergeNow(true);
      } else {
        stopCloudListener();
      }
    });
  } catch (err) {
    console.error(err);
    setCloudStatus('Помилка ініціалізації Firebase: ' + err.message);
  }
}

function cloudDocRef(){
  if (!cloudDb || !cloudUser) return null;
  return cloudDb.collection('users').doc(cloudUser.uid).collection('healthRadar').doc('state');
}

function safeCloudState(){
  const copy = JSON.parse(JSON.stringify(window.state || {}));
  copy.__cloudMeta = {
    updatedAt: new Date().toISOString(),
    appVersion: 'Health Radar Cloud 1.0'
  };
  return copy;
}

function wrapLocalSaveForCloud(){
  if (window.__cloudSaveWrapped) return;
  window.__cloudSaveWrapped = true;
  const originalSaveState = window.saveState;
  if (typeof originalSaveState === 'function') {
    window.saveState = function(){
      originalSaveState.apply(this, arguments);
      scheduleCloudSave();
    };
  }
}

function scheduleCloudSave(){
  if (!cloudUser || cloudSaving) return;
  clearTimeout(cloudDebounceTimer);
  cloudDebounceTimer = setTimeout(() => cloudSaveNow(true), 1800);
}

async function cloudSignIn(){
  if (!cloudReady) initHealthRadarCloud();
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await cloudAuth.signInWithPopup(provider);
  } catch (err) {
    console.error(err);
    alert('Не вдалося увійти через Google: ' + err.message + '\n\nЯкщо відкрито через file://, завантажте сайт на Firebase Hosting.');
  }
}

async function cloudSignOut(){
  if (!cloudAuth) return;
  await cloudAuth.signOut();
  setCloudStatus('Вихід виконано. Дані залишились локально у браузері.');
}

async function cloudSaveNow(silent=false){
  if (!cloudUser) {
    if (!silent) alert('Спочатку увійдіть через Google.');
    return;
  }
  const ref = cloudDocRef();
  if (!ref) return;
  try {
    cloudSaving = true;
    const data = safeCloudState();
    await ref.set(data, { merge: false });
    lastCloudUpdatedAt = data.__cloudMeta.updatedAt;
    setCloudStatus('✅ Збережено в хмару: ' + new Date(lastCloudUpdatedAt).toLocaleString('uk-UA'));
    if (!silent) alert('Дані збережено в хмару.');
  } catch (err) {
    console.error(err);
    setCloudStatus('❌ Помилка збереження: ' + err.message);
    if (!silent) alert('Помилка збереження в хмару: ' + err.message);
  } finally {
    cloudSaving = false;
  }
}

async function cloudLoadNow(silent=false){
  if (!cloudUser) {
    if (!silent) alert('Спочатку увійдіть через Google.');
    return;
  }
  const ref = cloudDocRef();
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      if (!silent) alert('У хмарі ще немає даних.');
      return;
    }
    const data = snap.data();
    const meta = data.__cloudMeta || null;
    delete data.__cloudMeta;
    window.state = data;
    if (typeof state !== 'undefined') state = window.state;
    if (typeof saveState === 'function') {
      const oldUser = cloudUser;
      cloudUser = null; // prevent immediate re-upload during local save
      saveState();
      cloudUser = oldUser;
    }
    if (typeof renderAll === 'function') renderAll();
    lastCloudUpdatedAt = meta?.updatedAt || null;
    setCloudStatus('⬇️ Завантажено з хмари' + (lastCloudUpdatedAt ? ': ' + new Date(lastCloudUpdatedAt).toLocaleString('uk-UA') : ''));
    if (!silent) alert('Дані завантажено з хмари.');
  } catch (err) {
    console.error(err);
    setCloudStatus('❌ Помилка завантаження: ' + err.message);
    if (!silent) alert('Помилка завантаження з хмари: ' + err.message);
  }
}

async function cloudMergeNow(silent=false){
  if (!cloudUser) {
    if (!silent) alert('Спочатку увійдіть через Google.');
    return;
  }
  const ref = cloudDocRef();
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      await cloudSaveNow(true);
      if (!silent) alert('У хмарі не було даних. Локальні дані збережено.');
      return;
    }
    const cloudData = snap.data();
    const cloudMeta = cloudData.__cloudMeta || null;
    delete cloudData.__cloudMeta;

    const merged = mergeHealthStates(window.state || {}, cloudData || {});
    window.state = merged;
    if (typeof state !== 'undefined') state = window.state;

    const oldUser = cloudUser;
    cloudUser = null;
    if (typeof saveState === 'function') saveState();
    cloudUser = oldUser;
    if (typeof renderAll === 'function') renderAll();

    await cloudSaveNow(true);
    lastCloudUpdatedAt = cloudMeta?.updatedAt || new Date().toISOString();
    setCloudStatus('🔄 Локальні та хмарні дані об’єднано.');
    if (!silent) alert('Дані об’єднано.');
  } catch (err) {
    console.error(err);
    setCloudStatus('❌ Помилка об’єднання: ' + err.message);
    if (!silent) alert('Помилка об’єднання: ' + err.message);
  }
}

function mergeHealthStates(local, cloud){
  const base = Object.assign({}, cloud, local);
  base.settings = Object.assign({}, cloud.settings || {}, local.settings || {});
  base.city = local.city || cloud.city || base.city;

  ['bp','meds','events','weather'].forEach(key => {
    const map = new Map();
    (cloud[key] || []).forEach(item => map.set(item.id || stableKey(item), item));
    (local[key] || []).forEach(item => map.set(item.id || stableKey(item), item));
    base[key] = Array.from(map.values()).sort((a,b) => new Date(a.time || 0) - new Date(b.time || 0));
  });
  return base;
}

function stableKey(item){
  return [item.time, item.type, item.sys, item.dia, item.name, item.pressure].filter(Boolean).join('|');
}

function startCloudListener(){
  stopCloudListener();
  const ref = cloudDocRef();
  if (!ref) return;
  cloudUnsub = ref.onSnapshot((snap) => {
    if (!snap.exists) {
      setCloudStatus('☁️ Увійшли. У хмарі поки немає даних.');
      return;
    }
    const data = snap.data();
    const meta = data.__cloudMeta || {};
    lastCloudUpdatedAt = meta.updatedAt || null;
    updateCloudUI();
  }, (err) => {
    console.error(err);
    setCloudStatus('❌ Помилка слухача Firestore: ' + err.message);
  });
}

function stopCloudListener(){
  if (cloudUnsub) {
    cloudUnsub();
    cloudUnsub = null;
  }
}

function updateCloudUI(){
  const name = document.getElementById('cloudUserName');
  const email = document.getElementById('cloudUserEmail');
  const avatar = document.getElementById('cloudUserAvatar');

  if (cloudUser) {
    if (name) name.textContent = cloudUser.displayName || 'Google акаунт';
    if (email) email.textContent = cloudUser.email || '';
    if (avatar) {
      avatar.innerHTML = cloudUser.photoURL ? `<img src="${cloudUser.photoURL}" alt="avatar">` : '👤';
    }
    setCloudStatus('✅ Увійшли: ' + (cloudUser.email || cloudUser.uid));
  } else {
    if (name) name.textContent = 'Вхід не виконано';
    if (email) email.textContent = 'Увійдіть через Google, щоб синхронізувати телефон і ПК.';
    if (avatar) avatar.textContent = '☁️';
    setCloudStatus('Не виконано вхід');
  }
}

function setCloudStatus(text){
  const s = document.getElementById('cloudStatus');
  const d = document.getElementById('cloudDetails');
  if (s) s.textContent = text;
  if (d) {
    d.textContent = `${text}

Локальні записи:
• Тиск: ${(window.state?.bp || []).length}
• Ліки: ${(window.state?.meds || []).length}
• Події: ${(window.state?.events || []).length}
• Погода: ${(window.state?.weather || []).length}

Хмарний документ:
users/${cloudUser?.uid || '—'}/healthRadar/state

Останнє хмарне оновлення:
${lastCloudUpdatedAt ? new Date(lastCloudUpdatedAt).toLocaleString('uk-UA') : '—'}`;
  }
}

function openCloudPanel(){
  openModal('cloudModal');
  updateCloudUI();
}

window.addEventListener('load', initHealthRadarCloud);


/* Health Radar 1.2: autosync toggle */
function isAutoSyncEnabled(){
  const el = document.getElementById('autoSyncToggle');
  if (!el) return localStorage.getItem('healthRadarAutoSync') !== 'false';
  return el.checked;
}
function toggleAutoSync(){
  const el = document.getElementById('autoSyncToggle');
  localStorage.setItem('healthRadarAutoSync', el && el.checked ? 'true' : 'false');
  setCloudStatus(el && el.checked ? '✅ Автосинхронізація увімкнена' : '⏸ Автосинхронізація вимкнена');
}
if (typeof scheduleCloudSave === 'function' && !window.__scheduleCloudSavePatched) {
  window.__scheduleCloudSavePatched = true;
  const __oldScheduleCloudSave = scheduleCloudSave;
  scheduleCloudSave = function(){
    if (!isAutoSyncEnabled()) return;
    return __oldScheduleCloudSave.apply(this, arguments);
  };
}


/* Cloud Sync 1.6.3: explicit load helper for phone/PC sync */
async function cloudForceLoadAndRender(){
  await cloudLoadNow(true);
  if (typeof state !== 'undefined') state = window.state;
  if (typeof renderAll === 'function') renderAll();
  setCloudStatus('⬇️ Дані підтягнуто з хмари на цей пристрій.');
}
