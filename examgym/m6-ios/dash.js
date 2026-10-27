/* Exam Gym ม.6 · แดชบอร์ดครู (เฉพาะครู) · โรงเรียนปิยมิตรวิทยา ฝ่ายมัธยม
   โหลดเมื่อครูเปิด #/admin เท่านั้น (นักเรียนไม่ได้โหลดไฟล์นี้) · ไม่มีข้อมูลนักเรียนในไฟล์นี้
   มุมมอง: #/admin (ภาพรวม) · #/admin/s/<เลขประจำตัว> (รายคน) · #/admin/s/<เลขประจำตัว>/<วิชา> (รายวิชา)
   แหล่งข้อมูล (adapter): 'sheet' = Apps Script {action:'dash'} (ค่าเริ่มต้น) · 'firestore' = อ่าน users/results/sessions แล้วรวมสถิติในเครื่องครู
   รูปนักเรียน: Firestore photos/{เลขประจำตัว} (base64 JPEG ~256px · เฉพาะครู) · ถ้ายังไม่เปิด Firestore เก็บในเครื่องนี้ (localStorage) */
(function () {
'use strict';
var CFG = window.EXAMGYM_CONFIG || {}, AGG = window.DashAgg;
var TTL = 60000, PHOTO_PX = 256, PHOTO_MAX = 35000;
// รูปนักเรียน: ปิดไว้จนกว่าครูออมอนุมัติแบบฟอร์มขอความยินยอม (PDPA) · เปิดด้วย DASH_PHOTOS: true ใน config.js (และต้อง deploy กฎ photos ก่อน)
var PHOTOS = CFG.DASH_PHOTOS === true;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function n0(x) { return Number(x || 0).toLocaleString('th-TH'); }
function pctT(p) { return p == null ? '–' : (Math.round(p) === p ? p : p.toFixed(1)) + '%'; }
function dOnly(t) { return t ? new Date(t).toLocaleDateString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit'}) : '–'; }
function dShort(t) { return new Date(t).toLocaleDateString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short'}); }
function dTime(t) { return t ? new Date(t).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'}) + ' น.' : '–'; }
function dCell(t) { if (!t) return '<td>–</td>'; var o = {timeZone: 'Asia/Bangkok'}, d = new Date(t); return '<td class="dd"><b>' + esc(d.toLocaleDateString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit'})) + '</b><br><small class="muted">' + esc(d.toLocaleTimeString('th-TH', {timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit'})) + ' น.</small></td>'; }
function minsK(m) { m = Math.round(m || 0); return m < 60 ? m + '<small> นาที</small>' : (m / 60).toFixed(1).replace(/\.0$/, '') + '<small> ชม.</small>'; }
function minsT(m) { m = Math.round(m || 0); return m < 60 ? m + ' นาที' : Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที'; }
function secT(s) { s = Math.round(s || 0); var m = Math.floor(s / 60), x = s % 60; return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที' : m ? m + ' นาที ' + (x ? x + ' วิ' : '') : x + ' วินาที'; }
function ago(t, now) { if (!t) return 'ยังไม่เคยใช้'; var d = Math.floor((AGG.dayStart(now) - AGG.dayStart(t)) / 864e5); return d <= 0 ? 'วันนี้' : d === 1 ? 'เมื่อวาน' : d + ' วันก่อน'; }
function cleanName(s) { return String(s || '').replace(/^(นางสาว|นาย|นาง|เด็กชาย|เด็กหญิง)/, ''); }
function initials(s) { var t = cleanName(s).trim().split(/\s+/); return esc((t[0] || '?').charAt(0) + (t[1] ? t[1].charAt(0) : '')); }

// ---------- แหล่งข้อมูล ----------
function post(url, o) { return fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(o), redirect: 'follow'}).then(function (r) { return r.json(); }); }
// auth: token ของ Apps Script (string) หรือ ฟังก์ชันคืน Promise<Firebase ID token> (AUTH_PROVIDER firebase → ส่งเป็น fbtoken)
function SheetAdapter(url, auth) {
  this.name = 'sheet';
  var body = function (o) { if (typeof auth !== 'function') { o.token = auth; return Promise.resolve(o); } return Promise.resolve(auth()).then(function (t) { o.fbtoken = t; return o; }); };
  this.overview = function () { return body({action: 'dash'}).then(function (o) { return post(url, o); }); };
  this.student = function (sid) { return body({action: 'dash', sid: String(sid)}).then(function (o) { return post(url, o); }); };
}
// fsApi = {list(col) → Promise<[{id, ...data}]>, get(col, id) → Promise<data|null>, set(col, id, data), del(col, id)}
function msOf(v) { if (!v) return 0; if (typeof v === 'number') return v; if (v.toMillis) return v.toMillis(); if (v.seconds != null) return v.seconds * 1000; var t = new Date(v).getTime(); return isFinite(t) ? t : 0; }
function rawFromFirestore(users, results, sessions, now) {
  var roster = [], answers = [], mocks = [], ses = [];
  users.forEach(function (u) { if (u.role === 'teacher' || !u.sid) return; roster.push({sid: String(u.sid), room: String(u.room || ''), no: u.no == null ? '' : u.no, name: String(u.name || '')}); });
  results.forEach(function (r) {
    var ts = msOf(r.ts) || msOf(r.savedAt);
    if (r.type === 'answer') answers.push({sid: String(r.sid), subject: r.subject || 'soc', mode: r.mode || 'practice', set: r.set || '', itemId: String(r.itemId || ''), sara: Number(r.sara) || 0, topic: String(r.topic || ''),
      attempt: Number(r.attempt) || 1, correct: !!r.correct, blank: r.chosen === '' || r.chosen == null, sec: Number(r.sec) || 0, ts: ts, sessionId: r.sessionId || ''});
    else if (r.type === 'mock') mocks.push({sid: String(r.sid), subject: r.subject || 'soc', set: r.set || '', score: Number(r.score) || 0, total: Number(r.total) || 0, usedSec: Number(r.usedSec) || 0, timeout: !!r.timeout, answered: Number(r.answered) || 0, ts: ts});
  });
  sessions.forEach(function (s) { var st = msOf(s.startedAt); ses.push({sid: String(s.sid), sessionId: s.sessionId || '', start: st, last: msOf(s.updatedAt) || st + (Number(s.activeSec) || 0) * 1000, activeSec: Number(s.activeSec) || 0}); });
  return {now: now || Date.now(), roster: roster, answers: answers, mocks: mocks, sessions: ses};
}
function FirestoreAdapter(fsApi) {
  var memo = null, self = this;
  this.name = 'firestore';
  function raw(force) {
    if (!force && memo && Date.now() - memo.at < TTL) return Promise.resolve(memo.raw);
    return Promise.all([fsApi.list('users'), fsApi.list('results'), fsApi.list('sessions')]).then(function (v) {
      memo = {at: Date.now(), raw: rawFromFirestore(v[0], v[1], v[2])}; return memo.raw;
    });
  }
  this.overview = function (force) { return raw(force).then(function (r) { var o = AGG.overview(r, {days: 30}); o.source = 'firestore'; return o; }); };
  this.student = function (sid) { return raw().then(function (r) { var o = AGG.student(r, String(sid)); o.source = 'firestore'; return o; }); };
  this.clear = function () { memo = null; return self; };
}
// ตัวต่อกับ Firebase modular SDK (ใช้เมื่อ fb.js เปิด EG_FB.firestoreHandle() → {fs: M.fs, db})
function fsApiFromModular(fs, db) {
  return {
    list: function (col) { return fs.getDocs(fs.collection(db, col)).then(function (s) { return s.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); }); },
    get: function (col, id) { return fs.getDoc(fs.doc(db, col, id)).then(function (s) { return s.exists() ? s.data() : null; }); },
    set: function (col, id, data) { return fs.setDoc(fs.doc(db, col, id), data); },
    del: function (col, id) { return fs.deleteDoc(fs.doc(db, col, id)); }
  };
}
function firestoreApi() {
  var F = window.EG_FB;
  if (!F || !F.configured || !F.configured() || !F.firestoreHandle) return Promise.resolve(null);
  return F.firestoreHandle().then(function (h) { return h ? fsApiFromModular(h.fs, h.db) : null; }, function () { return null; });
}

// ---------- รูปนักเรียน (เฉพาะครู) ----------
function FirestorePhotoStore(fsApi, by) {
  this.name = 'firestore'; this.note = 'เก็บใน Firestore (เห็นเฉพาะครู)';
  this.get = function (sid) { return fsApi.get('photos', String(sid)).then(function (d) { return d && d.data ? d : null; }); };
  this.put = function (sid, p) { var d = {sid: String(sid), data: p.data, w: p.w, h: p.h, bytes: p.bytes, by: String(by || ''), updatedAt: Date.now()}; return fsApi.set('photos', String(sid), d).then(function () { return d; }); };
  this.del = function (sid) { return fsApi.del('photos', String(sid)); };
}
function LocalPhotoStore() {
  var K = function (sid) { return 'eg6dash:photo:' + sid; };
  this.name = 'local'; this.note = 'เก็บในเครื่องนี้เท่านั้น (ยังไม่ได้เปิด Firestore)';
  this.get = function (sid) { try { return Promise.resolve(JSON.parse(localStorage.getItem(K(sid)) || 'null')); } catch (e) { return Promise.resolve(null); } };
  this.put = function (sid, p) { var d = {sid: String(sid), data: p.data, w: p.w, h: p.h, bytes: p.bytes, updatedAt: Date.now()}; try { localStorage.setItem(K(sid), JSON.stringify(d)); } catch (e) { return Promise.reject(e); } return Promise.resolve(d); };
  this.del = function (sid) { try { localStorage.removeItem(K(sid)); } catch (e) {} return Promise.resolve(); };
}
function b64Bytes(dataUrl) { var b = String(dataUrl).split(',')[1] || ''; return Math.floor(b.length * 3 / 4) - (/==$/.test(b) ? 2 : /=$/.test(b) ? 1 : 0); }
function loadImage(file) {
  if (window.createImageBitmap) return createImageBitmap(file, {imageOrientation: 'from-image'}).catch(function () { return viaImg(); });
  return viaImg();
  function viaImg() { return new Promise(function (res, rej) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { res(im); setTimeout(function () { URL.revokeObjectURL(u); }, 0); }; im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('image')); }; im.src = u; }); }
}
// ย่อ + ตัดกลางเป็นสี่เหลี่ยมจัตุรัส 256px · JPEG · ลดคุณภาพจนไม่เกิน ~35 KB
function resizePhoto(file, px, maxBytes) {
  px = px || PHOTO_PX; maxBytes = maxBytes || PHOTO_MAX;
  return loadImage(file).then(function (img) {
    var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight, s = Math.min(w, h);
    if (!s) throw new Error('image');
    var c = document.createElement('canvas'); c.width = c.height = px;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.imageSmoothingQuality = 'high';
    g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, px, px);
    if (img.close) img.close();
    var q = 0.86, data = c.toDataURL('image/jpeg', q);
    while (b64Bytes(data) > maxBytes && q > 0.4) { q -= 0.08; data = c.toDataURL('image/jpeg', q); }
    return {data: data, w: px, h: px, bytes: b64Bytes(data), quality: Math.round(q * 100) / 100, srcW: w, srcH: h};
  });
}

// ---------- กราฟ (SVG ในหน้า ไม่ใช้ไลบรารีภายนอก) ----------
function dailyChart(days) {
  var W = 720, H = 230, L = 40, R = 40, T = 16, B = 34, n = days.length || 1, bw = (W - L - R) / n;
  var maxA = Math.max(5, Math.max.apply(null, days.map(function (d) { return d.answers; }))), maxP = Math.max(2, Math.max.apply(null, days.map(function (d) { return d.active; })));
  var y = function (v, m) { return T + (H - T - B) * (1 - v / m); }, out = [];
  [0, .5, 1].forEach(function (f) { var yy = y(maxA * f, maxA); out.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="g"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" class="ax" text-anchor="end">' + Math.round(maxA * f) + '</text><text x="' + (W - R + 6) + '" y="' + (yy + 4) + '" class="ax p">' + Math.round(maxP * f) + '</text>'); });
  days.forEach(function (d, i) {
    var x = L + i * bw, hh = (H - T - B) * d.answers / maxA;
    out.push('<rect class="b" x="' + (x + bw * .15).toFixed(1) + '" y="' + (H - B - hh).toFixed(1) + '" width="' + (bw * .7).toFixed(1) + '" height="' + hh.toFixed(1) + '"><title>' + esc(dShort(Date.parse(d.d + 'T12:00:00+07:00'))) + ' · ตอบ ' + d.answers + ' ข้อ · ใช้งาน ' + d.active + ' คน · สอบ ' + d.mocks + ' ครั้ง</title></rect>');
    if (i % 5 === (n - 1) % 5) out.push('<text x="' + (x + bw / 2) + '" y="' + (H - B + 16) + '" class="ax" text-anchor="middle">' + esc(dShort(Date.parse(d.d + 'T12:00:00+07:00'))) + '</text>');
  });
  var pts = days.map(function (d, i) { return (L + i * bw + bw / 2).toFixed(1) + ',' + y(d.active, maxP).toFixed(1); }).join(' ');
  out.push('<polyline class="ln" points="' + pts + '"/>');
  days.forEach(function (d, i) { if (d.active) out.push('<circle class="dt" cx="' + (L + i * bw + bw / 2).toFixed(1) + '" cy="' + y(d.active, maxP).toFixed(1) + '" r="2.6"/>'); });
  return '<svg class="dchart" id="dDaily" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="กิจกรรมรายวัน ' + n + ' วันล่าสุด">' + out.join('') + '</svg>' +
    '<div class="dlegend"><span><i class="b"></i>ข้อที่ตอบ (แกนซ้าย)</span><span><i class="ln"></i>นักเรียนที่ใช้งาน (แกนขวา)</span></div>';
}
function scoreChart(points) {
  var W = 720, H = 220, L = 40, R = 16, T = 14, B = 34;
  if (!points.length) return '<p class="muted small">ยังไม่มีคะแนนในวิชานี้</p>';
  var t0 = Math.min.apply(null, points.map(function (p) { return p.ts; })), t1 = Math.max.apply(null, points.map(function (p) { return p.ts; }));
  if (t1 - t0 < 864e5) { t0 -= 432e5; t1 += 432e5; }
  var x = function (t) { return L + (W - L - R) * (t - t0) / (t1 - t0); }, y = function (v) { return T + (H - T - B) * (1 - v / 100); }, out = [];
  [0, 50, 100].forEach(function (v) { out.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="g"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + v + '%</text>'); });
  out.push('<text x="' + L + '" y="' + (H - 10) + '" class="ax">' + esc(dShort(t0)) + '</text><text x="' + (W - R) + '" y="' + (H - 10) + '" class="ax" text-anchor="end">' + esc(dShort(t1)) + '</text>');
  var sets = points.filter(function (p) { return p.kind === 'set'; }), mk = points.filter(function (p) { return p.kind === 'mock'; });
  sets.forEach(function (p) { out.push('<circle class="sp" cx="' + x(p.ts).toFixed(1) + '" cy="' + y(p.pct).toFixed(1) + '" r="4"><title>' + esc(p.label) + '</title></circle>'); });
  if (mk.length > 1) out.push('<polyline class="ln m" points="' + mk.map(function (p) { return x(p.ts).toFixed(1) + ',' + y(p.pct).toFixed(1); }).join(' ') + '"/>');
  mk.forEach(function (p) { out.push('<circle class="mp" cx="' + x(p.ts).toFixed(1) + '" cy="' + y(p.pct).toFixed(1) + '" r="5.5"><title>' + esc(p.label) + '</title></circle>'); });
  return '<svg class="dchart" id="dScore" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="คะแนนตามเวลา">' + out.join('') + '</svg>' +
    '<div class="dlegend"><span><i class="mp"></i>สอบเสมือนจริง</span><span><i class="sp"></i>ชุดฝึก</span></div>';
}

// ---------- สถานะ ----------
var S = {ctx: null, ad: null, photos: null, ov: null, ovAt: 0, det: {}, q: '', room: '', sort: 'answers'};
function adapter() {
  if (S.ad) return Promise.resolve(S.ad);
  var st = S.ctx.student, want = String(CFG.DASH_SOURCE || 'sheet');
  var p = want === 'firestore' ? firestoreApi() : Promise.resolve(null);
  return p.then(function (api) {
    S.ad = api ? new FirestoreAdapter(api) : new SheetAdapter(S.ctx.saveUrl, S.ctx.fbToken || st.token);
    if (!PHOTOS) { S.photos = null; return S.ad; } // ปิดรูป: ไม่อ่าน/เขียน photos ใด ๆ
    var pp = api ? Promise.resolve(api) : String(CFG.PHOTO_STORE || '') === 'firestore' ? firestoreApi() : Promise.resolve(null);
    return pp.then(function (a2) { S.photos = a2 ? new FirestorePhotoStore(a2, st.name || '') : new LocalPhotoStore(); return S.ad; });
  });
}
var ERR = {forbidden: 'หน้านี้สำหรับครูเท่านั้น', need_login: 'กรุณาออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง', not_found: 'ไม่พบนักเรียนคนนี้', bad: 'ข้อมูลไม่ถูกต้อง'};
function errMsg(r) { if (r && r.error === 'bad action') return 'ระบบหลังบ้านยังไม่รองรับแดชบอร์ด (ต้องติดตั้ง Apps Script รุ่น v7_dash ก่อน)'; if (r && r.code === 'busy') return 'ระบบกำลังมีคนใช้มาก ลองใหม่อีกครั้ง'; return (r && (ERR[r.code] || r.message)) || 'โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง'; }
function overview(force) {
  if (!force && S.ov && Date.now() - S.ovAt < TTL) return Promise.resolve(S.ov);
  return adapter().then(function (a) { return a.overview(force); }).then(function (r) { if (!r || !r.ok) throw r || {}; S.ov = r; S.ovAt = Date.now(); return r; });
}
function detail(sid) {
  var hit = S.det[sid]; if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.d);
  return adapter().then(function (a) { return a.student(sid); }).then(function (r) { if (!r || !r.ok) throw r || {}; S.det[sid] = {at: Date.now(), d: r}; return r; });
}
function subjects() { return (S.ctx.subjects || []).slice(); }
function subjOf(id) { return subjects().filter(function (x) { return x.id === id; })[0] || {id: id, name: id, bank: null}; }
function stuOf(sid) { return S.ov ? S.ov.students.filter(function (s) { return s.sid === String(sid); })[0] : null; }
function exampleBar(d) { return d && d.example ? '<div class="notice dash-ex" id="dExample">ข้อมูลตัวอย่าง · ไม่ใช่ข้อมูลนักเรียนจริง (ใช้ทดสอบระบบเท่านั้น)</div>' : ''; }
function shell(title, crumb, body) {
  return '<div class="dash">' + (crumb ? '<div class="crumb"><a href="' + crumb[0] + '">← ' + esc(crumb[1]) + '</a></div>' : '<div class="crumb"><a href="#/subjects">← เลือกวิชา</a></div>') +
    '<h2>' + esc(title) + '</h2>' + body + '</div>';
}
function loading(t) { S.ctx.view(shell(t, null, '<div class="loading">กำลังโหลดข้อมูล…</div>')); }
function fail(t, e) {
  S.ctx.view(shell(t, null, '<div class="notice err" id="dErr">' + esc(errMsg(e)) + '</div><div class="row" style="margin-top:14px"><button class="btn" id="dRetry" type="button">ลองใหม่</button></div>'));
  var b = $('#dRetry'); if (b) b.onclick = function () { S.ov = null; S.det = {}; route(S.h); };
}

// ---------- มุมมอง 1: ภาพรวม ----------
function stat(v, label, sub, id) { return '<div class="stat"' + (id ? ' id="' + id + '"' : '') + '><b>' + v + '</b><span>' + label + (sub ? '<br><small>' + sub + '</small>' : '') + '</span></div>'; }
function rankRows(list, now) {
  if (!list.length) return '<div class="cell muted">ไม่พบนักเรียน</div>';
  return list.map(function (s) {
    return '<a class="cell dr' + (s.answers ? '' : ' idle') + '" href="#/admin/s/' + esc(s.sid) + '" data-sid="' + esc(s.sid) + '"><span class="rk">' + s.rank + '</span><span class="av" aria-hidden="true">' + initials(s.name) + '</span>' +
      '<span class="nm"><b>' + esc(cleanName(s.name)) + '</b><small>' + esc(s.room) + ' เลขที่ ' + esc(s.no) + ' · ' + esc(s.sid) + '</small></span>' +
      '<span class="nums"><b data-k="answers">' + n0(s.answers) + '</b><small>ข้อ · ' + esc(minsT(s.minutes)) + (s.mocks ? ' · สอบ ' + s.mocks : '') + '</small><small class="' + (s.active7 ? 'on' : '') + '">' + esc(ago(s.last, now)) + '</small></span></a>';
  }).join('');
}
function filtered(d) {
  var q = S.q.trim().toLowerCase().replace(/\s+/g, ''), list = d.students.slice();
  if (S.room) list = list.filter(function (s) { return s.room === S.room; });
  if (q) list = list.filter(function (s) { return (s.name + s.sid + s.room + 'เลขที่' + s.no).toLowerCase().replace(/\s+/g, '').indexOf(q) >= 0; });
  if (S.sort === 'minutes') list.sort(function (a, b) { return b.minutes - a.minutes || a.rank - b.rank; });
  else if (S.sort === 'last') list.sort(function (a, b) { return b.last - a.last || a.rank - b.rank; });
  return list;
}
function pOverview() {
  var T0 = 'แดชบอร์ดครู · ภาพรวม ม.6';
  if (!S.ov) loading(T0);
  overview().then(function (d) {
    var t = d.totals, now = d.at, SUBN = function (id) { return subjOf(id).name; };
    var subjRows = d.subjects.length ? d.subjects.map(function (g) { return '<tr data-subj="' + esc(g.id) + '"><td>' + esc(SUBN(g.id)) + '</td><td class="n">' + g.students + '</td><td class="n">' + g.active7 + '</td><td class="n">' + n0(g.answers) + '</td><td class="n">' + pctT(g.pct) + '</td><td class="n">' + g.mocks + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">ยังไม่มีการใช้งาน</td></tr>';
    var roomRows = d.rooms.map(function (r) { return '<tr data-room="' + esc(r.room) + '"><td>' + esc(r.room) + '</td><td class="n">' + r.students + '</td><td class="n">' + r.active7 + '</td><td class="n">' + r.active30 + '</td><td class="n">' + n0(r.answers) + '</td><td class="n">' + pctT(r.pct) + '</td><td class="n">' + r.mocks + '</td><td class="n">' + esc(minsT(r.minutes)) + '</td></tr>'; }).join('');
    S.ctx.view(shell(T0, null, exampleBar(d) +
      '<p class="muted">' + esc(CFG.SCHOOL || 'โรงเรียนปิยมิตรวิทยา ฝ่ายมัธยม') + ' · อัปเดต ' + esc(dTime(d.at)) + (d.cached ? ' (แคช)' : '') + ' · ข้อมูลรีเฟรชทุก 1 นาที · <button class="linkbtn" id="dRefresh" type="button">รีเฟรช</button></p>' +
      '<div class="stats dstats">' +
        stat(n0(t.active7) + '<small>/' + t.students + '</small>', 'ใช้งาน 7 วันล่าสุด', pctT(t.students ? Math.round(t.active7 * 1000 / t.students) / 10 : null) + ' ของนักเรียน', 'dA7') +
        stat(n0(t.active30) + '<small>/' + t.students + '</small>', 'ใช้งาน 30 วันล่าสุด', pctT(t.students ? Math.round(t.active30 * 1000 / t.students) / 10 : null) + ' ของนักเรียน', 'dA30') +
        stat(n0(t.answers), 'ข้อที่ตอบทั้งหมด', '7 วัน ' + n0(t.answers7) + ' · 30 วัน ' + n0(t.answers30), 'dAns') +
        stat(n0(t.mocks), 'สอบเสมือนจริง (ครั้ง)', '7 วัน ' + n0(t.mocks7) + ' · 30 วัน ' + n0(t.mocks30), 'dMocks') +
        stat(pctT(t.pct), 'ตอบถูกเฉลี่ย', 'ทุกข้อที่ตอบ', 'dPct') +
        stat(minsK(t.minutes), 'เวลาฝึกรวม', 'เฉลี่ย ' + esc(minsT(t.students ? t.minutes / t.students : 0)) + '/คน', 'dMin') +
      '</div>' +
      '<div class="section"><h3>กิจกรรมรายวัน (' + d.days + ' วันล่าสุด)</h3></div><div class="card dcard">' + dailyChart(d.daily) + '</div>' +
      '<div class="dgrid2"><div><div class="section"><h3>การใช้งานรายวิชา</h3></div><div class="card dcard"><table class="tbl" id="dSubj"><thead><tr><th>วิชา</th><th class="n">นักเรียน</th><th class="n">7 วัน</th><th class="n">ข้อที่ตอบ</th><th class="n">ถูก</th><th class="n">สอบ</th></tr></thead><tbody>' + subjRows + '</tbody></table></div></div>' +
      '<div><div class="section"><h3>การใช้งานรายห้อง</h3></div><div class="card dcard dscroll"><table class="tbl" id="dRooms"><thead><tr><th>ห้อง</th><th class="n">คน</th><th class="n">7 วัน</th><th class="n">30 วัน</th><th class="n">ข้อ</th><th class="n">ถูก</th><th class="n">สอบ</th><th class="n">เวลา</th></tr></thead><tbody>' + roomRows + '</tbody></table></div></div></div>' +
      '<div class="section"><h3>อันดับการใช้งาน</h3><span class="muted small">เรียงจากจำนวนข้อที่ตอบมากไปน้อย (เท่ากันดูเวลาฝึก) · แตะชื่อเพื่อดูรายคน</span></div>' +
      '<div class="dtools"><input type="search" id="dQ" placeholder="ค้นหาชื่อ / เลขประจำตัว / ห้อง" value="' + esc(S.q) + '" autocomplete="off" aria-label="ค้นหานักเรียน">' +
        '<select id="dRoom" aria-label="เลือกห้อง"><option value="">ทุกห้อง</option>' + d.rooms.map(function (r) { return '<option' + (S.room === r.room ? ' selected' : '') + '>' + esc(r.room) + '</option>'; }).join('') + '</select>' +
        '<select id="dSort" aria-label="เรียงตาม"><option value="answers"' + (S.sort === 'answers' ? ' selected' : '') + '>ข้อที่ตอบ</option><option value="minutes"' + (S.sort === 'minutes' ? ' selected' : '') + '>เวลาฝึก</option><option value="last"' + (S.sort === 'last' ? ' selected' : '') + '>ใช้ล่าสุด</option></select></div>' +
      '<div class="group drank" id="dRank">' + rankRows(filtered(d), now) + '</div>' +
      '<p class="muted small" style="margin-top:14px">“ใช้งาน” = ตอบข้อสอบ ส่งสอบเสมือนจริง หรือเปิดฝึกในช่วงเวลานั้น · เวลาฝึกนับจากเวลาที่หน้าเว็บเปิดใช้งานจริง · ไม่นับบัญชีครู</p>'));
    var upd = function () { $('#dRank').innerHTML = rankRows(filtered(d), now); };
    $('#dQ').oninput = function () { S.q = this.value; upd(); };
    $('#dRoom').onchange = function () { S.room = this.value; upd(); };
    $('#dSort').onchange = function () { S.sort = this.value; upd(); };
    $('#dRefresh').onclick = function () { S.ov = null; S.det = {}; if (S.ad && S.ad.clear) S.ad.clear(); pOverview(); };
  }, function (e) { fail(T0, e); });
}

// ---------- มุมมอง 2: รายคน ----------
function subjCards(s, now) {
  var have = s.subj || {}, list = subjects().filter(function (x) { return x.live || have[x.id]; });
  return list.map(function (x) {
    var y = have[x.id], cov = x.bank ? AGG.coveredCount(x.bank, y ? y.topicIds : []) : {covered: y ? y.topicIds.length : 0, total: 0};
    var mk = y && y.mock;
    return '<a class="card dsub" href="#/admin/s/' + esc(s.sid) + '/' + esc(x.id) + '" data-subj="' + esc(x.id) + '"><div class="dsub-h"><b>' + esc(x.name) + '</b>' + (x.live ? '' : '<span class="tag">ยังไม่มีคลังข้อสอบ</span>') + '</div>' +
      '<div class="dsub-n"><span data-k="cov">' + cov.covered + '/' + (cov.total || '–') + '</span><small>หัวข้อที่ทำแล้ว</small></div>' +
      '<div class="bar"><i style="width:' + (cov.total ? Math.round(cov.covered * 100 / cov.total) : 0) + '%"></i></div>' +
      '<div class="dsub-m"><span><small>สอบเสมือนจริงล่าสุด</small><b data-k="mock">' + (mk ? mk.score + '/' + mk.total + ' (' + pctT(mk.pct) + ')' : 'ยังไม่เคยสอบ') + '</b>' + (mk ? '<small>' + esc(dOnly(mk.ts)) + '</small>' : '') + '</span>' +
      '<span><small>ใช้ล่าสุด</small><b data-k="last">' + esc(y && y.last ? dOnly(y.last) : 'ยังไม่เคยใช้') + '</b><small>' + (y ? n0(y.answers) + ' ข้อ · ถูก ' + pctT(y.pct) : '') + '</small></span></div></a>';
  }).join('');
}
function picker(d, cur) {
  var rooms = {}; d.students.forEach(function (s) { (rooms[s.room] = rooms[s.room] || []).push(s); });
  return '<div class="dtools"><input type="search" id="dPq" placeholder="ค้นหานักเรียนคนอื่น" autocomplete="off" aria-label="ค้นหานักเรียน">' +
    '<select id="dPick" aria-label="เลือกนักเรียน">' + Object.keys(rooms).sort(AGG.cmpRoom).map(function (r) {
      return '<optgroup label="' + esc(r) + '">' + rooms[r].slice().sort(function (a, b) { return (a.no || 999) - (b.no || 999); }).map(function (s) { return '<option value="' + esc(s.sid) + '"' + (s.sid === cur ? ' selected' : '') + '>' + esc(s.room + ' เลขที่ ' + s.no + ' · ' + cleanName(s.name)) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select></div><div class="group drank" id="dPres" hidden></div>';
}
function bindPicker(d, sufx) {
  var q = $('#dPq'), res = $('#dPres'), sel = $('#dPick');
  sel.onchange = function () { S.ctx.go('#/admin/s/' + this.value + (sufx || '')); };
  q.oninput = function () {
    var v = this.value.trim().toLowerCase().replace(/\s+/g, '');
    if (!v) { res.hidden = true; res.innerHTML = ''; return; }
    var L = d.students.filter(function (s) { return (s.name + s.sid + s.room).toLowerCase().replace(/\s+/g, '').indexOf(v) >= 0; }).slice(0, 8);
    res.hidden = false; res.innerHTML = rankRows(L, d.at);
  };
}
function photoBlock(s) {
  if (!PHOTOS) return '<div class="dphoto"><div class="dph"><span class="av big" aria-hidden="true">' + initials(s.name) + '</span></div></div>';
  return '<div class="dphoto"><div class="dph" id="dPh"><span class="av big" aria-hidden="true">' + initials(s.name) + '</span></div>' +
    '<div class="dph-b"><label class="btn small">ถ่ายรูป<input type="file" accept="image/*" capture="environment" id="dCam" hidden></label>' +
    '<label class="btn small">เลือกรูป<input type="file" accept="image/*" id="dFile" hidden></label>' +
    '<button class="btn small ghost" type="button" id="dDel" hidden>ลบรูป</button></div><p class="muted small" id="dPhN"></p></div>';
}
function showPhoto(p, s) {
  var box = $('#dPh'); if (!box) return;
  if (p && p.data && /^data:image\/jpeg;base64,/.test(p.data)) box.innerHTML = '<img id="dPhoto" src="' + p.data + '" alt="รูปของ ' + esc(cleanName(s.name)) + '" width="128" height="128" data-bytes="' + (p.bytes || 0) + '" data-w="' + (p.w || 0) + '">';
  else box.innerHTML = '<span class="av big" aria-hidden="true">' + initials(s.name) + '</span>';
  var del = $('#dDel'); if (del) del.hidden = !(p && p.data);
}
function bindPhoto(s) {
  var st = S.photos, note = $('#dPhN');
  if (!PHOTOS || !st || !note) return;
  note.textContent = 'รูปเห็นเฉพาะครู · ' + st.note;
  st.get(s.sid).then(function (p) { showPhoto(p, s); }, function () {});
  var onPick = function () {
    var f = this.files && this.files[0]; this.value = ''; if (!f) return;
    note.textContent = 'กำลังย่อรูป…';
    resizePhoto(f).then(function (p) { return st.put(s.sid, p); }).then(function (p) {
      showPhoto(p, s); note.textContent = 'บันทึกรูปแล้ว (' + p.w + '×' + p.h + ' พิกเซล · ' + Math.round(p.bytes / 1024) + ' KB) · รูปเห็นเฉพาะครู · ' + st.note;
    }, function () { note.textContent = 'บันทึกรูปไม่สำเร็จ ลองรูปอื่นหรือลองใหม่'; });
  };
  $('#dCam').onchange = onPick; $('#dFile').onchange = onPick;
  $('#dDel').onclick = function () { if (!window.confirm('ลบรูปของนักเรียนคนนี้?')) return; st.del(s.sid).then(function () { showPhoto(null, s); note.textContent = 'ลบรูปแล้ว'; }); };
}
function pStudent(sid) {
  var T0 = 'นักเรียนรายคน';
  if (!S.ov) loading(T0);
  overview().then(function (d) {
    var s = stuOf(sid);
    if (!s) return fail(T0, {code: 'not_found'});
    return adapter().then(function () {
      S.ctx.view(shell(cleanName(s.name), ['#/admin', 'ภาพรวม'], exampleBar(d) +
        '<div class="card dprof" id="dProf" data-sid="' + esc(s.sid) + '">' + photoBlock(s) +
        '<div class="dinfo"><div class="dname" id="dName">' + esc(s.name) + '</div><div class="dmeta"><span>เลขประจำตัว <b id="dSid">' + esc(s.sid) + '</b></span><span>ห้อง <b id="dRoomV">' + esc(s.room) + '</b> เลขที่ <b>' + esc(s.no) + '</b></span></div>' +
        '<div class="stats dstats sm">' + stat('#' + s.rank + '<small>/' + d.students.length + '</small>', 'อันดับการใช้งาน') + stat(n0(s.answers), 'ข้อที่ตอบ', 'ถูก ' + pctT(s.pct)) + stat(minsK(s.minutes), 'เวลาฝึก') + stat(n0(s.mocks), 'สอบเสมือนจริง', esc(ago(s.last, d.at))) + '</div></div></div>' +
        '<div class="section"><h3>รายวิชา</h3><span class="muted small">แตะวิชาเพื่อดูรายหัวข้อและประวัติการสอบ</span></div><div class="dsubs" id="dSubs">' + subjCards(s, d.at) + '</div>' +
        '<div class="section"><h3>เลือกนักเรียนคนอื่น</h3></div>' + picker(d, s.sid)));
      bindPhoto(s); bindPicker(d, '');
    });
  }).catch(function (e) { fail(T0, e); });
}

// ---------- มุมมอง 3: รายวิชาของนักเรียน ----------
var MODE_T = {practice: 'ฝึก', review: 'ทบทวนข้อที่ผิด', mock: 'สอบเสมือนจริง'};
function setName(x, id) { var b = x.bank, m = b && (b.mocks || []).filter(function (k) { return k.id === id; })[0]; return m ? m.name : id; }
function pSubject(sid, subId) {
  var T0 = 'รายวิชา', x = subjOf(subId);
  if (!S.ov) loading(T0);
  Promise.all([overview(), detail(sid)]).then(function (v) {
    var d = v[0], det = v[1], s = stuOf(sid); if (!s) return fail(T0, {code: 'not_found'});
    var y = det.subjects[subId] || {topics: {}, sets: [], mocks: []}, sum = (s.subj || {})[subId] || {answers: 0, pct: null};
    var cov = x.bank ? AGG.coverage(x.bank, y.topics) : {saras: [{id: '', name: 'หัวข้อที่มีผล', topics: Object.keys(y.topics).sort().map(function (k) { var t = y.topics[k]; return {id: k, name: '', bankItems: 0, covered: true, n: t.n, c: t.c, items: t.items, pct: t.pct, last: t.last}; })}], total: 0, covered: Object.keys(y.topics).length};
    var hist = y.mocks.map(function (m) { return {ts: m.ts, kind: 'mock', pct: m.pct || 0, label: 'สอบเสมือนจริง ' + setName(x, m.set) + ' · ' + m.score + '/' + m.total + ' · ' + dTime(m.ts)}; })
      .concat(y.sets.map(function (st) { return {ts: st.ts, kind: 'set', pct: st.pct || 0, label: (MODE_T[st.mode] || 'ฝึก') + ' · ' + st.c + '/' + st.n + ' · ' + dTime(st.ts)}; }));
    var rows = y.mocks.map(function (m) { return {ts: m.ts, h: '<tr class="mk" data-kind="mock">' + dCell(m.ts) + '<td>สอบเสมือนจริง<br><small class="muted">' + esc(setName(x, m.set)) + (m.timeout ? ' · หมดเวลา' : '') + '</small></td><td class="n"><b>' + m.score + '/' + m.total + '</b><br><small>' + pctT(m.pct) + '</small></td><td class="n du">' + esc(secT(m.usedSec)) + '</td></tr>'}; })
      .concat(y.sets.map(function (st) { return {ts: st.ts, h: '<tr data-kind="set">' + dCell(st.ts) + '<td>' + esc(MODE_T[st.mode] || 'ฝึก') + '<br><small class="muted">ชุดฝึก ' + st.n + ' ข้อ</small></td><td class="n"><b>' + st.c + '/' + st.n + '</b><br><small>' + pctT(st.pct) + '</small></td><td class="n du">' + esc(secT(st.sec)) + '</td></tr>'}; }))
      .sort(function (a, b) { return b.ts - a.ts; }).map(function (r) { return r.h; }).join('');
    var best = y.mocks.reduce(function (m, k) { return !m || k.pct > m.pct ? k : m; }, null);
    S.ctx.view(shell(x.name + ' · ' + cleanName(s.name), ['#/admin/s/' + s.sid, cleanName(s.name)], exampleBar(d) +
      '<p class="muted">' + esc(s.room) + ' เลขที่ ' + esc(s.no) + ' · เลขประจำตัว ' + esc(s.sid) + (x.exam ? ' · ' + esc(x.exam) : '') + '</p>' +
      '<div class="stats dstats">' + stat('<span id="dCov">' + cov.covered + '/' + (cov.total || '–') + '</span>', 'หัวข้อที่ทำแล้ว') + stat(n0(sum.answers), 'ข้อที่ตอบ', 'ถูก ' + pctT(sum.pct)) +
        stat(String(y.mocks.length), 'สอบเสมือนจริง', best ? 'ดีที่สุด ' + best.score + '/' + best.total : 'ยังไม่เคยสอบ') + stat(String(y.sets.length), 'ชุดฝึก', '') + '</div>' +
      '<div class="section"><h3>คะแนนตามเวลา</h3></div><div class="card dcard">' + scoreChart(hist) + '</div>' +
      '<div class="section"><h3>รายหัวข้อ</h3><span class="muted small">✓ = ทำแล้วอย่างน้อย 1 ข้อ · ร้อยละถูกนับทุกครั้งที่ตอบ</span></div>' +
      '<div class="dtopics" id="dTopics">' + cov.saras.map(function (sa) {
        return '<div class="card dsara"><h4>' + (sa.id !== '' ? 'สาระ ' + esc(sa.id) + ' · ' : '') + esc(sa.name) + '</h4><div class="group">' + sa.topics.map(function (t) {
          return '<div class="cell dt' + (t.covered ? ' cov' : ' unc') + '" data-topic="' + esc(t.id) + '" data-covered="' + (t.covered ? '1' : '0') + '"><span class="mk" aria-label="' + (t.covered ? 'ทำแล้ว' : 'ยังไม่ทำ') + '">' + (t.covered ? '✓' : '○') + '</span>' +
            '<span class="nm"><b>' + esc(t.id) + '</b> ' + esc(t.name) + '<small>' + (t.covered ? 'ทำ ' + t.items + (t.bankItems ? '/' + t.bankItems : '') + ' ข้อ · ตอบ ' + t.n + ' ครั้ง · ล่าสุด ' + esc(dOnly(t.last)) : 'ยังไม่ทำ' + (t.bankItems ? ' · คลังมี ' + t.bankItems + ' ข้อ' : '')) + '</small></span>' +
            '<span class="pc' + (t.pct == null ? '' : t.pct >= 70 ? ' hi' : t.pct >= 50 ? ' md' : ' lo') + '" data-k="pct">' + (t.covered ? pctT(t.pct) : '–') + '</span></div>';
        }).join('') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="section"><h3>ประวัติการสอบและชุดฝึก</h3></div><div class="card dcard dscroll"><table class="tbl" id="dHist"><thead><tr><th>วันที่</th><th>ประเภท</th><th class="n">คะแนน</th><th class="n">เวลา</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="muted">ยังไม่มีประวัติในวิชานี้</td></tr>') + '</tbody></table></div>' +
      '<div class="section"><h3>ดูนักเรียนคนอื่นในวิชานี้</h3></div>' + picker(d, s.sid)));
    bindPicker(d, '/' + subId);
  }).catch(function (e) { fail(T0, e); });
}

// ---------- เส้นทาง ----------
function route(h, ctx) {
  if (ctx) { if (S.ctx && S.ctx.student && ctx.student && (S.ctx.student.token !== ctx.student.token || S.ctx.student.uid !== ctx.student.uid)) reset(); S.ctx = ctx; } S.h = h; // เปลี่ยนผู้ใช้ = ล้างข้อมูลในหน่วยความจำ
  var m;
  if ((m = h.match(/^\/admin\/s\/(\d{3,8})\/([a-z0-9]+)$/))) return pSubject(m[1], m[2]);
  if ((m = h.match(/^\/admin\/s\/(\d{3,8})$/))) return pStudent(m[1]);
  return pOverview();
}
function reset() { S.ad = null; S.photos = null; S.ov = null; S.det = {}; }
window.EGDash = {photosOn: function () { return PHOTOS; }, route: route, reset: reset, resizePhoto: resizePhoto, b64Bytes: b64Bytes, rawFromFirestore: rawFromFirestore,
  SheetAdapter: SheetAdapter, FirestoreAdapter: FirestoreAdapter, FirestorePhotoStore: FirestorePhotoStore, LocalPhotoStore: LocalPhotoStore, fsApiFromModular: fsApiFromModular, _state: S};
})();
