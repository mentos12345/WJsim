/* WJSIM — Sign in with Google and keep "My projects" in the cloud (Firebase Auth + Firestore).
 * Local-first: projects are always saved in IndexedDB as before. When signed in, every save/delete is
 * also sent to users/{uid}/projects/{id}, and signing in merges both sides (newer updatedAt wins).
 * Deletes are kept as { deleted: true } so another computer removes its copy on the next sync.
 * Off in the desktop app and when cloud-config.js has no config. */
(function () {
  'use strict';
  const IOTF = window.IOTF;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cfg = window.WJSIM_FIREBASE;
  const enabled = !!(cfg && cfg.apiKey) && !window.iotfHost;

  let auth = null, fs = null, user = null, state = 'idle', syncing = null;

  function load(src) {
    return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('โหลด ' + src + ' ไม่ได้')); document.head.appendChild(s); });
  }
  const col = () => fs.collection('users').doc(user.uid).collection('projects');
  // Firestore can't hold arrays inside arrays, so the project itself travels as a JSON string
  const toCloud = (r) => ({ id: r.id, name: r.name, mode: r.mode || 'basic', board: r.board || '', parts: r.parts || 0, wires: r.wires || 0,
    createdAt: r.createdAt || r.updatedAt, updatedAt: r.updatedAt || Date.now(), thumb: r.thumb || '', json: JSON.stringify(r.data), deleted: false });
  const fromCloud = (c) => ({ id: c.id, name: c.name, mode: c.mode, board: c.board, parts: c.parts, wires: c.wires, createdAt: c.createdAt, updatedAt: c.updatedAt, thumb: c.thumb, data: JSON.parse(c.json) });

  function setState(s) { state = s; renderAcct(); }
  function note() {
    const n = $('dashNote'); if (!n) return;
    if (!n.dataset.local) n.dataset.local = n.textContent;
    n.textContent = user ? 'โปรเจกต์ถูกบันทึกทั้งในเครื่องนี้และในคลาวด์ เข้าสู่ระบบด้วยบัญชีเดียวกันที่เครื่องอื่นเพื่อเปิดต่อได้'
      : enabled && auth ? n.dataset.local.replace('ถ้าต้องการ', 'เข้าสู่ระบบด้วย Google เพื่อเก็บไว้ในคลาวด์ หรือถ้าต้องการ') : n.dataset.local;
  }
  function renderAcct() {
    note();
    const lb = $('dashLogin');
    if (lb) {
      let skipped = false; try { skipped = sessionStorage.getItem('wjsim-login-skip') === '1'; } catch (e) { /* no storage */ }
      lb.hidden = !(enabled && auth && !user && !skipped);
      $('dashLoginBtn').onclick = signIn;
      $('dashLoginSkip').onclick = () => { try { sessionStorage.setItem('wjsim-login-skip', '1'); } catch (e) { /* no storage */ } lb.hidden = true; };
    }
    const box = $('acct'); if (!box) return;
    if (!enabled) { box.hidden = true; return; }
    box.hidden = !!(lb && !lb.hidden); // the big banner already offers sign-in
    if (!auth) { box.innerHTML = ''; return; }
    if (!user) {
      box.innerHTML = `<button class="btn gsign" id="acctIn"><svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>เข้าสู่ระบบด้วย Google</button>`;
      $('acctIn').onclick = signIn;
      return;
    }
    const st = state === 'syncing' ? 'กำลังซิงก์…' : state === 'error' ? 'ซิงก์ไม่สำเร็จ' : 'ซิงก์กับคลาวด์แล้ว';
    box.innerHTML = `<span class="acst ${state}" title="${esc(user.email || '')}">${state === 'error' ? '⚠' : '☁'} ${st}</span>
      ${user.photoURL ? `<img class="acav" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : ''}
      <span class="acname">${esc(user.displayName || user.email || '')}</span>
      <button class="btn small" id="acctOut">ออกจากระบบ</button>`;
    $('acctOut').onclick = signOut;
  }

  async function signIn() {
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(p);
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') IOTF.app.toast('เข้าสู่ระบบไม่ได้: ' + (e.message || e.code));
    }
  }
  async function signOut() { await auth.signOut(); IOTF.app.toast('ออกจากระบบแล้ว โปรเจกต์ยังอยู่ในเครื่องนี้'); }

  // merge cloud and this computer; newer updatedAt wins on each project
  function sync() {
    if (!user) return Promise.resolve();
    if (syncing) return syncing;
    const store = IOTF.projects.store;
    syncing = (async () => {
      setState('syncing');
      try {
        const [snap, local] = await Promise.all([col().get(), store.all()]);
        const cloud = new Map(); snap.forEach((d) => cloud.set(d.id, d.data()));
        const byId = new Map(local.map((r) => [r.id, r]));
        let pulled = 0, pushed = 0;
        for (const [id, c] of cloud) {
          const l = byId.get(id);
          if (c.deleted) { if (l && (l.updatedAt || 0) <= c.updatedAt) { await store.del(id); pulled++; } continue; }
          if (!l || (l.updatedAt || 0) < c.updatedAt) { try { await store.put(fromCloud(c)); pulled++; } catch (e) { /* skip a broken record */ } }
        }
        const batch = [];
        for (const l of local) {
          const c = cloud.get(l.id);
          if (!c || (!c.deleted && c.updatedAt < (l.updatedAt || 0)) || (c.deleted && c.updatedAt < (l.updatedAt || 0))) batch.push(col().doc(l.id).set(toCloud(l)));
        }
        await Promise.all(batch); pushed = batch.length;
        setState('ok');
        if (pulled && !$('dash').hidden) IOTF.projects.render();
        return { pulled, pushed };
      } catch (e) {
        console.warn('cloud sync', e); setState('error');
        IOTF.app.toast('ซิงก์กับคลาวด์ไม่สำเร็จ: ' + (e.code || e.message));
      } finally { syncing = null; }
    })();
    return syncing;
  }

  // called by projects.js after a local save / delete
  async function pushed(rec) {
    if (!user) return;
    try { await col().doc(rec.id).set(toCloud(rec)); if (state !== 'ok') setState('ok'); }
    catch (e) { console.warn('cloud save', e); setState('error'); IOTF.app.toast('บันทึกขึ้นคลาวด์ไม่สำเร็จ เก็บไว้ในเครื่องแล้ว'); }
  }
  async function removed(id) {
    if (!user) return;
    try { await col().doc(id).set({ id, deleted: true, updatedAt: Date.now() }); }
    catch (e) { console.warn('cloud delete', e); setState('error'); }
  }

  async function init() {
    renderAcct();
    if (!enabled) return;
    try {
      await load('vendor/firebase/firebase-app-compat.js');
      await load('vendor/firebase/firebase-auth-compat.js');
      await load('vendor/firebase/firebase-firestore-compat.js');
      firebase.initializeApp(cfg);
      auth = firebase.auth(); fs = firebase.firestore();
      auth.getRedirectResult().catch(() => {});
      auth.onAuthStateChanged((u) => { user = u; setState(u ? 'syncing' : 'idle'); if (u) sync(); });
      window.addEventListener('online', () => { if (user) sync(); });
      renderAcct();
    } catch (e) { console.warn('cloud init', e); const box = $('acct'); if (box) box.hidden = true; }
  }

  IOTF.cloud = { init, sync, pushed, removed, get user() { return user; }, enabled };
})();
