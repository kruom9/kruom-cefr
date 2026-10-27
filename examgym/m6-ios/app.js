/* Exam Gym ม.6 · โรงเรียนปิยมิตรวิทยา ฝ่ายมัธยม · ครูออม · หน้าเว็บ (ไม่มีรายชื่อนักเรียนในไฟล์นี้ · รายชื่อดึงจาก Apps Script) */
(function () {
'use strict';
var CFG = window.EXAMGYM_CONFIG || {}, BANK = window.SOC_BANK;
var SAVE_URL = String(CFG.SAVE_URL || '').trim();
var BACKEND = /^https?:\/\//.test(SAVE_URL) && !/PASTE/i.test(SAVE_URL);
var VERSION = CFG.VERSION || 'examgym-m6';
var $ = function (s, r) { return (r || document).querySelector(s); };
var app = $('#app');
var ITEMS = {}; BANK.items.forEach(function (it) { ITEMS[it.id] = it; });
var SARA = {}; BANK.saras.forEach(function (s) { SARA[s.id] = s; });
var TOPIC = {}; BANK.saras.forEach(function (s) { s.topics.forEach(function (t) { TOPIC[t.id] = t; }); });
var SHORT = {1: 'ศาสนา', 2: 'หน้าที่พลเมือง', 3: 'เศรษฐศาสตร์', 4: 'ประวัติศาสตร์', 5: 'ภูมิศาสตร์'};
var SUBJECTS = [
  {id: 'soc', name: 'สังคมศึกษา', exam: 'A-Level 70 สังคมศึกษา', live: true},
  {id: 'thai', name: 'ภาษาไทย', exam: 'A-Level 81 ภาษาไทย'},
  {id: 'eng', name: 'ภาษาอังกฤษ', exam: 'A-Level 82 ภาษาอังกฤษ'},
  {id: 'phy', name: 'ฟิสิกส์', exam: 'A-Level 64 ฟิสิกส์'},
  {id: 'chem', name: 'เคมี', exam: 'A-Level 65 เคมี'},
  {id: 'bio', name: 'ชีววิทยา', exam: 'A-Level 66 ชีววิทยา'},
  {id: 'sci', name: 'วิทยาศาสตร์ประยุกต์', exam: 'A-Level 63 วิทยาศาสตร์ประยุกต์'},
  {id: 'tgat1', name: 'TGAT1 การสื่อสารภาษาอังกฤษ', exam: 'TGAT1'},
  {id: 'tgat2', name: 'TGAT2 การคิดอย่างมีเหตุผล', exam: 'TGAT2'},
  {id: 'tgat3', name: 'TGAT3 สมรรถนะการทำงาน', exam: 'TGAT3'}
];

// ---------- utils ----------
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function ls(k, v) { try { if (arguments.length > 1) { localStorage.setItem('eg6:' + k, JSON.stringify(v)); return v; } var x = localStorage.getItem('eg6:' + k); return x ? JSON.parse(x) : null; } catch (e) { return null; } }
function rid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pct(c, n) { return n ? Math.round(c / n * 100) : 0; }
function mmss(s) { s = Math.max(0, Math.round(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
function mins(s) { s = Math.round((s || 0) / 60); return s < 60 ? s + ' นาที' : Math.floor(s / 60) + ' ชม. ' + (s % 60) + ' นาที'; }
function thDate(t) { var d = new Date(t); return d.toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' น.'; }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
var EMPH = /(ไม่ถูกต้อง|ไม่ถูก|ไม่ใช่|ไม่สามารถ|ไม่อาจ|ไม่สะท้อน|ไม่สัมพันธ์|ไม่สอดคล้อง|ไม่ได้|ไม่เป็น|ไม่ถือ|ยกเว้น|น้อยที่สุด|มากที่สุด|เหมาะสมที่สุด|ชัดเจนที่สุด|ถูกต้องที่สุด|แตกต่างจากข้ออื่น)/g;
function emph(s) { return esc(s).replace(EMPH, '<span class="em">$1</span>'); }
function isRight(it, c) { if (it.key === 'free') return c != null && c !== ''; return it.key.indexOf(Number(c)) >= 0; }
function keyText(it) { return it.key === 'free' ? 'ทุกตัวเลือก (ทปอ. ประกาศให้คะแนนทุกคน)' : it.key.map(function (k) { return 'ข้อ ' + k; }).join(' หรือ '); }
function itemLen(it) { return (it.stem || '').length + it.choices.join('').length + (it.table ? JSON.stringify(it.table).length : 0); }
function cite(it) { return 'ข้อสอบ A-Level 70 สังคมศึกษา ปีการศึกษา ' + it.year + ' ข้อ ' + it.n + ' · ทปอ. เผยแพร่ที่ mytcas.com (สอบ ' + BANK.meta.dates[it.year] + ') · เฉลยตามที่ ทปอ. เผยแพร่ · คำอธิบายจัดทำเพิ่มเพื่อการฝึก (ร่าง รอครูตรวจ)'; }
function itemsOf(f) { return BANK.items.filter(f).sort(function (a, b) { return a.sara - b.sara || b.year - a.year || a.n - b.n; }); }

// ---------- student & progress ----------
var student = ls('student'); // {room,no,name,role,token} (รุ่น 2) · {room,no,name,code,sid} (รุ่น 1) · {preview}
function pkey() { return student ? (student.preview ? 'preview' : student.room + '#' + student.no) : 'none'; }
function prog() { var p = ls('p:' + pkey()) || {}; p.items = p.items || {}; p.mocks = p.mocks || []; p.active = p.active || 0; return p; }
function saveProg(p) { ls('p:' + pkey(), p); }

// ---------- JSONP / sync ----------
function jsonp(params, timeout) {
  return new Promise(function (res, rej) {
    var cb = '__eg' + Math.random().toString(36).slice(2), s = document.createElement('script'), done = false;
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var t = setTimeout(function () { fin(); rej(new Error('timeout')); }, timeout || 15000);
    function fin() { done = true; clearTimeout(t); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
    window[cb] = function (d) { if (done) return; fin(); res(d); };
    s.onerror = function () { if (done) return; fin(); rej(new Error('network')); };
    s.src = SAVE_URL + (SAVE_URL.indexOf('?') < 0 ? '?' : '&') + q + '&callback=' + cb + '&_=' + Date.now();
    document.head.appendChild(s);
  });
}
var Q = {
  list: function () { return ls('q') || []; },
  put: function (a) { ls('q', a); updSync(); },
  add: function (ev) { if (!student || student.preview || !BACKEND) return; ev.stu = pkey(); ev.ts = ev.ts || Date.now(); var a = Q.list(); if (ev.type === 'session') a = a.filter(function (x) { return !(x.type === 'session' && x.sessionId === ev.sessionId); }); a.push(ev); if (a.length > 3000) a = a.slice(-3000); Q.put(a); },
  busy: false, fails: 0, last: 0, state: 'ok', blocked: ''
};
function updSync() {
  var el = $('#sync'); if (!el) return;
  if (!student) { el.hidden = true; return; }
  el.hidden = false;
  if (student.preview || !BACKEND) { el.className = 'sync prev'; el.textContent = 'โหมดตัวอย่าง · ไม่บันทึกผล'; return; }
  var n = Q.list().filter(function (x) { return x.stu === pkey() && x.type !== 'session'; }).length;
  if (Q.blocked) { el.className = 'sync off'; el.textContent = 'บันทึกไม่ได้ · ติดต่อครูออม'; }
  else if (!navigator.onLine || Q.state === 'off') { el.className = 'sync off'; el.textContent = 'ออฟไลน์ · เก็บไว้ในเครื่อง ' + n + ' รายการ'; }
  else if (n) { el.className = 'sync wait'; el.textContent = 'กำลังส่ง ' + n + ' รายการ…'; }
  else { el.className = 'sync ok'; el.textContent = 'บันทึกแล้ว ✓'; }
}
function stuPayload() { return {room: student.room, name: student.name, no: student.no, sid: student.sid || '', code: student.code || ''}; }
function relogin(msg) { student = null; ls('student', null); Q.blocked = ''; AUTH_FLASH = msg || 'กรุณาเข้าสู่ระบบอีกครั้ง'; go('#/register'); }
var AUTH_FLASH = '';
function flush(force) {
  if (!BACKEND || !student || student.preview || Q.busy || Q.blocked) return Promise.resolve();
  var pk = pkey(), mine = Q.list().filter(function (x) { return x.stu === pk; });
  if (!mine.length) { Q.state = 'ok'; updSync(); return Promise.resolve(); }
  if (!force && Date.now() - Q.last < Math.min(120000, 4000 * Math.pow(2, Q.fails))) return Promise.resolve();
  Q.busy = true; Q.last = Date.now();
  var batch = mine.slice(0, 40), ids = batch.map(function (x) { return x.eid; });
  var body = JSON.stringify({action: 'events', api: student.token ? 2 : 1, version: VERSION, token: student.token || undefined, student: student.token ? undefined : stuPayload(), events: batch.map(function (x) { var y = {}; for (var k in x) if (k !== 'stu') y[k] = x[k]; return y; })});
  function drop(list) { var set = {}; list.forEach(function (e) { set[e] = 1; }); Q.put(Q.list().filter(function (x) { return !(x.stu === pk && set[x.eid]); })); }
  return fetch(SAVE_URL, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: body, redirect: 'follow'})
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.ok) { drop((d.saved || []).concat(d.dup || [], d.bad || [])); Q.fails = 0; Q.state = 'ok'; }
      else if (d && d.error === 'not on roster') { Q.blocked = d.message || 'ไม่พบชื่อในรายชื่อ'; }
      else if (d && d.error === 'need login') { relogin(d.message); }
      else throw new Error('bad reply');
    })
    .catch(function () {
      // อ่านคำตอบไม่ได้ (เครือข่าย/ข้อจำกัดเบราว์เซอร์) → ส่งแบบ no-cors แล้วตรวจกับเซิร์ฟเวอร์ว่าบันทึกแล้วหรือยัง
      if (!navigator.onLine) { Q.fails++; Q.state = 'off'; return; }
      return fetch(SAVE_URL, {method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: body})
        .then(function () { return new Promise(function (r) { setTimeout(r, 2500); }); })
        .then(function () { return jsonp({action: 'ack', eids: ids.filter(function (e, i) { return batch[i].type !== 'session'; }).join(',')}); })
        .then(function (d) { var have = (d && d.have) || []; drop(have.concat(batch.filter(function (x) { return x.type === 'session'; }).map(function (x) { return x.eid; }))); Q.fails = have.length ? 0 : Q.fails + 1; Q.state = 'ok'; })
        .catch(function () { Q.fails++; Q.state = 'off'; });
    })
    .then(function () { Q.busy = false; updSync(); if (student && Q.list().some(function (x) { return x.stu === pkey(); }) && Q.fails === 0 && !Q.blocked) setTimeout(function () { flush(true); }, 300); });
}
window.addEventListener('online', function () { Q.fails = 0; flush(true); });
window.addEventListener('offline', updSync);
setInterval(function () { flush(false); }, 15000);

// ---------- active time (หยุดนับเมื่อซ่อนแท็บ หรือไม่ใช้งานเกิน 3 นาที) ----------
var ACT = {sessionId: rid('S'), start: Date.now(), sec: 0, items: 0, lastInput: Date.now(), lastSent: 0, itemSec: 0};
['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(function (e) { window.addEventListener(e, function () { ACT.lastInput = Date.now(); }, {passive: true}); });
function activeNow() { return document.visibilityState === 'visible' && Date.now() - ACT.lastInput < 180000; }
setInterval(function () {
  if (!student) return;
  if (activeNow()) { ACT.sec++; ACT.itemSec++; if (ACT.sec % 30 === 0) { var p = prog(); p.active += 30; saveProg(p); } }
  if (ACT.sec - ACT.lastSent >= 60) sendSession();
  if (window.__tick) window.__tick();
}, 1000);
function sendSession() {
  if (!student || ACT.sec === ACT.lastSent) return;
  ACT.lastSent = ACT.sec;
  Q.add({type: 'session', eid: ACT.sessionId + '-' + ACT.sec, sessionId: ACT.sessionId, activeSec: ACT.sec, items: ACT.items, startedAt: ACT.start, ua: (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'มือถือ' : 'คอมพิวเตอร์') + ' ' + window.innerWidth + 'px', version: VERSION});
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { sendSession(); flush(true); } else { ACT.lastInput = Date.now(); flush(true); } });

function record(it, chosen, mode, set, sec) {
  var p = prog(), x = p.items[it.id] = p.items[it.id] || {att: 0};
  var ok = chosen !== '' && chosen != null && isRight(it, chosen);
  x.att++; if (x.att === 1) x.first = ok; x.last = chosen; x.ok = ok; x.at = Date.now(); if (!ok && chosen !== '') x.wrong = (x.wrong || 0) + 1;
  saveProg(p); ACT.items++;
  Q.add({type: 'answer', eid: rid('A'), sessionId: ACT.sessionId, subject: 'soc', mode: mode, set: set || '', itemId: it.id, sara: it.sara, topic: it.topic, attempt: x.att, chosen: chosen === '' || chosen == null ? '' : Number(chosen), correct: ok, sec: Math.round(sec * 10) / 10, len: itemLen(it)});
  return ok;
}

// ---------- render helpers ----------
function setWho() {
  var w = $('#who');
  if (student) { w.hidden = false; w.textContent = student.preview ? 'ครู/ผู้ตรวจ (ตัวอย่าง)' : student.role === 'teacher' ? 'ครู · ' + student.name : student.room + ' เลขที่ ' + student.no + ' · ' + student.name.replace(/^(นางสาว|นาย|นาง|เด็กชาย|เด็กหญิง)/, ''); }
  else w.hidden = true;
  updSync();
}
function view(html) { window.__tick = null; app.innerHTML = html; window.scrollTo(0, 0); setWho(); }
function go(h) { if (location.hash === h) route(); else location.hash = h; }
function stemHtml(it) {
  var h = '', lines = String(it.stem).split('\n');
  lines.forEach(function (l) { if (/^“|^"/.test(l) && /”$|"$|”\s*$/.test(l)) h += '<blockquote>' + emph(l) + '</blockquote>'; else h += '<p>' + emph(l) + '</p>'; });
  if (it.img) h += '<img class="qimg" src="img/' + esc(it.img) + '" alt="ภาพประกอบโจทย์ (จากข้อสอบต้นฉบับ)">';
  if (it.table) { h += '<table class="qtable"><thead><tr>' + it.table[0].map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + it.table.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }
  if (it.after) h += '<p>' + emph(it.after) + '</p>';
  return '<div class="stem">' + h + '</div>';
}
function badge(it) { return '<span class="tag src">ข้อสอบจริง ทปอ. ปี ' + it.year + ' ข้อ ' + it.n + '</span>'; }
function choicesHtml(it, opts) {
  opts = opts || {};
  return '<div class="choices">' + it.choices.map(function (c, i) {
    var k = i + 1, cls = 'ch', ex = '';
    if (opts.reveal) {
      var r = it.key === 'free' ? false : it.key.indexOf(k) >= 0;
      if (r) cls += ' right'; else if (String(opts.chosen) === String(k)) cls += ' wrong';
      if (it.key === 'free' && String(opts.chosen) === String(k)) cls += ' sel';
      ex = '<span class="ex"><i class="' + (r ? '' : 'x') + '">' + (r ? '✓' : (it.key === 'free' ? '•' : '✗')) + '</i>' + esc(it.e[i]) + '</span>';
    } else if (String(opts.chosen) === String(k)) cls += ' sel';
    return '<button class="' + cls + '" data-k="' + k + '"' + (opts.reveal ? ' disabled' : '') + '><span class="k">' + k + '</span><span class="t">' + esc(c) + ex + '</span></button>';
  }).join('') + '</div>';
}
function explainHtml(it, chosen, mode) {
  var ok = chosen !== '' && chosen != null && isRight(it, chosen), h = '';
  if (mode !== 'review-mock' || true) h += '<div class="verdict ' + (ok ? 'ok' : 'no') + '">' + (chosen === '' || chosen == null ? '— ไม่ได้ตอบข้อนี้ · คำตอบที่ถูก: ' + keyText(it) : ok ? '✓ ถูกต้อง' + (it.key === 'free' ? ' (ข้อนี้ ทปอ. ให้คะแนนทุกคน)' : '') : '✗ ยังไม่ถูก · คำตอบที่ถูก: ' + keyText(it)) + '</div>';
  h += '<div class="keybox"><b>แนวคิดหลัก</b> · ' + esc(it.k) + '</div>';
  if (BANK.meta.notes[it.id]) h += '<div class="flag">หมายเหตุเฉลย: ' + esc(BANK.meta.notes[it.id]) + '</div>';
  if (it.f) h += '<div class="flag">ข้อควรรู้: ' + esc(it.f) + '</div>';
  h += '<div class="cite">ที่มา: ' + esc(cite(it)) + '</div>';
  return h;
}

// ---------- pages ----------
function pLanding() {
  view('<section class="hero"><div>' +
    '<span class="kicker">ระบบของโรงเรียนปิยมิตรวิทยา ฝ่ายมัธยม</span>' +
    '<h1>Exam Gym <span>ม.6</span></h1>' +
    '<p class="school">ยิมฝึกทำข้อสอบเข้ามหาวิทยาลัย (TCAS)</p>' +
    '<p class="lead">ฝึกทีละข้อ รู้ผลทันที มีคำอธิบายภาษาไทยทุกตัวเลือก และสอบเสมือนจริงจับเวลาเท่าสนามจริง · เริ่มที่วิชาสังคมศึกษา (A-Level) ด้วยข้อสอบจริงที่ ทปอ. เผยแพร่</p>' +
    '<div class="row">' + (student ? '<a class="btn pri big" href="#/subjects">เข้าสู่ Exam Gym →</a><button class="btn ghost" id="logout">ไม่ใช่ฉัน / เปลี่ยนชื่อ</button>' : '<a class="btn pri big" href="#/register">ลงทะเบียนเข้าใช้ →</a>') + '</div>' +
    (student ? '<p class="muted small" style="margin-top:12px">เข้าใช้ในชื่อ ' + esc(student.preview ? 'ครู/ผู้ตรวจ (โหมดตัวอย่าง)' : student.role === 'teacher' ? student.name + ' · ครู' : student.name + ' · ' + student.room + ' เลขที่ ' + student.no) + '</p>' : '<p class="muted small" style="margin-top:12px">สำหรับนักเรียน ม.6 ที่มีชื่อในรายชื่อของโรงเรียนเท่านั้น</p>') +
    '</div><div class="logo-wrap"><img src="assets/piyamit-logo-256.png" alt="ตราโรงเรียนปิยมิตรวิทยา" width="256" height="256"></div></section>' +
    '<div class="feat">' +
    '<div class="card"><b>100 ข้อจริง</b><span>A-Level สังคม ปี 2568 + 2569 จาก ทปอ.</span></div>' +
    '<div class="card"><b>5 สาระ 17 หัวข้อ</b><span>เลือกฝึกเฉพาะเรื่องที่อยากเก่ง</span></div>' +
    '<div class="card"><b>อธิบายทุกตัวเลือก</b><span>รู้ว่าทำไมถูก ทำไมผิด</span></div>' +
    '<div class="card"><b>สอบเสมือนจริง</b><span>50 ข้อ 90 นาที เหมือนสนามสอบ</span></div></div>');
  var lo = $('#logout'); if (lo) lo.onclick = function () { logout(); };
}
function logout() {
  sendSession();
  if (student && student.token && BACKEND) { var tk = student.token; flush(true).then(function () { try { fetch(SAVE_URL, {method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action: 'logout', token: tk})}); } catch (e) {} }); }
  student = null; ls('student', null); go('#/register');
}

function pRegister() {
  if (!BACKEND) return pRegisterV1();
  view('<div class="loading">กำลังโหลด…</div>');
  jsonp({action: 'health'}).then(function (d) { if (d && d.auth >= 5) pLogin5(); else if (d && d.auth === 4) pLogin4(); else if (d && d.auth === 3) pLogin3(); else if (d && d.auth === 2) pAuth(d); else pRegisterV1(); })
    .catch(function () { view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2>เข้าสู่ระบบ</h2><div class="notice err">เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</div><div class="auth"><button class="btn pri big" id="retry">ลองใหม่</button></div>'); $('#retry').onclick = pRegister; });
}
// ---------- เข้าสู่ระบบรุ่น 1 (รายชื่อ) · ใช้เฉพาะเมื่อ backend ยังเป็นรุ่นเก่า ----------
function pRegisterV1() {
  if (!BACKEND) {
    view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2>ลงทะเบียน</h2>' +
      '<div class="notice">ระบบบันทึกผล (Google Sheet ของครูออม) ยังไม่ได้เชื่อมต่อ · รายชื่อนักเรียนจะแสดงเมื่อเชื่อมต่อแล้ว</div>' +
      (CFG.PREVIEW_WHEN_NO_BACKEND ? '<div class="card" style="margin-top:16px"><h3>โหมดตัวอย่าง (สำหรับครูตรวจระบบ)</h3><p class="muted">ใช้งานได้ทุกหน้า แต่ไม่บันทึกผลไปที่ Google Sheet</p><button class="btn pri big" id="pv">เข้าดูแบบตัวอย่าง →</button></div>' : ''));
    var pv = $('#pv'); if (pv) pv.onclick = function () { student = {preview: true, name: 'ผู้ตรวจ', room: '-', no: 0}; ls('student', student); go('#/subjects'); };
    return;
  }
  var st = {room: '', code: '', names: null, meta: null};
  function step(n) { return '<div class="steps"><span class="' + (n === 1 ? 'on' : '') + '">1 เลือกห้อง</span><span class="' + (n === 2 ? 'on' : '') + '">2 เลือกชื่อ</span><span class="' + (n === 3 ? 'on' : '') + '">3 ยืนยัน</span></div>'; }
  function s1() {
    view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2>ลงทะเบียนเข้าใช้</h2>' + step(1) + '<div class="card"><h3>เลือกห้องของฉัน</h3><div id="rooms" class="rooms"><div class="muted">กำลังโหลดรายชื่อห้อง…</div></div><div id="codeBox"></div></div>');
    jsonp({action: 'rooms'}).then(function (d) {
      st.meta = d;
      if (!d || !d.ok || !d.rooms || !d.rooms.length) throw new Error('empty');
      $('#rooms').innerHTML = d.rooms.map(function (r) { return '<button class="btn" data-r="' + esc(r.room) + '">' + esc(r.room) + '</button>'; }).join('');
      if (d.roomCode === 'on') $('#codeBox').innerHTML = '<p style="margin:16px 0 6px">รหัสห้อง (ถามครูออม)</p><input class="txt" id="code" inputmode="numeric" autocomplete="off" placeholder="พิมพ์รหัสห้อง">';
      Array.prototype.forEach.call(document.querySelectorAll('#rooms button'), function (b) { b.onclick = function () { st.room = b.dataset.r; st.code = $('#code') ? $('#code').value.trim() : ''; s2(); }; });
    }).catch(function () { $('#rooms').innerHTML = '<div class="notice err">โหลดรายชื่อห้องไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</div><button class="btn" id="retry" style="margin-top:12px">ลองใหม่</button>'; $('#retry').onclick = s1; });
  }
  function s2() {
    view('<div class="crumb"><a href="#/register" id="back">← เปลี่ยนห้อง</a></div><h2>ห้อง ' + esc(st.room) + '</h2>' + step(2) + '<div class="card"><h3>แตะชื่อของฉัน</h3><input class="txt" id="find" placeholder="ค้นหาชื่อ หรือเลขที่"><div id="names" class="names"><div class="muted">กำลังโหลดรายชื่อ…</div></div></div>');
    $('#back').onclick = function (e) { e.preventDefault(); s1(); };
    jsonp({action: 'names', room: st.room, code: st.code}).then(function (d) {
      if (!d || !d.ok) throw new Error('x');
      if (!d.found) { $('#names').innerHTML = '<div class="notice err">' + esc(d.message || 'ไม่พบรายชื่อ') + '</div>'; return; }
      st.names = d.names; st.requireSid = d.requireSid;
      function draw(f) {
        var L = d.names.filter(function (x) { return !f || String(x.no) === f || x.name.replace(/\s/g, '').indexOf(f.replace(/\s/g, '')) >= 0; });
        $('#names').innerHTML = L.map(function (x) { return '<button data-no="' + esc(x.no) + '"><span class="no">' + esc(x.no) + '</span><span>' + esc(x.name) + '</span></button>'; }).join('') || '<div class="muted">ไม่พบชื่อที่ค้นหา</div>';
        Array.prototype.forEach.call(document.querySelectorAll('#names button'), function (b) { b.onclick = function () { var x = d.names.filter(function (y) { return String(y.no) === b.dataset.no; })[0]; s3(x); }; });
      }
      draw(''); $('#find').oninput = function () { draw(this.value.trim()); };
    }).catch(function () { $('#names').innerHTML = '<div class="notice err">โหลดรายชื่อไม่สำเร็จ ลองใหม่อีกครั้ง</div>'; });
  }
  function s3(x) {
    view('<div class="crumb"><a href="#" id="back">← เลือกชื่อใหม่</a></div><h2>ยืนยันตัวตน</h2>' + step(3) + '<div class="card confirm"><p class="muted">ฉันคือ</p><div class="nm">' + esc(x.name) + '</div><p class="muted">ห้อง ' + esc(st.room) + ' · เลขที่ ' + esc(x.no) + '</p>' +
      (st.requireSid ? '<p style="margin:14px 0 6px">เลขประจำตัวนักเรียน (5 หลัก)</p><input class="txt" id="sid" inputmode="numeric" maxlength="8" style="max-width:260px;text-align:center">' : '') +
      '<div class="row" style="justify-content:center;margin-top:20px"><button class="btn pri big" id="yes">ใช่ ฉันเอง เริ่มเลย →</button></div><div id="msg" style="margin-top:14px"></div></div>');
    $('#back').onclick = function (e) { e.preventDefault(); s2(); };
    $('#yes').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'กำลังตรวจรายชื่อ…';
      var sid = $('#sid') ? $('#sid').value.trim() : '';
      jsonp({action: 'login', room: st.room, name: x.name, sid: sid, code: st.code}).then(function (d) {
        if (d && d.ok && d.found) { student = {room: d.room, no: d.no, name: d.name, code: st.code, sid: sid, at: Date.now()}; ls('student', student); Q.blocked = ''; go('#/subjects'); }
        else { b.disabled = false; b.textContent = 'ใช่ ฉันเอง เริ่มเลย →'; $('#msg').innerHTML = '<div class="notice err">' + esc((d && d.message) || 'ตรวจรายชื่อไม่ผ่าน') + '</div>'; }
      }).catch(function () { b.disabled = false; b.textContent = 'ลองอีกครั้ง'; $('#msg').innerHTML = '<div class="notice err">เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</div>'; });
    };
  }
  s1();
}

// ---------- เข้าสู่ระบบรุ่น 2: รหัสห้อง → เลขประจำตัว (หรือเลขประชาชน) → ครั้งแรก: รหัส 4 หลัก + ตั้งรหัสผ่าน · ครั้งต่อไป: รหัสผ่าน ----------
// ไม่มีรายชื่อนักเรียนในหน้าเว็บ · เลขประชาชน/รหัสผ่านถูกแฮช (SHA-256) ในเครื่องก่อนส่ง และไม่เก็บไว้ในเครื่อง
function sha256hex(s) {
  if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.reject(new Error('nocrypto'));
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
}
function thaiIdOk(d) { if (!/^\d{13}$/.test(d)) return false; var s = 0; for (var i = 0; i < 12; i++) s += Number(d.charAt(i)) * (13 - i); return (11 - s % 11) % 10 === Number(d.charAt(12)); }
function apost(o) { return fetch(SAVE_URL, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(o), redirect: 'follow'}).then(function (r) { return r.json(); }); }
var A = null; // สถานะชั่วคราวในหน่วยความจำเท่านั้น
function pAuth(meta) {
  var cs = sessionStorage.getItem('eg6:cs'); if (!cs) { cs = rid('C'); try { sessionStorage.setItem('eg6:cs', cs); } catch (e) {} }
  A = {cs: cs, mode: (meta && meta.mode) || 'student_id', gate: '', ident: null, show: '', ticket: ''};
  var NID = function () { return A.mode === 'national_id'; };
  var NET = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
  function scr(back, backTo, title, body, btn) {
    view('<div class="crumb"><a href="' + (backTo === 'home' ? '#/' : '#/register') + '" id="back">← ' + back + '</a></div><h2 class="ah">' + title + '</h2>' +
      '<form class="auth" id="af" autocomplete="off" novalidate>' + body + '<p class="aerr" id="msg" role="alert" aria-live="polite"></p><button class="btn pri big" id="go" type="submit">' + btn + '</button></form>');
    var b = $('#back'); if (backTo !== 'home') b.onclick = function (e) { e.preventDefault(); backTo(); };
    var f = $('#af input'); if (f) setTimeout(function () { try { f.focus({preventScroll: true}); } catch (e) {} }, 60);
  }
  function err(t) { var m = $('#msg'); if (m) m.textContent = t || ''; }
  function busy(on, t) { var b = $('#go'); if (!b) return; if (on) { b.dataset.t = b.textContent; b.textContent = t || 'กำลังตรวจ…'; } else if (b.dataset.t) b.textContent = b.dataset.t; b.disabled = !!on; }
  function onSubmit(fn) { $('#af').onsubmit = function (e) { e.preventDefault(); if (!$('#go').disabled) fn(); }; }
  function digitsOnly(el, max) { el.addEventListener('input', function () { var v = el.value.replace(/\D/g, '').slice(0, max); if (v !== el.value) el.value = v; err(''); }); }
  function fail(d) { busy(false); if (d && d.code === 'gate') { A.gate = ''; s1(d.message); return true; } err((d && d.message) || NET); return false; }
  function done(d) {
    student = {room: d.room, no: d.no, name: d.name, role: d.role, token: d.token, at: Date.now()}; ls('student', student);
    Q.blocked = ''; A = null; go('#/subjects'); flush(true);
  }
  // 1 รหัสห้อง
  function s1(flash) {
    scr('หน้าแรก', 'home', 'รหัสห้อง',
      '<div class="group"><input class="codein" id="rc" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" enterkeyhint="go" aria-label="รหัสห้อง" placeholder="••••••"></div>', 'ต่อไป');
    var rc = $('#rc'); digitsOnly(rc, 8); err(flash || AUTH_FLASH); AUTH_FLASH = '';
    onSubmit(function () {
      var v = rc.value; if (v.length < 4) return err('ใส่รหัสห้องให้ครบ');
      busy(true); apost({action: 'gate', code: v, cs: A.cs}).then(function (d) {
        if (d && d.ok && d.pass) { A.gate = d.gate; A.mode = d.mode || A.mode; s2(); } else fail(d);
      }).catch(function () { fail(); });
    });
  }
  // 2 เลขประจำตัว / เลขประชาชน
  function s2() {
    scr('รหัสห้อง', function () { s1(); }, NID() ? 'เลขประชาชน' : 'เลขประจำตัว',
      '<div class="group"><input class="codein' + (NID() ? ' long' : '') + '" id="idf" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="' + (NID() ? 13 : 5) + '" autocomplete="off" enterkeyhint="next" aria-label="' + (NID() ? 'เลขประจำตัวประชาชน 13 หลัก' : 'เลขประจำตัว 5 หลัก') + '" placeholder="' + (NID() ? '13 หลัก' : '5 หลัก') + '"></div>', 'ต่อไป');
    var f = $('#idf'); digitsOnly(f, NID() ? 13 : 5);
    onSubmit(function () {
      var v = f.value;
      if (NID()) { if (v.length !== 13) return err('ใส่ให้ครบ 13 หลัก'); if (!thaiIdOk(v)) return err('เลขไม่ถูกต้อง ตรวจอีกครั้ง'); }
      else if (!/^\d{5}$/.test(v)) return err('ใส่ให้ครบ 5 หลัก');
      busy(true);
      (NID() ? sha256hex('eg6id|' + v).then(function (h) { return {t: 'nid', v: h}; }) : Promise.resolve({t: 'sid', v: v})).then(function (id) {
        A.ident = id; A.show = NID() ? '•••• ' + v.slice(-4) : v; f.value = ''; v = '';
        return apost({action: 'who', gate: A.gate, cs: A.cs, ident: id});
      }).then(function (d) {
        if (d && d.ok && d.state === 'set') s5(); else if (d && d.ok && d.state === 'new') s3(); else fail(d);
      }).catch(function (e) { fail(e && e.message === 'nocrypto' ? {message: 'เบราว์เซอร์นี้ใช้ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari'} : null); });
    });
  }
  // 3 รหัส 4 หลัก (ครั้งแรก)
  function s3() {
    scr(NID() ? 'เลขประชาชน' : 'เลขประจำตัว', function () { s2(); }, 'รหัส 4 หลัก',
      '<div class="group"><input class="codein pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" enterkeyhint="go" aria-label="รหัส 4 หลัก" placeholder="••••"></div><p class="ahint">ครั้งแรก</p>', 'ต่อไป');
    var f = $('#pin'); digitsOnly(f, 4);
    onSubmit(function () {
      if (f.value.length !== 4) return err('ใส่ให้ครบ 4 หลัก');
      busy(true); apost({action: 'pin', gate: A.gate, cs: A.cs, ident: A.ident, pin: f.value}).then(function (d) {
        if (d && d.ok && d.pass) { A.ticket = d.ticket; s4(); } else { f.value = ''; fail(d); }
      }).catch(function () { fail(); });
    });
  }
  // 4 ตั้งรหัสผ่าน
  function s4() {
    scr('รหัส 4 หลัก', function () { s3(); }, 'ตั้งรหัสผ่าน',
      '<div class="group fields"><label class="cell"><span>รหัสผ่าน</span><input id="p1" type="password" autocomplete="new-password" minlength="6" maxlength="64" placeholder="อย่างน้อย 6 ตัว" enterkeyhint="next"></label>' +
      '<label class="cell"><span>ยืนยัน</span><input id="p2" type="password" autocomplete="new-password" maxlength="64" placeholder="พิมพ์อีกครั้ง" enterkeyhint="go"></label></div>' +
      '<p class="consent">บันทึก = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button></p>', 'บันทึก');
    var p1 = $('#p1'), p2 = $('#p2'); [p1, p2].forEach(function (x) { x.addEventListener('input', function () { err(''); }); });
    onSubmit(function () {
      var a = p1.value, b = p2.value;
      if (a.length < 6) return err('รหัสผ่านอย่างน้อย 6 ตัว');
      if (/^(\d)\1+$/.test(a) || a === '123456' || a === '12345678' || (A.ident.t === 'sid' && a.indexOf(A.ident.v) >= 0)) return err('รหัสผ่านเดาง่ายเกินไป');
      if (a !== b) return err('รหัสผ่านไม่ตรงกัน');
      busy(true, 'กำลังบันทึก…');
      sha256hex('eg6pw|' + a).then(function (h) { p1.value = p2.value = ''; return apost({action: 'first', gate: A.gate, cs: A.cs, ident: A.ident, ticket: A.ticket, pw: h}); })
        .then(function (d) { if (d && d.ok && d.found) done(d); else if (d && d.code === 'ticket') { busy(false); s3(); err(d.message); } else fail(d); })
        .catch(function (e) { fail(e && e.message === 'nocrypto' ? {message: 'เบราว์เซอร์นี้ใช้ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari'} : null); });
    });
  }
  // 5 เข้าสู่ระบบ (ตั้งรหัสผ่านแล้ว)
  function s5() {
    scr(NID() ? 'เลขประชาชน' : 'เลขประจำตัว', function () { s2(); }, 'เข้าสู่ระบบ',
      '<div class="group fields"><div class="cell"><span>' + (NID() ? 'เลขประชาชน' : 'เลขประจำตัว') + '</span><b class="idv">' + esc(A.show) + '</b></div>' +
      (NID() ? '' : '<input type="text" name="username" autocomplete="username" value="' + esc(A.show) + '" hidden>') +
      '<label class="cell"><span>รหัสผ่าน</span><input id="pw" type="password" autocomplete="current-password" maxlength="64" enterkeyhint="go" placeholder="รหัสผ่าน"></label></div>' +
      '<p class="ahint">ลืมรหัสผ่าน แจ้งครูออม</p>', 'เข้าสู่ระบบ');
    var f = $('#pw'); f.addEventListener('input', function () { err(''); });
    onSubmit(function () {
      if (!f.value) return err('ใส่รหัสผ่าน');
      busy(true);
      sha256hex('eg6pw|' + f.value).then(function (h) { return apost({action: 'login', gate: A.gate, cs: A.cs, ident: A.ident, pw: h}); })
        .then(function (d) { if (d && d.ok && d.found) { f.value = ''; done(d); } else { f.value = ''; fail(d); } })
        .catch(function (e) { fail(e && e.message === 'nocrypto' ? {message: 'เบราว์เซอร์นี้ใช้ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari'} : null); });
    });
  }
  s1();
}

// ---------- เข้าสู่ระบบรุ่น 3: ชื่อ-นามสกุล + รหัสผ่าน (หน้าเดียว) · ใช้เมื่อ backend ตอบ health auth:3 ----------
function pLogin3() {
  var cs = sessionStorage.getItem('eg6:cs'); if (!cs) { cs = rid('C'); try { sessionStorage.setItem('eg6:cs', cs); } catch (e) {} }
  view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2 class="ah">เข้าสู่ระบบ</h2>' +
    '<form class="auth" id="af" autocomplete="on" novalidate>' +
    '<div class="group fields"><label class="cell"><span>ชื่อ-นามสกุล</span><input id="un" name="username" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="80" enterkeyhint="next" placeholder="ชื่อ นามสกุล" lang="th"></label>' +
    '<label class="cell"><span>รหัสผ่าน</span><input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" maxlength="64" enterkeyhint="go" placeholder="รหัสผ่าน"></label></div>' +
    '<p class="ahint">ไม่ต้องใส่คำนำหน้า · ลืมรหัสผ่าน แจ้งครูออม</p>' +
    '<p class="aerr" id="msg" role="alert" aria-live="polite"></p>' +
    '<button class="btn pri big" id="go" type="submit">เข้าสู่ระบบ</button>' +
    '<p class="consent">เข้าสู่ระบบ = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button></p></form>');
  var un = $('#un'), pw = $('#pw'), go_ = $('#go'), msg = $('#msg');
  function err(t) { msg.textContent = t || ''; }
  function busy(on) { go_.disabled = !!on; go_.textContent = on ? 'กำลังตรวจ…' : 'เข้าสู่ระบบ'; }
  err(AUTH_FLASH); AUTH_FLASH = '';
  [un, pw].forEach(function (x) { x.addEventListener('input', function () { err(''); }); });
  setTimeout(function () { try { un.focus({preventScroll: true}); } catch (e) {} }, 60);
  $('#af').onsubmit = function (e) {
    e.preventDefault(); if (go_.disabled) return;
    var u = un.value.replace(/\s+/g, ' ').trim(), p = pw.value.trim();
    if (!u) { err('พิมพ์ชื่อและนามสกุล'); un.focus(); return; }
    if (!p) { err('พิมพ์รหัสผ่าน'); pw.focus(); return; }
    busy(true);
    sha256hex('eg6pw|' + p).then(function (h) { return apost({action: 'login3', cs: cs, user: u, pw: h}); })
      .then(function (d) {
        if (d && d.ok && d.found) {
          pw.value = ''; student = {room: d.room, no: d.no, name: d.name, role: d.role, token: d.token, at: Date.now()}; ls('student', student);
          Q.blocked = ''; go('#/subjects'); flush(true); return;
        }
        busy(false); pw.value = '';
        if (d && d.code === 'gone') { pRegister(); return; }
        err((d && d.message) || 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); (d && d.code === 'ambiguous' ? un : pw).focus();
      })
      .catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? 'เบราว์เซอร์นี้ใช้ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari' : 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'); });
  };
}

// ---------- เข้าสู่ระบบรุ่น 4: ชื่อผู้ใช้ + รหัสผ่าน · ลงทะเบียนครั้งแรก (รหัสห้อง → เลือกชื่อ → ตั้งชื่อผู้ใช้/รหัสผ่าน) · ใช้เมื่อ health auth>=4 ----------
function csId() { var cs = sessionStorage.getItem('eg6:cs'); if (!cs) { cs = rid('C'); try { sessionStorage.setItem('eg6:cs', cs); } catch (e) {} } return cs; }
var NOCRYPTO = 'เบราว์เซอร์นี้ใช้ไม่ได้ ลองเปิดด้วย Chrome หรือ Safari', NETERR = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
var UNAME_RE = /^[A-Za-z0-9\u0E01-\u0E4E._-]{3,30}$/;
function loggedIn(d, v) { student = {room: d.room, no: d.no, name: d.name, role: d.role, token: d.token, at: Date.now()}; if (v) student.v = v; ls('student', student); Q.blocked = ''; go('#/subjects'); flush(true); }
function pLogin4(flash) {
  var cs = csId();
  view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2 class="ah">เข้าสู่ระบบ</h2>' +
    '<form class="auth" id="af" autocomplete="on" novalidate>' +
    '<div class="group fields"><label class="cell"><span>ชื่อผู้ใช้</span><input id="un" name="username" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="80" enterkeyhint="next" placeholder="ชื่อผู้ใช้" lang="th"></label>' +
    '<label class="cell"><span>รหัสผ่าน</span><input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" maxlength="64" enterkeyhint="go" placeholder="รหัสผ่าน"></label></div>' +
    '<p class="ahint">ครู: ใช้ชื่อ-นามสกุลเต็มเหมือนเดิม · ลืมรหัสผ่าน แจ้งครูออม</p>' +
    '<p class="aerr" id="msg" role="alert" aria-live="polite"></p>' +
    '<button class="btn pri big" id="go" type="submit">เข้าสู่ระบบ</button>' +
    '<div class="regbox"><span>ยังไม่มีชื่อผู้ใช้?</span><button type="button" class="btn big regbtn" id="reg">ลงทะเบียนครั้งแรก</button></div>' +
    '<p class="consent">เข้าสู่ระบบ = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button></p></form>');
  var un = $('#un'), pw = $('#pw'), go_ = $('#go'), msg = $('#msg'), reg = $('#reg');
  function err(t) { msg.textContent = t || ''; }
  function busy(on) { go_.disabled = !!on; go_.textContent = on ? 'กำลังตรวจ…' : 'เข้าสู่ระบบ'; }
  err(flash || AUTH_FLASH); AUTH_FLASH = '';
  [un, pw].forEach(function (x) { x.addEventListener('input', function () { err(''); reg.classList.remove('hot'); }); });
  reg.onclick = function () { pReg4(); };
  setTimeout(function () { try { un.focus({preventScroll: true}); } catch (e) {} }, 60);
  $('#af').onsubmit = function (e) {
    e.preventDefault(); if (go_.disabled) return;
    var u = un.value.replace(/\s+/g, ' ').trim(), p = pw.value.trim();
    if (!u) { err('พิมพ์ชื่อผู้ใช้'); un.focus(); return; }
    if (!p) { err('พิมพ์รหัสผ่าน'); pw.focus(); return; }
    busy(true);
    sha256hex('eg6pw|' + p).then(function (h) { return apost({action: 'login3', cs: cs, user: u, pw: h}); })
      .then(function (d) {
        if (d && d.ok && d.found) { pw.value = ''; loggedIn(d); return; }
        busy(false); pw.value = '';
        if (d && d.code === 'gone') { pRegister(); return; }
        err((d && d.message) || NETERR);
        if (d && d.code === 'need_register') { reg.classList.add('hot'); reg.focus(); } else pw.focus();
      })
      .catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? NOCRYPTO : NETERR); });
  };
}
function pReg4() {
  var R = {cs: csId(), pwh: '', list: [], pick: null}; // แฮชรหัสห้องเก็บในหน่วยความจำเท่านั้น
  function steps(n) { return '<div class="steps">' + ['1 รหัสห้อง', '2 เลือกชื่อ', '3 ตั้งชื่อผู้ใช้'].map(function (t, i) { return '<span class="' + (n === i + 1 ? 'on' : '') + '">' + t + '</span>'; }).join('') + '</div>'; }
  function scr(back, fn, title, n, body, btn) {
    view('<div class="crumb"><a href="#/register" id="back">← ' + back + '</a></div><h2 class="ah">' + title + '</h2>' + steps(n) +
      '<form class="auth" id="af" autocomplete="off" novalidate>' + body + (btn ? '<p class="aerr" id="msg" role="alert" aria-live="polite"></p><button class="btn pri big" id="go" type="submit">' + btn + '</button>' : '<p class="aerr" id="msg" role="alert" aria-live="polite"></p>') + '</form>');
    $('#back').onclick = function (e) { e.preventDefault(); fn(); };
    $('#af').onsubmit = function (e) { e.preventDefault(); };
  }
  function err(t) { var m = $('#msg'); if (m) m.textContent = t || ''; }
  function busy(on, t) { var b = $('#go'); if (!b) return; if (on) { b.dataset.t = b.textContent; b.textContent = t || 'กำลังตรวจ…'; } else if (b.dataset.t) b.textContent = b.dataset.t; b.disabled = !!on; }
  function onSubmit(fn) { $('#af').onsubmit = function (e) { e.preventDefault(); var b = $('#go'); if (!b || !b.disabled) fn(); }; }
  function fetchList() { return apost({action: 'reg_list', cs: R.cs, pw: R.pwh}); }
  // 1 รหัสผ่านของห้อง
  function s1(flash) {
    R.pwh = '';
    scr('เข้าสู่ระบบ', function () { pLogin4(); }, 'ลงทะเบียนครั้งแรก', 1,
      '<div class="group fields"><label class="cell"><span>รหัสห้อง</span><input id="rp" type="password" autocomplete="off" autocapitalize="off" maxlength="64" enterkeyhint="go" placeholder="รหัสผ่านของห้อง"></label></div>' +
      '<p class="ahint">รหัสผ่านกลางที่ครูออมบอกในห้องเรียน</p>', 'ต่อไป');
    var rp = $('#rp'); rp.addEventListener('input', function () { err(''); }); err(flash);
    setTimeout(function () { try { rp.focus({preventScroll: true}); } catch (e) {} }, 60);
    onSubmit(function () {
      var v = rp.value.trim(); if (!v) return err('ใส่รหัสผ่านของห้อง');
      busy(true);
      sha256hex('eg6pw|' + v).then(function (h) { R.pwh = h; rp.value = ''; return fetchList(); })
        .then(function (d) { if (d && d.ok && d.pass) { R.list = d.list || []; s2(); } else { busy(false); R.pwh = ''; if (d && d.code === 'gone') return pRegister(); err((d && d.message) || NETERR); } })
        .catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? NOCRYPTO : NETERR); });
    });
  }
  // 2 เลือกชื่อ (ค้นหาได้)
  function s2(flash) {
    scr('รหัสห้อง', function () { s1(); }, 'เลือกชื่อของฉัน', 2,
      '<div class="notice warn" id="warn"><b>เลือกชื่อของตัวเองเท่านั้น</b><br>ครูออมเห็นทุกครั้งที่มีการลงทะเบียน</div>' +
      '<input class="txt" id="find" type="search" placeholder="ค้นหาชื่อ" autocomplete="off" lang="th" aria-label="ค้นหาชื่อ"><div id="names" class="names"></div>', '');
    err(flash);
    function draw(f) {
      f = f.replace(/\s/g, '');
      var L = R.list.map(function (x, i) { return {x: x, i: i}; }).filter(function (o) { return !f || o.x.name.replace(/\s/g, '').indexOf(f) >= 0; });
      $('#names').innerHTML = L.map(function (o) { return '<button type="button" data-i="' + o.i + '"><span class="nm">' + esc(o.x.name) + '</span>' + (o.x.room ? '<small class="muted">' + esc(o.x.room) + '</small>' : '') + '</button>'; }).join('') ||
        '<div class="muted empty">' + (R.list.length ? 'ไม่พบชื่อที่ค้นหา' : 'ทุกคนลงทะเบียนแล้ว · ถ้ายังไม่ได้ลงทะเบียน แจ้งครูออม') + '</div>';
      Array.prototype.forEach.call(document.querySelectorAll('#names button'), function (b) { b.onclick = function () { R.pick = R.list[Number(b.dataset.i)]; s3(); }; });
    }
    draw(''); $('#find').oninput = function () { draw(this.value); };
  }
  // 3 ตั้งชื่อผู้ใช้ + รหัสผ่าน
  function s3() {
    var x = R.pick;
    scr('เลือกชื่อ', function () { s2(); }, 'ตั้งชื่อผู้ใช้', 3,
      '<div class="group fields"><div class="cell"><span>ชื่อ</span><b class="idv me">' + esc(x.name) + '</b></div></div>' +
      '<div class="group fields"><label class="cell"><span>ชื่อผู้ใช้</span><input id="nu" name="username" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="30" enterkeyhint="next" placeholder="3–30 ตัว" lang="th"></label>' +
      '<label class="cell"><span>รหัสผ่าน</span><input id="p1" name="new-password" type="password" autocomplete="new-password" maxlength="64" enterkeyhint="next" placeholder="อย่างน้อย 6 ตัว"></label>' +
      '<label class="cell"><span>ยืนยัน</span><input id="p2" type="password" autocomplete="new-password" maxlength="64" enterkeyhint="go" placeholder="พิมพ์อีกครั้ง"></label></div>' +
      '<p class="ahint">ชื่อผู้ใช้: ภาษาไทย/อังกฤษ ตัวเลข . _ - ไม่เว้นวรรค · ใช้เข้าสู่ระบบครั้งต่อไป</p>' +
      '<p class="consent">ลงทะเบียน = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button></p>', 'ลงทะเบียน');
    var nu = $('#nu'), p1 = $('#p1'), p2 = $('#p2');
    [nu, p1, p2].forEach(function (el) { el.addEventListener('input', function () { err(''); }); });
    setTimeout(function () { try { nu.focus({preventScroll: true}); } catch (e) {} }, 60);
    onSubmit(function () {
      var u = nu.value.trim(), a = p1.value.trim(), b = p2.value.trim();
      if (!UNAME_RE.test(u)) { nu.focus(); return err(u.length < 3 || u.length > 30 ? 'ชื่อผู้ใช้ 3–30 ตัว' : 'ชื่อผู้ใช้ใช้ได้เฉพาะ ไทย/อังกฤษ ตัวเลข . _ - (ไม่เว้นวรรค)'); }
      if (a.length < 6) { p1.focus(); return err('รหัสผ่านอย่างน้อย 6 ตัว'); }
      if (/^(.)\1+$/.test(a) || /^(123456|1234567|12345678|123456789|654321|password|qwerty)$/i.test(a) || a.toLowerCase() === u.toLowerCase()) { p1.focus(); return err('รหัสผ่านเดาง่ายเกินไป'); }
      if (a !== b) { p2.focus(); return err('รหัสผ่านไม่ตรงกัน'); }
      busy(true, 'กำลังบันทึก…');
      sha256hex('eg6pw|' + a).then(function (h) { return apost({action: 'reg_claim', cs: R.cs, pw: R.pwh, token: x.t, username: u, newpw: h}); })
        .then(function (d) {
          if (d && d.ok && d.found) { p1.value = p2.value = ''; R = null; loggedIn(d); return; }
          busy(false);
          var c = d && d.code;
          if (c === 'gone') return pRegister();
          if (c === 'bad_pw') return s1(d.message);
          if (c === 'taken' || c === 'bad') { return fetchList().then(function (l) { if (l && l.pass) R.list = l.list || []; s2(d.message || 'เลือกชื่ออีกครั้ง'); }).catch(function () { s2(d.message); }); }
          if (c === 'bad_newpw') { p1.value = p2.value = ''; p1.focus(); } else if (c === 'dup_user' || c === 'reserved' || c === 'bad_user') nu.focus();
          err((d && d.message) || NETERR);
        })
        .catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? NOCRYPTO : NETERR); });
    });
  }
  s1();
}


// ---------- เข้าสู่ระบบรุ่น 5: เลขประจำตัว (ครู: อีเมล) + รหัสผ่าน · ครั้งแรก 8888 แล้วตั้งรหัสใหม่เอง · ใช้เมื่อ health auth>=5 ----------
function pwField(id, label, ph, ac) { return '<label class="cell"><span>' + label + '</span><input id="' + id + '" type="password" autocomplete="' + (ac || 'new-password') + '" autocapitalize="off" maxlength="64" placeholder="' + ph + '"></label>'; }
function newPwErr(p, p2, ident) {
  if (p === '8888') return 'ห้ามใช้ 8888 เป็นรหัสใหม่';
  if (ident && p === ident) return 'ห้ามใช้เลขประจำตัวเป็นรหัสผ่าน';
  if (p.length < 6) return 'รหัสใหม่ต้องยาวอย่างน้อย 6 ตัว';
  if (p !== p2) return 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  return '';
}
function pLogin5(flash) {
  var cs = csId();
  view('<div class="crumb"><a href="#/">← หน้าแรก</a></div><h2 class="ah">เข้าสู่ระบบ</h2>' +
    '<form class="auth" id="af" autocomplete="on" novalidate>' +
    '<div class="group fields"><label class="cell"><span>เลขประจำตัวนักเรียน / อีเมลครู</span><input id="un" name="username" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="120" enterkeyhint="next" placeholder="เลข 5 หลัก"></label>' +
    '<label class="cell"><span>รหัสผ่าน</span><input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" maxlength="64" enterkeyhint="go" placeholder="ครั้งแรก: 8888"></label></div>' +
    '<p class="ahint">เข้าครั้งแรกใช้รหัส 8888 แล้วตั้งรหัสใหม่ของตัวเอง · ครั้งต่อไปใช้เลขประจำตัว + รหัสใหม่ · ลืมรหัสผ่าน แจ้งครูออม</p>' +
    '<p class="aerr" id="msg" role="alert" aria-live="polite"></p>' +
    '<button class="btn pri big" id="go" type="submit">เข้าสู่ระบบ</button>' +
    '<p class="consent">เข้าสู่ระบบ = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button></p></form>');
  var un = $('#un'), pw = $('#pw'), go_ = $('#go'), msg = $('#msg');
  function err(t) { msg.textContent = t || ''; }
  function busy(on) { go_.disabled = !!on; go_.textContent = on ? 'กำลังตรวจ…' : 'เข้าสู่ระบบ'; }
  err(flash || AUTH_FLASH); AUTH_FLASH = '';
  [un, pw].forEach(function (x) { x.addEventListener('input', function () { err(''); }); });
  setTimeout(function () { try { un.focus({preventScroll: true}); } catch (e) {} }, 60);
  $('#af').onsubmit = function (e) {
    e.preventDefault(); if (go_.disabled) return;
    var u = un.value.replace(/\s+/g, ' ').trim(), p = pw.value.trim();
    if (/^[\d ]+$/.test(u)) u = u.replace(/\s/g, '');
    if (!u) { err('พิมพ์เลขประจำตัวนักเรียน (ครู: อีเมล)'); un.focus(); return; }
    if (!p) { err('พิมพ์รหัสผ่าน (ครั้งแรก: 8888)'); pw.focus(); return; }
    busy(true);
    sha256hex('eg6pw|' + p).then(function (h) { return apost({action: 'login5', cs: cs, user: u, pw: h}); })
      .then(function (d) {
        pw.value = '';
        if (d && d.ok && d.must_change && d.ticket) { pSetPw5({ticket: d.ticket, name: d.name, ident: u, cs: cs}); return; }
        if (d && d.ok && d.found) { if (d.pw_default) pSetPw5({opt: d, ident: u}); else loggedIn(d, 5); return; }
        busy(false);
        if (d && d.code === 'gone') { pRegister(); return; }
        err((d && d.message) || NETERR); pw.focus();
      })
      .catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? NOCRYPTO : NETERR); });
  };
}
// ตั้งรหัสใหม่: o.ticket = บังคับ (นักเรียนเข้าด้วย 8888) · o.opt = ไม่บังคับ (ครูที่ยังใช้ 8888 · มี token แล้ว) · o.token = เปลี่ยนจากหน้าผลของฉัน
function pSetPw5(o) {
  var forced = !!o.ticket, chg = !!o.token, title = forced ? 'ตั้งรหัสผ่านใหม่' : 'เปลี่ยนรหัสผ่าน';
  view('<div class="crumb"><a href="' + (chg ? '#/soc/me' : '#/register') + '" id="back">← ' + (chg ? 'ผลของฉัน' : 'ยกเลิก') + '</a></div><h2 class="ah">' + title + '</h2>' +
    (forced ? '<div class="notice">สวัสดี <b>' + esc(o.name || '') + '</b> · เข้าครั้งแรก ต้องตั้งรหัสผ่านของตัวเองก่อนใช้งาน · ครั้งต่อไปใช้เลขประจำตัว + รหัสใหม่นี้ (8888 จะใช้ไม่ได้อีก)</div>' :
      o.opt ? '<div class="notice">บัญชีนี้ยังใช้รหัสเริ่มต้น 8888 · แนะนำให้ตั้งรหัสใหม่ (ไม่บังคับ)</div>' : '') +
    '<form class="auth" id="sf" novalidate><input type="text" name="username" autocomplete="username" value="' + esc(o.ident || '') + '" hidden>' +
    '<div class="group fields">' + (chg ? pwField('op', 'รหัสผ่านเดิม', 'รหัสผ่านที่ใช้อยู่', 'current-password') : '') +
    pwField('np', 'รหัสผ่านใหม่', 'อย่างน้อย 6 ตัว') + pwField('np2', 'ยืนยันรหัสผ่านใหม่', 'พิมพ์ซ้ำอีกครั้ง') + '</div>' +
    '<p class="ahint">อย่างน้อย 6 ตัว · ห้ามเป็น 8888 หรือเลขประจำตัว · จดไว้ให้ดี ลืมแล้วต้องให้ครูออมรีเซ็ต</p>' +
    '<p class="aerr" id="msg" role="alert" aria-live="polite"></p>' +
    '<button class="btn pri big" id="go" type="submit">บันทึกรหัสผ่านใหม่</button>' +
    (o.opt ? '<button class="btn big ghost" id="skip" type="button" style="margin-top:10px">ข้ามไปก่อน</button>' : '') + '</form>');
  var np = $('#np'), np2 = $('#np2'), op = $('#op'), go_ = $('#go'), msg = $('#msg');
  function err(t) { msg.textContent = t || ''; }
  function busy(on) { go_.disabled = !!on; go_.textContent = on ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'; }
  [np, np2, op].forEach(function (x) { if (x) x.addEventListener('input', function () { err(''); }); });
  if ($('#skip')) $('#skip').onclick = function () { loggedIn(o.opt, 5); };
  setTimeout(function () { try { (op || np).focus({preventScroll: true}); } catch (e) {} }, 60);
  $('#sf').onsubmit = function (e) {
    e.preventDefault(); if (go_.disabled) return;
    var p = np.value.trim(), p2 = np2.value.trim(), old = op ? op.value.trim() : '8888';
    if (op && !old) { err('พิมพ์รหัสผ่านเดิม'); op.focus(); return; }
    var bad = newPwErr(p, p2, o.ident); if (!bad && op && p === old) bad = 'รหัสใหม่ต้องไม่ซ้ำรหัสเดิม';
    if (bad) { err(bad); (bad.indexOf('ไม่ตรง') >= 0 ? np2 : np).focus(); return; }
    busy(true);
    Promise.all([sha256hex('eg6pw|' + p), sha256hex('eg6pw|' + old)]).then(function (h) {
      return forced ? apost({action: 'setpw', cs: o.cs, ticket: o.ticket, newpw: h[0]}) : apost({action: 'chpw', token: o.token || o.opt.token, old: h[1], newpw: h[0]});
    }).then(function (d) {
      if (d && d.ok && d.found) {
        np.value = np2.value = ''; if (op) op.value = '';
        if (chg) { student.token = d.token; student.v = 5; ls('student', student); ME_FLASH = 'เปลี่ยนรหัสผ่านแล้ว ✓ ครั้งต่อไปใช้รหัสใหม่นี้'; go('#/soc/me'); }
        else loggedIn(d, 5);
        return;
      }
      busy(false);
      if (d && (d.code === 'ticket')) { pLogin5(d.message); return; }
      if (d && d.code === 'auth') { relogin(d.message); return; }
      err((d && d.message) || NETERR);
    }).catch(function (e) { busy(false); err(e && e.message === 'nocrypto' ? NOCRYPTO : NETERR); });
  };
}
function socStats() {
  var p = prog(), done = 0, ok = 0, by = {};
  BANK.items.forEach(function (it) { var x = p.items[it.id]; var b = by[it.sara] = by[it.sara] || {n: 0, done: 0, ok: 0}; b.n++; if (x) { done++; b.done++; if (x.ok) { ok++; b.ok++; } } });
  var wrong = BANK.items.filter(function (it) { var x = p.items[it.id]; return x && !x.ok; }).length;
  return {p: p, done: done, ok: ok, by: by, wrong: wrong};
}
function pSubjects() {
  var s = socStats();
  view('<h2>เลือกวิชา</h2><p class="muted">สวัสดี' + (student.preview ? 'ครับ/ค่ะ (โหมดตัวอย่าง)' : ' ' + esc(student.name)) + ' · เปิดวิชาแรกแล้ว วิชาอื่นทยอยเปิดเร็ว ๆ นี้</p><div class="subj">' +
    SUBJECTS.map(function (x) {
      if (x.live) return '<a class="s on" href="#/soc"><span class="tag live">เปิดแล้ว</span><b>' + esc(x.name) + '</b><small>' + esc(x.exam) + ' · 100 ข้อจริง + สอบเสมือนจริง</small><div class="bar" style="margin-top:auto"><i style="width:' + pct(s.done, 100) + '%"></i></div><small>ทำแล้ว ' + s.done + '/100 ข้อ</small></a>';
      return '<div class="s off" aria-disabled="true"><span class="tag">เร็ว ๆ นี้</span><b>' + esc(x.name) + '</b><small>' + esc(x.exam) + '</small></div>';
    }).join('') + '</div>');
}
function pSoc() {
  var s = socStats(), p = s.p;
  var best = p.mocks.length ? p.mocks.reduce(function (m, x) { return x.score / x.total > m.score / m.total ? x : m; }) : null;
  view('<div class="crumb"><a href="#/subjects">← เลือกวิชา</a></div><h2>สังคมศึกษา · A-Level</h2><p class="muted">ข้อสอบจริง A-Level 70 สังคมศึกษา ปี 2568 และ 2569 ที่ ทปอ. เผยแพร่ · สนามจริง 50 ข้อ 90 นาที (5 สาระ สาระละ 10 ข้อ)</p>' +
    '<div class="stats"><div class="stat"><b>' + s.done + '<small style="font-size:16px">/100</small></b><span>ข้อที่ทำแล้ว</span></div><div class="stat"><b>' + pct(s.ok, s.done) + '%</b><span>ตอบถูก (ล่าสุด)</span></div><div class="stat"><b>' + Math.round(p.active / 60) + '</b><span>นาทีที่ฝึกในเครื่องนี้</span></div><div class="stat"><b>' + (best ? best.score + '/' + best.total : '–') + '</b><span>สอบเสมือนจริงดีที่สุด</span></div></div>' +
    '<div class="grid g3"><a class="btn pri big" href="#/soc/mock">⏱ สอบเสมือนจริง</a><a class="btn big" href="#/soc/review">ทบทวนข้อที่ผิด (' + s.wrong + ')</a><a class="btn big" href="#/soc/me">ผลของฉัน</a></div>' +
    '<div class="section"><h3>ฝึกตามสาระ</h3><span class="muted small">แตะสาระเพื่อเลือกหัวข้อย่อย · ทำทีละข้อ รู้ผลทันที</span></div>' +
    '<div class="grid g2">' + BANK.saras.map(function (sa) {
      var b = s.by[sa.id] || {n: 0, done: 0, ok: 0};
      return '<a class="card sara" href="#/soc/sara/' + sa.id + '" style="text-decoration:none;color:inherit"><div class="hd"><span class="num">' + sa.id + '</span><div><h3>' + esc(sa.name) + '</h3><span class="muted small">' + sa.topics.length + ' หัวข้อย่อย · ' + b.n + ' ข้อ</span></div></div><div class="bar"><i style="width:' + pct(b.done, b.n) + '%"></i></div><span class="small muted">ทำแล้ว ' + b.done + '/' + b.n + ' · ถูก ' + b.ok + ' ข้อ</span></a>';
    }).join('') + '</div>' +
    '<p class="small muted" style="margin-top:22px">ที่มา: ' + esc(BANK.meta.source) + ' · ' + esc(BANK.meta.expl) + ' · <a href="#/sources">รายละเอียดแหล่งที่มา</a></p>');
}
function pSara(id) {
  var sa = SARA[id]; if (!sa) return go('#/soc');
  var p = prog(), all = itemsOf(function (it) { return it.sara === sa.id; });
  var cnt = function (L) { var d = 0, o = 0; L.forEach(function (it) { var x = p.items[it.id]; if (x) { d++; if (x.ok) o++; } }); return {d: d, o: o}; };
  var c = cnt(all);
  view('<div class="crumb"><a href="#/soc">← สังคมศึกษา</a></div><div class="sara"><div class="hd"><span class="num">' + sa.id + '</span><h2 style="margin:0">' + esc(sa.name) + '</h2></div></div>' +
    '<p class="muted">ข้อสอบจริง ' + all.length + ' ข้อ (ปี 2569 ข้อ ' + ((sa.id - 1) * 10 + 1) + '–' + sa.id * 10 + ' และปี 2568 ข้อ ' + ((sa.id - 1) * 10 + 1) + '–' + sa.id * 10 + ') · ทำแล้ว ' + c.d + ' · ถูก ' + c.o + '</p>' +
    '<div class="row" style="margin:10px 0 20px"><button class="btn pri big" data-go="sara">ฝึกทั้งสาระ (' + all.length + ' ข้อ)</button><button class="btn big" data-go="rand">สุ่มลำดับ</button></div>' +
    '<h3>เลือกหัวข้อย่อย</h3><div class="topics">' + sa.topics.map(function (t) {
      var L = all.filter(function (it) { return it.topic === t.id; }), k = cnt(L);
      return '<button class="topic" data-t="' + t.id + '"' + (L.length ? '' : ' disabled') + '><span><b class="pink">' + t.id + '</b> ' + esc(t.name) + '</span><small>' + L.length + ' ข้อ · ทำแล้ว ' + k.d + '</small></button>';
    }).join('') + '</div>');
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) { b.onclick = function () { startPractice({ids: all.map(function (x) { return x.id; }), title: 'สาระที่ ' + sa.id + ' ' + sa.name, back: '#/soc/sara/' + sa.id, mode: 'practice', shuffle: b.dataset.go === 'rand'}); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { var t = TOPIC[b.dataset.t]; startPractice({ids: all.filter(function (it) { return it.topic === t.id; }).map(function (x) { return x.id; }), title: t.id + ' ' + t.name, back: '#/soc/sara/' + sa.id, mode: 'practice'}); }; });
}
function pReview() {
  var p = prog(), L = itemsOf(function (it) { var x = p.items[it.id]; return x && !x.ok; });
  if (!L.length) { view('<div class="crumb"><a href="#/soc">← สังคมศึกษา</a></div><h2>ทบทวนข้อที่ผิด</h2><div class="card"><p>ยังไม่มีข้อที่ตอบผิดค้างอยู่ 🎉</p><p class="muted">ข้อที่ตอบผิดในโหมดฝึกหรือสอบเสมือนจริงจะมารวมที่นี่ จนกว่าจะตอบถูก</p><a class="btn pri" href="#/soc">ไปฝึกต่อ</a></div>'); return; }
  startPractice({ids: L.map(function (x) { return x.id; }), title: 'ทบทวนข้อที่ผิด', back: '#/soc', mode: 'review'});
}

// ---------- practice ----------
var PR = null;
function startPractice(o) { PR = {ids: o.shuffle ? shuffle(o.ids) : o.ids.slice(), title: o.title, back: o.back, mode: o.mode, i: 0, ans: {}, set: o.mode === 'review' ? 'ทบทวน' : 'ฝึก'}; ls('pr', PR); go('#/soc/practice'); }
function pPractice() {
  PR = PR || ls('pr'); if (!PR || !PR.ids.length) return go('#/soc');
  var it = ITEMS[PR.ids[PR.i]], a = PR.ans[it.id], n = PR.ids.length, done = Object.keys(PR.ans).length;
  ACT.itemSec = 0;
  view('<div class="q-wrap"><div class="crumb"><a href="' + PR.back + '">← ออก</a></div><div class="q-top"><div class="q-meta"><b>' + esc(PR.title) + '</b> · ข้อ ' + (PR.i + 1) + '/' + n + '</div><div class="q-meta">ตอบแล้ว ' + done + ' · ถูก ' + Object.keys(PR.ans).filter(function (k) { return PR.ans[k].ok; }).length + '</div></div>' +
    '<div class="prog"><i style="width:' + pct(PR.i + (a ? 1 : 0), n) + '%"></i></div>' +
    '<article class="q-card"><div class="q-no">' + badge(it) + '<span class="tag">สาระ ' + it.sara + ' ' + SHORT[it.sara] + ' · ' + it.topic + ' ' + esc(TOPIC[it.topic].name) + '</span></div>' +
    stemHtml(it) + choicesHtml(it, a ? {reveal: true, chosen: a.c} : {}) + '<div id="exp">' + (a ? explainHtml(it, a.c) : '<p class="muted small" style="margin:14px 0 0">แตะตัวเลือกที่คิดว่าถูกที่สุด แล้วดูคำอธิบายทุกตัวเลือก</p>') + '</div></article>' +
    '<div class="q-nav"><button class="btn" id="prev"' + (PR.i ? '' : ' disabled') + '>← ข้อก่อนหน้า</button>' + (PR.i < n - 1 ? '<button class="btn pri" id="next">' + (a ? 'ข้อถัดไป →' : 'ข้าม →') + '</button>' : '<button class="btn pri" id="fin">จบชุดนี้ ✓</button>') + '</div></div>');
  if (!a) Array.prototype.forEach.call(document.querySelectorAll('.ch'), function (b) {
    b.onclick = function () {
      var c = Number(b.dataset.k), ok = record(it, c, PR.mode, PR.set, ACT.itemSec);
      PR.ans[it.id] = {c: c, ok: ok}; ls('pr', PR); pPractice();
      setTimeout(function () { var e = $('#exp'); if (e && window.innerWidth < 900) e.scrollIntoView({behavior: 'smooth', block: 'start'}); }, 50);
      flush(true);
    };
  });
  $('#prev').onclick = function () { PR.i--; ls('pr', PR); pPractice(); };
  if ($('#next')) $('#next').onclick = function () { PR.i++; ls('pr', PR); pPractice(); };
  if ($('#fin')) $('#fin').onclick = function () { pPracticeDone(); };
}
function pPracticeDone() {
  var keys = Object.keys(PR.ans), ok = keys.filter(function (k) { return PR.ans[k].ok; }).length;
  view('<div class="q-wrap"><h2>จบชุด: ' + esc(PR.title) + '</h2><div class="card score"><div class="ring" style="--p:' + pct(ok, keys.length) + '"><div><div><b>' + ok + '/' + keys.length + '</b><br><small>ข้อที่ตอบ</small></div></div></div><div><p>ตอบ ' + keys.length + ' จาก ' + PR.ids.length + ' ข้อ · ถูก ' + ok + ' ข้อ</p><div class="row"><a class="btn pri" href="#/soc/review">ทบทวนข้อที่ผิด</a><a class="btn" href="' + PR.back + '">กลับ</a></div></div></div></div>');
  flush(true);
}

// ---------- mock ----------
function mockIds(m) {
  if (!m.mix) return m.ids.slice();
  var out = []; [1, 2, 3, 4, 5].forEach(function (s) { out = out.concat(shuffle(BANK.items.filter(function (it) { return it.sara === s; })).slice(0, 10).sort(function (a, b) { return b.year - a.year || a.n - b.n; }).map(function (x) { return x.id; })); });
  return out;
}
function pMockHome() {
  var run = ls('mock:' + pkey()), p = prog();
  view('<div class="crumb"><a href="#/soc">← สังคมศึกษา</a></div><h2>สอบเสมือนจริง · A-Level สังคมศึกษา</h2>' +
    '<div class="card"><ul class="list"><li>50 ข้อ · เวลา 90 นาที (เท่าสนามจริง) · เรียงสาระ 1–5 สาระละ 10 ข้อ</li><li>ไม่เฉลยระหว่างสอบ · ข้ามข้อ ย้อนกลับ และปักธงข้อที่ไม่แน่ใจได้</li><li>หมดเวลาระบบส่งให้อัตโนมัติ · ส่งแล้วเห็นคะแนนรวม คะแนนรายสาระ และเฉลยละเอียดทุกข้อ</li></ul></div>' +
    (run && !run.done ? '<div class="notice" style="margin-top:16px">มีชุดที่ทำค้างไว้: ' + esc(run.name) + ' · <button class="btn pri" id="resume" style="margin-left:8px">ทำต่อ</button></div>' : '') +
    '<div class="grid g3" style="margin-top:16px">' + BANK.mocks.map(function (m) {
      var hist = p.mocks.filter(function (x) { return x.set === m.id; });
      return '<div class="card hl"><h3>' + esc(m.name) + '</h3><p class="muted small">' + (m.mix ? 'สุ่มข้อจากปี 2568 และ 2569 สาระละ 10 ข้อ ทุกครั้งไม่ซ้ำกัน' : 'ข้อสอบจริงทั้งฉบับ ตามลำดับข้อในกระดาษจริง') + '</p><p class="small">' + (hist.length ? 'ทำแล้ว ' + hist.length + ' ครั้ง · ล่าสุด ' + hist[hist.length - 1].score + '/' + hist[hist.length - 1].total : 'ยังไม่เคยทำ') + '</p><button class="btn pri" data-m="' + m.id + '">เริ่มสอบ</button></div>';
    }).join('') + '</div>');
  if ($('#resume')) $('#resume').onclick = function () { go('#/soc/mock/run'); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-m]'), function (b) {
    b.onclick = function () {
      var m = BANK.mocks.filter(function (x) { return x.id === b.dataset.m; })[0];
      confirmBox('<h3>เริ่ม ' + esc(m.name) + '?</h3><p>50 ข้อ · 90 นาที · เวลาเริ่มนับทันทีที่กดเริ่ม' + (run && !run.done ? '<br><b class="pink">ชุดที่ค้างไว้จะถูกยกเลิก</b>' : '') + '</p>', 'เริ่มจับเวลา', function () {
        var ids = mockIds(m);
        ls('mock:' + pkey(), {id: rid('M'), set: m.id, name: m.name, ids: ids, ans: {}, flag: {}, sec: {}, i: 0, start: Date.now(), end: Date.now() + m.min * 60000, min: m.min});
        go('#/soc/mock/run');
      });
    };
  });
}
function confirmBox(html, yes, fn, no) {
  var md = $('#modal'); $('#modalBox').innerHTML = html + '<div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" id="mNo">' + (no || 'ยกเลิก') + '</button><button class="btn pri" id="mYes">' + yes + '</button></div>';
  md.hidden = false; $('#mNo').onclick = function () { md.hidden = true; }; $('#mYes').onclick = function () { md.hidden = true; fn(); };
}
function pMockRun() {
  var K = 'mock:' + pkey(), R = ls(K);
  if (!R || R.done) return go('#/soc/mock');
  if (Date.now() >= R.end) return submitMock(R, true);
  var it = ITEMS[R.ids[R.i]], n = R.ids.length, answered = Object.keys(R.ans).length;
  ACT.itemSec = 0;
  function pal() { return '<div class="pal">' + R.ids.map(function (id, i) { return (i % 10 === 0 ? '<div class="sh">สาระ ' + (i / 10 + 1) + ' ' + SHORT[i / 10 + 1] + '</div>' : '') + '<button data-i="' + i + '" class="' + (R.ans[id] ? 'ans ' : '') + (R.flag[id] ? 'flg ' : '') + (i === R.i ? 'cur' : '') + '">' + (i + 1) + '</button>'; }).join('') + '</div><div class="legend"><span><i style="background:rgba(255,79,163,.4)"></i>ตอบแล้ว</span><span><i style="background:var(--warn);border-radius:50%"></i>ปักธง</span></div>'; }
  view('<div class="mock-bar"><div><b>' + esc(R.name) + '</b><div class="small muted">ตอบแล้ว ' + answered + '/' + n + '</div></div><div class="timer" id="timer">' + mmss((R.end - Date.now()) / 1000) + '</div><div class="row"><button class="btn only-m" id="palBtn">ข้อทั้งหมด</button><button class="btn pri" id="submit">ส่งคำตอบ</button></div></div>' +
    '<div class="mock-layout"><div><article class="q-card"><div class="q-no"><span class="tag">ข้อ ' + (R.i + 1) + '/' + n + '</span><span class="tag">สาระ ' + it.sara + ' ' + SHORT[it.sara] + '</span>' + badge(it) + '</div>' +
    stemHtml(it) + choicesHtml(it, {chosen: R.ans[it.id]}) + '</article>' +
    '<div class="q-nav"><button class="btn" id="prev"' + (R.i ? '' : ' disabled') + '>← ก่อนหน้า</button><button class="btn flagbtn' + (R.flag[it.id] ? ' on' : '') + '" id="flag">⚑ ' + (R.flag[it.id] ? 'เลิกปักธง' : 'ปักธงไว้ดูอีกที') + '</button><button class="btn pri" id="next"' + (R.i < n - 1 ? '' : ' disabled') + '>ถัดไป →</button></div></div>' +
    '<aside class="card palette only-d" id="palette">' + pal() + '</aside></div>');
  function save() { R.sec[it.id] = (R.sec[it.id] || 0) + ACT.itemSec; ACT.itemSec = 0; ls(K, R); }
  window.__tick = function () { var t = $('#timer'); if (!t) return; var left = (R.end - Date.now()) / 1000; t.textContent = mmss(left); t.classList.toggle('low', left < 300); if (left <= 0) { save(); submitMock(ls(K), true); } };
  Array.prototype.forEach.call(document.querySelectorAll('.ch'), function (b) { b.onclick = function () { var k = Number(b.dataset.k); if (R.ans[it.id] === k) delete R.ans[it.id]; else R.ans[it.id] = k; save(); pMockRun(); }; });
  function jump(i) { save(); R.i = i; ls(K, R); pMockRun(); }
  $('#prev').onclick = function () { jump(R.i - 1); };
  $('#next').onclick = function () { jump(R.i + 1); };
  $('#flag').onclick = function () { if (R.flag[it.id]) delete R.flag[it.id]; else R.flag[it.id] = 1; save(); pMockRun(); };
  Array.prototype.forEach.call(document.querySelectorAll('#palette [data-i]'), function (b) { b.onclick = function () { jump(Number(b.dataset.i)); }; });
  $('#palBtn').onclick = function () {
    var md = $('#modal'); $('#modalBox').innerHTML = '<h3>เลือกข้อ</h3>' + pal() + '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="mNo">ปิด</button></div>'; md.hidden = false;
    $('#mNo').onclick = function () { md.hidden = true; };
    Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-i]'), function (b) { b.onclick = function () { md.hidden = true; jump(Number(b.dataset.i)); }; });
  };
  $('#submit').onclick = function () {
    save(); var left = n - Object.keys(R.ans).length, fl = Object.keys(R.flag).length;
    confirmBox('<h3>ส่งคำตอบเลยไหม?</h3><p>' + (left ? 'ยังไม่ได้ตอบ <b class="pink">' + left + ' ข้อ</b><br>' : 'ตอบครบทุกข้อแล้ว<br>') + (fl ? 'ปักธงไว้ ' + fl + ' ข้อ<br>' : '') + 'เหลือเวลา ' + mmss((R.end - Date.now()) / 1000) + '</p>', 'ส่งคำตอบ', function () { submitMock(ls(K), false); }, 'ทำต่อ');
  };
}
function submitMock(R, timeout) {
  var K = 'mock:' + pkey(); if (!R || R.done) return go('#/soc/mock');
  var by = {}, score = 0, now = Math.min(Date.now(), R.end);
  R.ids.forEach(function (id) {
    var it = ITEMS[id], c = R.ans[id], b = by[it.sara] = by[it.sara] || [0, 0];
    var ok = record(it, c == null ? '' : c, 'mock', R.set, R.sec[id] || 0);
    b[1]++; if (ok) { b[0]++; score++; }
  });
  var res = {id: R.id, set: R.set, name: R.name, score: score, total: R.ids.length, bySara: by, usedSec: Math.round((now - R.start) / 1000), timeout: !!timeout, at: Date.now(), ids: R.ids, ans: R.ans, answered: Object.keys(R.ans).length};
  var p = prog(); p.mocks.push(res); if (p.mocks.length > 30) p.mocks = p.mocks.slice(-30); saveProg(p);
  Q.add({type: 'mock', eid: R.id, set: R.set, score: score, total: R.ids.length, bySara: by, usedSec: res.usedSec, timeout: !!timeout, answered: res.answered});
  R.done = true; ls(K, R); flush(true);
  go('#/soc/mock/result/' + R.id);
}
function pMockResult(id) {
  var p = prog(), r = p.mocks.filter(function (x) { return x.id === id; })[0]; if (!r) return go('#/soc/mock');
  var filter = ls('rvf') || 'all';
  view('<div class="crumb"><a href="#/soc/mock">← สอบเสมือนจริง</a></div><h2>ผลสอบ: ' + esc(r.name) + '</h2>' + (r.timeout ? '<div class="notice">หมดเวลา ระบบส่งคำตอบให้อัตโนมัติ</div>' : '') +
    '<div class="card score" style="margin-top:12px"><div class="ring" style="--p:' + pct(r.score, r.total) + '"><div><div><b>' + r.score + '</b><br><small>จาก ' + r.total + ' ข้อ</small></div></div></div><div><p style="margin:0">ร้อยละ ' + pct(r.score, r.total) + ' · ตอบ ' + r.answered + '/' + r.total + ' ข้อ · ใช้เวลา ' + mmss(r.usedSec) + ' นาที</p><p class="small muted">ส่งเมื่อ ' + thDate(r.at) + ' (เวลาไทย)</p></div></div>' +
    '<h3 style="margin-top:22px">คะแนนรายสาระ</h3><div class="card"><table class="tbl"><tr><th>สาระ</th><th class="n">ถูก</th><th style="width:40%"></th></tr>' + [1, 2, 3, 4, 5].map(function (s) { var b = r.bySara[s] || [0, 0]; return '<tr><td>' + s + ' ' + esc(SARA[s].name) + '</td><td class="n">' + b[0] + '/' + b[1] + '</td><td><div class="bar"><i style="width:' + pct(b[0], b[1]) + '%"></i></div></td></tr>'; }).join('') + '</table></div>' +
    '<div class="section"><h3>เฉลยละเอียด</h3><div class="row"><button class="btn' + (filter === 'all' ? ' pri' : '') + '" data-f="all">ทุกข้อ</button><button class="btn' + (filter === 'wrong' ? ' pri' : '') + '" data-f="wrong">เฉพาะข้อที่ผิด/ไม่ได้ตอบ</button></div></div>' +
    '<div class="rv">' + r.ids.map(function (iid, i) { var it = ITEMS[iid], c = r.ans[iid], ok = c != null && isRight(it, c); if (filter === 'wrong' && ok) return ''; return '<button data-i="' + i + '"><span class="m ' + (c == null ? 's' : ok ? 'r' : 'w') + '">' + (c == null ? '–' : ok ? '✓' : '✗') + '</span><span class="t"><b>ข้อ ' + (i + 1) + '</b> · ' + esc(it.stem.split('\n')[0]) + '</span></button>'; }).join('') + '</div>' +
    '<div class="row" style="margin-top:20px"><a class="btn pri" href="#/soc/review">ฝึกข้อที่ผิดซ้ำ</a><a class="btn" href="#/soc">กลับหน้าสังคม</a></div>');
  Array.prototype.forEach.call(document.querySelectorAll('[data-f]'), function (b) { b.onclick = function () { ls('rvf', b.dataset.f); pMockResult(id); }; });
  Array.prototype.forEach.call(document.querySelectorAll('.rv [data-i]'), function (b) { b.onclick = function () { go('#/soc/mock/review/' + id + '/' + b.dataset.i); }; });
}
function pMockReview(id, i) {
  var p = prog(), r = p.mocks.filter(function (x) { return x.id === id; })[0]; if (!r) return go('#/soc/mock');
  i = Math.max(0, Math.min(r.ids.length - 1, Number(i) || 0));
  var it = ITEMS[r.ids[i]], c = r.ans[it.id];
  view('<div class="q-wrap"><div class="crumb"><a href="#/soc/mock/result/' + id + '">← กลับไปหน้าผลสอบ</a></div><div class="q-top"><div class="q-meta"><b>เฉลย ' + esc(r.name) + '</b> · ข้อ ' + (i + 1) + '/' + r.ids.length + '</div></div>' +
    '<article class="q-card"><div class="q-no">' + badge(it) + '<span class="tag">สาระ ' + it.sara + ' · ' + it.topic + ' ' + esc(TOPIC[it.topic].name) + '</span></div>' + stemHtml(it) + choicesHtml(it, {reveal: true, chosen: c}) + explainHtml(it, c == null ? '' : c) + '</article>' +
    '<div class="q-nav"><button class="btn" id="prev"' + (i ? '' : ' disabled') + '>← ข้อก่อนหน้า</button><button class="btn pri" id="next"' + (i < r.ids.length - 1 ? '' : ' disabled') + '>ข้อถัดไป →</button></div></div>');
  $('#prev').onclick = function () { go('#/soc/mock/review/' + id + '/' + (i - 1)); };
  $('#next').onclick = function () { go('#/soc/mock/review/' + id + '/' + (i + 1)); };
}
var ME_FLASH = '';
function pMe() {
  var s = socStats(), p = s.p, topics = {};
  BANK.items.forEach(function (it) { var t = topics[it.topic] = topics[it.topic] || {n: 0, d: 0, o: 0}; t.n++; var x = p.items[it.id]; if (x) { t.d++; if (x.ok) t.o++; } });
  var q = Q.list().filter(function (x) { return x.stu === pkey() && x.type !== 'session'; }).length;
  view('<div class="crumb"><a href="#/soc">← สังคมศึกษา</a></div><h2>ผลของฉัน · สังคมศึกษา</h2>' + (ME_FLASH ? '<div class="notice" id="meflash" role="status">' + esc(ME_FLASH) + '</div>' : '') + '<p class="muted small">ข้อมูลในเครื่องนี้ · ' + (student.preview || !BACKEND ? 'โหมดตัวอย่าง ไม่ได้ส่งไปที่ครู' : (q ? 'รอส่งให้ครู ' + q + ' รายการ (ส่งอัตโนมัติเมื่อออนไลน์)' : 'ส่งให้ครูออมครบแล้ว ✓')) + '</p>' +
    '<div class="stats"><div class="stat"><b>' + s.done + '/100</b><span>ข้อที่ทำแล้ว</span></div><div class="stat"><b>' + pct(s.ok, s.done) + '%</b><span>ถูก (ผลล่าสุดของแต่ละข้อ)</span></div><div class="stat"><b>' + mins(p.active) + '</b><span>เวลาฝึกจริง</span></div><div class="stat"><b>' + p.mocks.length + '</b><span>ครั้งที่สอบเสมือนจริง</span></div></div>' +
    '<div class="card"><table class="tbl"><tr><th>สาระ / หัวข้อย่อย</th><th class="n">ทำแล้ว</th><th class="n">ถูก</th></tr>' + BANK.saras.map(function (sa) { var b = s.by[sa.id]; return '<tr><td><b>' + sa.id + ' ' + esc(sa.name) + '</b></td><td class="n"><b>' + b.done + '/' + b.n + '</b></td><td class="n"><b>' + (b.done ? pct(b.ok, b.done) + '%' : '–') + '</b></td></tr>' + sa.topics.map(function (t) { var x = topics[t.id]; return x ? '<tr><td class="small" style="padding-left:22px">' + t.id + ' ' + esc(t.name) + '</td><td class="n small">' + x.d + '/' + x.n + '</td><td class="n small">' + (x.d ? pct(x.o, x.d) + '%' : '–') + '</td></tr>' : ''; }).join(''); }).join('') + '</table></div>' +
    '<h3 style="margin-top:22px">ประวัติสอบเสมือนจริง</h3>' + (p.mocks.length ? '<div class="rv">' + p.mocks.slice().reverse().map(function (r) { return '<button data-id="' + r.id + '"><span class="m r">' + pct(r.score, r.total) + '</span><span class="t"><b>' + esc(r.name) + '</b> · ' + r.score + '/' + r.total + ' · ' + thDate(r.at) + '</span></button>'; }).join('') + '</div>' : '<p class="muted">ยังไม่เคยสอบ · <a href="#/soc/mock">ลองสอบเสมือนจริง</a></p>') +
    '<div class="row" style="margin-top:22px">' + (student.v === 5 && student.token && !student.preview ? '<button class="btn" id="chpw">เปลี่ยนรหัสผ่าน</button>' : '') + '<button class="btn ghost" id="lo">ออกจากระบบ (เปลี่ยนชื่อ)</button></div>');
  ME_FLASH = '';
  if ($('#chpw')) $('#chpw').onclick = function () { pSetPw5({token: student.token}); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-id]'), function (b) { b.onclick = function () { go('#/soc/mock/result/' + b.dataset.id); }; });
  $('#lo').onclick = function () { confirmBox('<h3>ออกจากระบบ?</h3><p>ข้อมูลที่บันทึกแล้วยังอยู่ครบ</p>', 'ออกจากระบบ', logout); };
}
function pSources() {
  var flagged = BANK.items.filter(function (it) { return it.f; }).map(function (it) { return it.id; });
  view('<div class="crumb"><a href="javascript:history.back()">← กลับ</a></div><h2>ที่มาของข้อสอบ</h2><div class="card"><p>' + esc(BANK.meta.source) + '</p><ul class="list">' +
    Object.keys(BANK.meta.urls).sort().reverse().map(function (y) { return '<li>A-Level 70 สังคมศึกษา ปีการศึกษา ' + y + ' (สอบ ' + esc(BANK.meta.dates[y]) + ') · <a href="' + esc(BANK.meta.urls[y]) + '" target="_blank" rel="noopener">ไฟล์ข้อสอบและเฉลยของ ทปอ.</a></li>'; }).join('') +
    '</ul><p>เฉลยทุกข้อใช้ตามที่ ทปอ. เผยแพร่ · ปี 2568 ข้อ 27 ทปอ. เฉลย 2 คำตอบ (ข้อ 3 หรือ 5) และข้อ 42 ทปอ. ประกาศให้คะแนนทุกคน (“ฟรีทุกข้อ”) · ปี 2569 ข้อ 29 แก้คำพิมพ์ผิดในต้นฉบับ “ขาดตลาต” เป็น “ขาดตลาด”</p>' +
    '<p>' + esc(BANK.meta.expl) + ' · ข้อที่มีประเด็นควรรู้เพิ่มเติม (' + flagged.length + ' ข้อ) แสดง “ข้อควรรู้” ไว้ใต้คำอธิบาย</p><p class="muted small">จัดหมวดสาระ/หัวข้อย่อยโดยครู เพื่อการฝึก · ตรวจแหล่งที่มาเมื่อ ' + esc(BANK.meta.checked) + '</p></div>');
}

// ---------- router ----------
function route() {
  var h = location.hash.replace(/^#/, '') || '/', m;
  $('#modal').hidden = true;
  if (h === '/' || h === '') return pLanding();
  if (h === '/register') return pRegister();
  if (h === '/sources') return pSources();
  if (!student) return go('#/register');
  if (h === '/subjects') return pSubjects();
  if (h === '/soc') return pSoc();
  if ((m = h.match(/^\/soc\/sara\/(\d)$/))) return pSara(Number(m[1]));
  if (h === '/soc/practice') return pPractice();
  if (h === '/soc/review') return pReview();
  if (h === '/soc/mock') return pMockHome();
  if (h === '/soc/mock/run') return pMockRun();
  if ((m = h.match(/^\/soc\/mock\/result\/([\w-]+)$/))) return pMockResult(m[1]);
  if ((m = h.match(/^\/soc\/mock\/review\/([\w-]+)\/(\d+)$/))) return pMockReview(m[1], m[2]);
  if (h === '/soc/me') return pMe();
  go('#/');
}
window.addEventListener('hashchange', route);
if (student && !student.preview && !BACKEND) { student = null; ls('student', null); }
if (student && student.preview && BACKEND) { student = null; ls('student', null); }
route(); flush(true);
window.__EG = {Q: Q, ACT: ACT, flush: flush, prog: prog, BACKEND: BACKEND};
})();
