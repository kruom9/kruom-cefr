/* Exam Gym ม.6 · Firebase login path (Firebase Auth Email/Password + Firestore)
 * ใช้เมื่อ config.js ตั้ง AUTH_PROVIDER: 'firebase' · ไม่งั้นไฟล์นี้ไม่ทำอะไร (ระบบ Apps Script เดิมทำงานต่อ)
 * นักเรียนพิมพ์เลขประจำตัว → แปลงเป็นอีเมลภายใน <เลข>@<STUDENT_EMAIL_DOMAIN> · ครูใช้ชื่อผู้ใช้ (KRUOM หรือ 99900 / KRUPANG หรือ 99901) หรืออีเมลจริง
 * ไม่มีรหัสผ่านครั้งแรกในไฟล์นี้ (ตรวจ "ห้ามซ้ำรหัสครั้งแรก" จากรหัสที่ผู้ใช้เพิ่งพิมพ์เข้าสู่ระบบ) */
(function () {
'use strict';
var CFG = window.EXAMGYM_CONFIG || {}, F = CFG.FIREBASE || {}, C = F.config || {};
var SDK = 'https://www.gstatic.com/firebasejs/' + (F.SDK_VERSION || '13.1.0') + '/';
var DOMAIN = String(F.STUDENT_EMAIL_DOMAIN || 'students.examgym-m6.invalid').toLowerCase();
var on = CFG.AUTH_PROVIDER === 'firebase';
var configured = on && C.apiKey && !/PASTE|YOUR_/i.test(C.apiKey) && C.projectId && !/PASTE|YOUR_/i.test(C.projectId);
var M = null, app = null, auth = null, db = null, loading = null, firstState = null;

function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
function timeout(p, ms, code) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(err(code || 'timeout')); }, ms); })]); }

function load() {
  if (loading) return loading;
  if (!configured) return Promise.reject(err('not-configured'));
  loading = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]).then(function (x) {
    M = {app: x[0], auth: x[1], fs: x[2]};
    app = M.app.initializeApp(C, 'examgym-m6');
    auth = M.auth.initializeAuth(app, {persistence: [M.auth.indexedDBLocalPersistence, M.auth.browserLocalPersistence], popupRedirectResolver: undefined});
    try { auth.languageCode = 'th'; } catch (e) {}
    db = M.fs.initializeFirestore(app, {ignoreUndefinedProperties: true});
    var em = F.EMULATORS;
    if (em && em.auth) M.auth.connectAuthEmulator(auth, em.auth, {disableWarnings: true});
    if (em && em.firestore) M.fs.connectFirestoreEmulator(db, em.firestore[0], em.firestore[1]);
    firstState = (auth.authStateReady ? auth.authStateReady().then(function () { return auth.currentUser; }) : new Promise(function (res) { var u = M.auth.onAuthStateChanged(auth, function (user) { u(); res(user); }); }));
    return true;
  }).catch(function (e) { loading = null; throw e.code ? e : err('sdk-load', String(e && e.message || e)); });
  return loading;
}
function emailOf(user) {
  var u = String(user || '').trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d{3,8}$/.test(u)) return u + '@' + DOMAIN;
  return u.indexOf('@') > 0 ? u : '';
}
// ชื่อผู้ใช้ครู (ไม่สนตัวพิมพ์เล็ก/ใหญ่ เช่น KRUPANG = krupang) → อีเมลบัญชี Firebase เดิมของครู (uid/รหัสผ่าน/mustChange เดิมทั้งหมด)
// เก็บอีเมลแบบเข้ารหัส AES-GCM (กุญแจจาก PBKDF2 ของชื่อผู้ใช้) จึงไม่มีอีเมลจริงอยู่ใน repo · ไม่ใช่ความลับระดับรหัสผ่าน (ผู้รู้ชื่อผู้ใช้ถอดได้)
var ALIASES = {"89732c93f3a27096743b5649": ["M528H6WhrrR8AT+5", "kczqS+P+vPEYpLuvrQte2YQw1MShDR5EXKmWKx/voTM="], "c8bfdf9ba2a9c63687cffddc": ["pfhx9SAzssjqhEM6", "RBc42EFIaBS/7eW1ArTzWKBrr3H6k0Je5vuNSgOyayw="], "8d353c0524a576df328a6b1c": ["W8kwejHntBRSDDpe", "/IJ8feX/dr6BNvqxWP7KqNFqNxwtF3la6bn9PNm1SIu0UtvdOX0R7y0nscA/BAYh"], "7743f2a608a4eb6e80d8527f": ["bj5yR0ZbQJIZqaX2", "nUmOi/P09axW1XlFse8gGrfS31VjO9S3KdfZqcPzrsAjepaFiQ0UiOd2KOIUkuKu"]};
function b64u8(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function hexOf(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
function aliasEmail(user) {
  var n = String(user || '').trim().toLowerCase().replace(/\s+/g, ''), S = window.crypto && window.crypto.subtle, te = new TextEncoder();
  if (!/^[a-z0-9][a-z0-9_.-]{2,30}$/.test(n) || !S) return Promise.resolve('');
  return S.digest('SHA-256', te.encode('eg6-alias-id|' + n)).then(function (h) {
    var rec = ALIASES[hexOf(h).slice(0, 24)]; if (!rec) return '';
    return S.importKey('raw', te.encode(n), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return S.deriveKey({name: 'PBKDF2', salt: te.encode('eg6-alias-key|' + n), iterations: 100000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    }).then(function (key) { return S.decrypt({name: 'AES-GCM', iv: b64u8(rec[0])}, key, b64u8(rec[1])); })
      .then(function (pt) { return new TextDecoder().decode(pt); });
  }).catch(function () { return ''; });
}
// ชื่อผู้ใช้ครูก่อน (รวมเลขครู 99900/99901 ซึ่งไม่มีบัญชีนักเรียน) แล้วจึงเลขประจำตัวนักเรียน/อีเมล
function resolveEmail(user) { if (String(user || '').indexOf('@') > 0) return Promise.resolve(emailOf(user)); return aliasEmail(user).then(function (a) { return a || emailOf(user); }); }
function sidOfEmail(email) { var m = String(email || '').toLowerCase().match(/^(\d{3,8})@(.+)$/); return m && m[2] === DOMAIN ? m[1] : ''; }
function profileOf(user) {
  return timeout(M.fs.getDoc(M.fs.doc(db, 'users', user.uid)), 15000).then(function (s) {
    if (!s.exists()) throw err('no-profile');
    var p = s.data(); p.uid = user.uid; p.email = user.email; return p;
  });
}
// เข้าสู่ระบบ → {uid, email, sid, name, room, no, role, mustChange}
function signIn(user, pw) {
  return load().then(function () {
    return resolveEmail(user);
  }).then(function (email) {
    if (!email) throw err('auth/invalid-email');
    return timeout(M.auth.signInWithEmailAndPassword(auth, email, String(pw)), 20000, 'auth/network-request-failed');
  }).then(function (cred) {
    return profileOf(cred.user).catch(function (e) { return M.auth.signOut(auth).then(function () { throw e; }, function () { throw e; }); });
  });
}
// ผู้ใช้ที่ค้างอยู่ในเครื่อง (หลังรีเฟรช) → profile หรือ null
// รอให้ Auth กู้ผู้ใช้จาก IndexedDB เสร็จก่อน (หลังรีเฟรช currentUser เป็น null ชั่วครู่)
function ready() { return load().then(function () { return firstState; }); }
function current() {
  return load().then(function () { return firstState; }).then(function (u) { return u ? profileOf(u) : null; });
}
function checkNew(newPw, oldPw, sid) {
  newPw = String(newPw || '');
  if (newPw.length < 6) throw err('auth/weak-password');
  if (newPw === String(oldPw || '')) throw err('same-as-old');
  if (sid && newPw === String(sid)) throw err('same-as-id');
}
function markChanged(uid) {
  var ref = M.fs.doc(db, 'users', uid), n = 0;
  function attempt() {
    return timeout(M.fs.updateDoc(ref, {mustChange: false, pwChangedAt: M.fs.serverTimestamp()}), 15000).catch(function (e) {
      if (++n < 3) return new Promise(function (r) { setTimeout(r, 800 * n); }).then(attempt); throw e;
    });
  }
  return attempt();
}
// ตั้งรหัสใหม่ครั้งแรก (บังคับ) · oldPw = รหัสครั้งแรกที่เพิ่งพิมพ์เข้าสู่ระบบ (อยู่ในหน่วยความจำเท่านั้น)
function setFirstPassword(newPw, oldPw, sid) {
  return ready().then(function () {
    var u = auth.currentUser; if (!u) throw err('auth/requires-recent-login');
    checkNew(newPw, oldPw, sid);
    return timeout(M.auth.updatePassword(u, String(newPw)), 20000, 'auth/network-request-failed').then(function () { return markChanged(u.uid); }).then(function () { return profileOf(u); });
  });
}
// เปลี่ยนรหัสผ่านเอง (ผลของฉัน) · ยืนยันรหัสเดิมก่อน
function changePassword(oldPw, newPw, sid) {
  return ready().then(function () {
    var u = auth.currentUser; if (!u) throw err('auth/requires-recent-login');
    checkNew(newPw, oldPw, sid);
    var cred = M.auth.EmailAuthProvider.credential(u.email, String(oldPw));
    return timeout(M.auth.reauthenticateWithCredential(u, cred), 20000, 'auth/network-request-failed')
      .then(function () { return timeout(M.auth.updatePassword(u, String(newPw)), 20000, 'auth/network-request-failed'); })
      .then(function () { return profileOf(u); }).then(function (p) { return p.mustChange ? markChanged(u.uid).then(function () { return p; }) : p; });
  });
}
function signOut() { return load().then(function () { return M.auth.signOut(auth); }).catch(function () {}); }
function idToken() { return ready().then(function () { var u = auth.currentUser; if (!u) throw err('auth/no-current-user'); return u.getIdToken(); }); }

var A_KEYS = ['eid','sessionId','subject','mode','set','itemId','sara','topic','attempt','chosen','correct','sec','len','ts'];
var M_KEYS = ['eid','subject','set','score','total','bySara','usedSec','timeout','answered','ts'];
function pick(ev, keys) { var o = {}; keys.forEach(function (k) { if (ev[k] !== undefined && ev[k] !== null) o[k] = ev[k]; }); return o; }
function intish(o, keys) { keys.forEach(function (k) { if (typeof o[k] === 'number') o[k] = Math.round(o[k]); }); return o; }
// บันทึกเหตุการณ์ลง Firestore · คืนรายการ eid ที่อยู่ใน Firestore แล้ว (ใหม่หรือซ้ำ) · ไม่โยน error ถ้าบางรายการไม่ผ่าน
function saveEvents(events, prof, version) {
  return ready().then(function () {
    var u = auth.currentUser; if (!u) throw err('auth/no-current-user');
    var base = {uid: u.uid, sid: prof.sid, room: prof.room};
    return Promise.all(events.map(function (ev) {
      var ref, data;
      if (ev.type === 'answer' || ev.type === 'mock') {
        data = ev.type === 'answer' ? intish(pick(ev, A_KEYS), ['sara', 'attempt', 'len', 'ts']) : intish(pick(ev, M_KEYS), ['total', 'answered', 'ts']);
        if (ev.type === 'answer' && data.chosen !== '' && data.chosen != null) data.chosen = Math.round(Number(data.chosen));
        if (ev.type === 'mock' && data.bySara) { var b = {}; Object.keys(data.bySara).forEach(function (k) { b[String(k)] = data.bySara[k]; }); data.bySara = b; }
        data.type = ev.type; data.version = String(version || '').slice(0, 60);
        Object.keys(base).forEach(function (k) { data[k] = base[k]; });
        data.savedAt = M.fs.serverTimestamp();
        ref = M.fs.doc(db, 'results', u.uid + '_' + ev.eid);
        var put = function (d) { return timeout(M.fs.setDoc(ref, d), 15000); };
        return put(data).catch(function (e) {
          // กฎ Firestore รุ่นเก่ายังไม่รับ subject ในผลสอบ → บันทึกซ้ำโดยไม่มี subject (Sheet ยังได้ subject ครบจากคิว)
          if (e && e.code === 'permission-denied' && 'subject' in data) { var d2 = {}; Object.keys(data).forEach(function (k) { if (k !== 'subject') d2[k] = data[k]; }); return put(d2); }
          throw e;
        }).then(function () { return ev.eid; }, function (e) {
          if (e && e.code === 'permission-denied') return timeout(M.fs.getDoc(ref), 10000).then(function (s) { return s.exists() ? ev.eid : (ev._bad = true, ev.eid); }, function (e2) { return e2 && e2.code === 'permission-denied' ? (ev._bad = true, ev.eid) : null; }); // ไม่มีเอกสาร (อ่านไม่ได้) = Firestore ไม่รับ → ยังส่งเข้า Sheet
          return null;
        });
      }
      if (ev.type === 'session') {
        data = {uid: u.uid, sid: prof.sid, room: prof.room, sessionId: ev.sessionId, startedAt: Math.round(Number(ev.startedAt) || 0), activeSec: Math.min(14400, Math.round(Number(ev.activeSec) || 0)), items: Math.round(Number(ev.items) || 0), ua: String(ev.ua || '').slice(0, 80), version: String(ev.version || version || '').slice(0, 60), updatedAt: M.fs.serverTimestamp()};
        ref = M.fs.doc(db, 'sessions', u.uid + '_' + ev.sessionId);
        return timeout(M.fs.setDoc(ref, data), 15000).then(function () { return ev.eid; }, function (e) { return e && e.code === 'permission-denied' ? ev.eid : null; });
      }
      return Promise.resolve(ev.eid);
    })).then(function (r) { return r.filter(function (x) { return x; }); });
  });
}
// ครู: อ่านผลทั้งหมด (ใช้ในการทดสอบ/แดชบอร์ดภายหลัง)
function teacherResults(max) {
  return ready().then(function () { return M.fs.getDocs(M.fs.query(M.fs.collection(db, 'results'), M.fs.limit(max || 500))); })
    .then(function (s) { return s.docs.map(function (d) { return d.data(); }); });
}
function myResults() {
  return ready().then(function () { var u = auth.currentUser; return M.fs.getDocs(M.fs.query(M.fs.collection(db, 'results'), M.fs.where('uid', '==', u.uid))); })
    .then(function (s) { return s.docs.map(function (d) { return d.data(); }); });
}
var MSG = {
  'auth/invalid-credential': 'เลขประจำตัวหรือรหัสผ่านไม่ถูกต้อง', 'auth/wrong-password': 'เลขประจำตัวหรือรหัสผ่านไม่ถูกต้อง', 'auth/user-not-found': 'เลขประจำตัวหรือรหัสผ่านไม่ถูกต้อง',
  'auth/invalid-email': 'พิมพ์เลขประจำตัวนักเรียน (ครู: ชื่อผู้ใช้ หรืออีเมล)', 'auth/user-disabled': 'บัญชีนี้ถูกปิดใช้งาน แจ้งครูออม',
  'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่', 'auth/network-request-failed': 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง', 'timeout': 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง',
  'auth/weak-password': 'รหัสใหม่ต้องยาวอย่างน้อย 6 ตัว', 'same-as-old': 'รหัสใหม่ต้องไม่ซ้ำรหัสเดิม/รหัสครั้งแรก', 'same-as-id': 'ห้ามใช้เลขประจำตัวเป็นรหัสผ่าน',
  'auth/requires-recent-login': 'กรุณาเข้าสู่ระบบอีกครั้ง', 'no-profile': 'ยังไม่มีบัญชีในระบบ แจ้งครูออม', 'sdk-load': 'โหลดระบบเข้าสู่ระบบไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่',
  'not-configured': 'ระบบยังไม่พร้อม แจ้งครูออม', 'permission-denied': 'ไม่มีสิทธิ์ แจ้งครูออม'
};
function message(e) { var c = e && e.code; return MSG[c] || (c === 'auth/missing-password' ? 'พิมพ์รหัสผ่าน' : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); }

window.EG_FB = {on: on, configured: function () { return !!configured; }, load: load, emailOf: emailOf, resolveEmail: resolveEmail, sidOfEmail: sidOfEmail, signIn: signIn, current: current,
  setFirstPassword: setFirstPassword, changePassword: changePassword, signOut: signOut, idToken: idToken, saveEvents: saveEvents,
  teacherResults: teacherResults, myResults: myResults, message: message};
})();
