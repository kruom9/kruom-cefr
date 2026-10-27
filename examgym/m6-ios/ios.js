/* Exam Gym ม.6 · ชั้นการแสดงผลแบบ iOS (ทดลอง) · ข้อความน้อย + hero
   ไม่แตะตรรกะของ app.js: หลัง app.js วาดหน้าแล้ว ไฟล์นี้แค่ ย่อ/ซ่อน/จัดวางข้อความ (ทุก id และตัวจัดการคลิกเดิมยังอยู่ครบ) */
(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var app = $('#app'), nav = $('#nav'), back = $('#navBack'), backT = $('#navBackT'), brand = $('#navBrand'), title = $('#navTitle'), tabbar = $('#tabbar'), modal = $('#modal'), mbox = $('#modalBox'), about = $('#about'), sync = $('#sync');
var EG = function () { return window.__EG || {}; };
function SUBS() { return EG().subjects || [{id: 'soc', name: 'สังคมศึกษา', live: true}]; }
function curSub() { var f = EG().sub; return f ? f() : 'soc'; }
function subOf(id) { return SUBS().filter(function (x) { return x.id === id; })[0]; }
var SHORT = {get: function (s) { var f = EG().short; return f ? f(s) || '' : ''; }};
var SHORTNAME = {soc: 'สังคม', thai: 'ไทย', phy: 'ฟิสิกส์', chem: 'เคมี', bio: 'ชีวะ', sci: 'วิทย์ประยุกต์', eng: 'อังกฤษ', tgat1: 'TGAT1', tgat2: 'TGAT2', tgat3: 'TGAT3'};
function glyph(nm) { var t = String(nm).match(/^TGAT(\d)/); return GLYPH[nm] || (t ? 'T' + t[1] : String(nm).charAt(0)); }
function examOf(id) { var x = subOf(id) || {}, m = String(x.exam || '').match(/^(A-Level|TGAT|TPAT)/); return m ? m[1] : 'A-Level'; }
function isReal(it) { return !/^[sp]/.test(it.id); }
var GLYPH = {'สังคมศึกษา': 'ส', 'ภาษาไทย': 'ก', 'ภาษาอังกฤษ': 'Aa', 'ฟิสิกส์': 'Φ', 'เคมี': 'Ch', 'ชีววิทยา': 'Bi', 'วิทยาศาสตร์ประยุกต์': 'Sc'};
var io = null, pending = false, lastView = null;
function student() { try { return JSON.parse(localStorage.getItem('eg6:student') || 'null'); } catch (e) { return null; } }
function routeName(h) {
  if (h === '/' || h === '') return 'landing';
  if (h === '/register') return 'register';
  if (h === '/sources') return 'sources';
  if (h === '/subjects') return 'home';
  var m = h.match(/^\/([a-z0-9]+)(\/.*)?$/), r = m && subOf(m[1]) ? (m[2] || '') : null; // ทุกวิชาใช้หน้าแบบเดียวกัน (#/<วิชา>/…)
  if (r === null) return 'other';
  if (r === '') return 'soc';
  if (/^\/sara\//.test(r)) return 'sara';
  if (r === '/practice' || r === '/review') return 'practice';
  if (r === '/mock') return 'mock';
  if (r === '/mock/run') return 'mockrun';
  if (/^\/mock\/result\//.test(r)) return 'result';
  if (/^\/mock\/review\//.test(r)) return 'mockreview';
  if (r === '/me') return 'me';
  return 'other';
}
var TAB = {home: 'home', soc: 'practice', sara: 'practice', mock: 'mock', result: 'mock', me: 'me', sources: ''};
// ---------- helpers (idempotent) ----------
function once(el, k) { if (!el || el.getAttribute('data-x-' + k)) return false; el.setAttribute('data-x-' + k, '1'); return true; }
function hide(el) { if (el) el.classList.add('x-hide'); }
function setT(el, t) { if (el && el.textContent !== t) el.textContent = t; }
function swap(root, map) { $$('*', root).forEach(function (el) { if (el.children.length) return; var t = el.textContent.trim(); if (Object.prototype.hasOwnProperty.call(map, t)) setT(el, map[t]); }); }
function textNode(el) { for (var n = el && el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return n; return null; }
function ring(done, total, label) { var p = total ? Math.round(done * 100 / total) : 0; return '<div class="xring" style="--p:' + p + '" role="img" aria-label="' + (label || '') + ' ' + done + '/' + total + '"><span><b>' + done + '</b><small>/' + total + '</small></span></div>'; }
var ICON_SOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
var BTN = {'← ข้อก่อนหน้า': '‹ ก่อน', '← ก่อนหน้า': '‹ ก่อน', 'ข้าม →': 'ข้าม', 'ข้อถัดไป →': 'ต่อไป', 'ถัดไป →': 'ต่อไป', 'จบชุดนี้ ✓': 'จบ ✓', '⚑ ปักธงไว้ดูอีกที': '⚑ ปักธง', '⚑ เลิกปักธง': '⚑ เลิกธง', 'ข้อทั้งหมด': 'ทั้งหมด', 'ส่งคำตอบ': 'ส่ง', 'เริ่มสอบ': 'เริ่ม', 'เริ่มจับเวลา': 'เริ่ม', 'ทบทวนข้อที่ผิด': 'ทบทวน', 'ไปฝึกต่อ': 'ฝึกต่อ', 'ฝึกข้อที่ผิดซ้ำ': 'ฝึกข้อผิด', 'กลับหน้าสังคม': 'กลับ', 'กลับหน้าภาษาไทย': 'กลับ', 'กลับหน้าฟิสิกส์': 'กลับ', 'กลับหน้าเคมี': 'กลับ', 'กลับหน้าชีววิทยา': 'กลับ', 'กลับหน้าวิทยาศาสตร์ประยุกต์': 'กลับ', 'ทุกข้อ': 'ทั้งหมด', 'เฉพาะข้อที่ผิด/ไม่ได้ตอบ': 'ผิด / ว่าง', 'ออกจากระบบ (เปลี่ยนชื่อ)': 'ออกจากระบบ', 'ใช่ ฉันเอง เริ่มเลย →': 'ใช่ ฉันเอง', 'กำลังตรวจรายชื่อ…': 'กำลังตรวจ…', 'เข้าดูแบบตัวอย่าง →': 'ดูตัวอย่าง', 'ไม่ใช่ฉัน / เปลี่ยนชื่อ': 'ไม่ใช่ฉัน', 'ลงทะเบียนเข้าใช้ →': 'เริ่มเลย', 'เข้าสู่ Exam Gym →': 'เริ่มเลย'};
var MSG = {'โหลดรายชื่อห้องไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่': 'โหลดไม่สำเร็จ', 'โหลดรายชื่อไม่สำเร็จ ลองใหม่อีกครั้ง': 'โหลดไม่สำเร็จ', 'เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่': 'เชื่อมต่อไม่ได้', 'ไม่พบชื่อที่ค้นหา': 'ไม่พบ', 'กำลังโหลดรายชื่อห้อง…': 'กำลังโหลด…', 'กำลังโหลดรายชื่อ…': 'กำลังโหลด…', 'ระบบบันทึกผล (Google Sheet ของครูออม) ยังไม่ได้เชื่อมต่อ · รายชื่อนักเรียนจะแสดงเมื่อเชื่อมต่อแล้ว': 'ยังไม่เชื่อมต่อระบบบันทึกผล', 'โหมดตัวอย่าง (สำหรับครูตรวจระบบ)': 'โหมดตัวอย่าง', 'หมดเวลา ระบบส่งคำตอบให้อัตโนมัติ': '⏱ หมดเวลา · ส่งอัตโนมัติ', 'ข้อมูลที่บันทึกแล้วยังอยู่ครบ': 'ข้อมูลยังอยู่ครบ', 'ส่งคำตอบเลยไหม?': 'ส่งเลย?', 'รหัสห้อง (ถามครูออม)': 'รหัสห้อง', 'เลขประจำตัวนักเรียน (5 หลัก)': 'เลขประจำตัว (5 หลัก)'};
// ---------- ส่วนที่ใช้ร่วม: ป้ายข้อสอบ / คำอธิบาย ----------
function qno() {
  var q = $('.q-no', app); if (!q || !once(q, 'q')) return;
  var src = $('.tag.src', q), info = [];
  $$('.tag', q).forEach(function (t) {
    if (t === src) return;
    if (/^ข้อ \d+\/\d+$/.test(t.textContent)) return; // เลขข้อในสอบจำลอง: เก็บไว้
    info.push(t.textContent); hide(t);
  });
  if (src) { var m = src.textContent.match(/ปี (\d+) ข้อ (\d+)/); if (m) { src.setAttribute('title', src.textContent); setT(src, 'ทปอ. ' + m[1] + ' · ข้อ ' + m[2]); } }
  if (info.length) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'xi'; b.setAttribute('aria-label', 'หมวดของข้อนี้'); b.setAttribute('aria-expanded', 'false'); b.textContent = 'ⓘ';
    var pnl = document.createElement('div'); pnl.className = 'xinfo'; pnl.hidden = true; pnl.textContent = info.join(' · ');
    b.onclick = function () { pnl.hidden = !pnl.hidden; b.setAttribute('aria-expanded', String(!pnl.hidden)); };
    q.appendChild(b); q.parentNode.insertBefore(pnl, q.nextSibling);
  }
}
function explain(root) {
  var v = $('.verdict', root); if (!v || !once(v, 'v')) return;
  var t = v.textContent, m;
  if ((m = t.match(/คำตอบที่ถูก: (.*)$/))) {
    var k = /^ทุกตัวเลือก/.test(m[1]) ? 'ทุกข้อ' : m[1].replace(/ข้อ /g, '');
    setT(v, (/^—/.test(t) ? '— ไม่ได้ตอบ' : '✗ ผิด') + ' · เฉลย ' + k);
  } else if (/ให้คะแนนทุกคน/.test(t)) setT(v, '✓ ได้คะแนน (ข้อฟรี)'); else if (/^✓/.test(t)) setT(v, '✓ ถูก');
  var kb = $('.keybox', root); if (kb) { var b = $('b', kb); if (b) b.remove(); var n = textNode(kb); if (n) n.nodeValue = n.nodeValue.replace(/^\s*·\s*/, ''); }
  var card = v.closest('.q-card') || $('.q-card', app), cite = $('.cite', root);
  var more = document.createElement('div'); more.className = 'xmore-body';
  $$('.flag', root).forEach(function (f) { more.appendChild(f); });
  if (cite) {
    var full = document.createElement('p'); full.className = 'cite-full'; full.textContent = cite.textContent; more.appendChild(full);
    var cm = cite.textContent.match(/ปีการศึกษา (\d+) ข้อ (\d+)/); if (cm) setT(cite, 'ที่มา: ทปอ. · A-Level ' + (SHORTNAME[curSub()] || (subOf(curSub()) || {}).name || '') + ' ' + cm[1] + ' ข้อ ' + cm[2]);
  }
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn xmore'; btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'ดูเฉลยทุกตัวเลือก';
  btn.onclick = function () { var on = card.classList.toggle('xopen'); btn.setAttribute('aria-expanded', String(on)); btn.textContent = on ? 'ย่อ' : 'ดูเฉลยทุกตัวเลือก'; };
  (kb || v).insertAdjacentElement('afterend', btn); btn.insertAdjacentElement('afterend', more);
}
// ---------- แต่ละหน้า ----------
var PAGE = {
  landing: function () {
    var h = $('.hero', app); if (!once(h, 'p')) return;
    hide($('.kicker', h)); hide($('.lead', h)); hide($('.feat', app));
    setT($('.school', h), 'โรงเรียนปิยมิตรวิทยา');
    var note = $('p.muted.small', h), st = student();
    if (note) { if (st) setT(note, st.preview ? 'โหมดตัวอย่าง' : st.role === 'teacher' ? 'ครู' : st.room + ' · เลขที่ ' + st.no); else hide(note); }
  },
  register: function () {
    var h2 = $('h2', app); if (h2) setT(h2, {'ลงทะเบียนเข้าใช้': 'ลงทะเบียน', 'ยืนยันตัวตน': 'ยืนยัน'}[h2.textContent] || h2.textContent);
    $$('.steps span', app).forEach(function (s) { setT(s, s.textContent.replace(/^\d\s*(เลือก)?/, '')); });
    $$('.card > h3', app).forEach(function (x) { if (/ของฉัน$/.test(x.textContent)) hide(x); });
    var f = $('#find', app); if (f) f.placeholder = 'ค้นหา';
    var c = $('.confirm', app);
    if (c && once(c, 'c')) {
      $$('p.muted', c).forEach(function (p) { if (p.textContent === 'ฉันคือ') hide(p); else setT(p, p.textContent.replace(/^ห้อง /, '')); });
      var row = $('.row', c), p = document.createElement('p'); p.className = 'consent';
      p.innerHTML = 'ยืนยัน = ยินยอมให้ส่งผลฝึกถึงครูออม <button type="button" class="xi" data-about="privacy" aria-label="ความเป็นส่วนตัว">ⓘ</button>';
      c.insertBefore(p, row);
    }
    var pv = $('#pv', app); if (pv) hide($('p.muted', pv.parentNode));
  },
  home: function () {
    var h2 = $('h2', app); setT(h2, 'วิชา'); hide($('p.muted', app));
    var ons = $$('.subj > .s.on:not(.dash-link)', app), dl = $('#dashLink', app);
    if (ons.length && once(ons[0], 'h')) {
      var hero = document.createElement('div'); hero.className = 'xhero'; ons[0].parentNode.parentNode.insertBefore(hero, ons[0].parentNode);
      ons.forEach(function (on, i) {
        var m = on.textContent.match(/ทำแล้ว (\d+)\/(\d+)/), d = m ? +m[1] : 0, n = m ? +m[2] : 100, id = on.getAttribute('data-sub') || 'soc', nm = $('b', on).textContent;
        on.innerHTML = '<i class="xic big' + (id === 'soc' ? '' : ' c' + (i % 6 + 1)) + '">' + (id === 'soc' ? ICON_SOC : glyph(nm)) + '</i><span class="xt"><b>' + nm.replace(/</g, '&lt;') + '</b><small>' + examOf(id) + '</small></span>' + ring(d, n, 'ทำแล้ว');
        hero.appendChild(on);
      });
      if (dl && once(dl, 'd')) { var dsm = $('small', dl); dl.innerHTML = '<i class="xic big c3" aria-hidden="true">ครู</i><span class="xt"><b>แดชบอร์ดครู</b><small>' + (dsm ? dsm.textContent : '').replace(/</g, '&lt;') + '</small></span>'; hero.insertBefore(dl, hero.firstChild); }
      if ($('.s.off', app)) { var gh = document.createElement('h3'); gh.className = 'gh'; gh.textContent = 'เร็ว ๆ นี้'; hero.insertAdjacentElement('afterend', gh); }
    }
    $$('.s.off', app).forEach(function (s, i) {
      if (!once(s, 'o')) return; hide($('small', s));
      var nm = $('b', s).textContent, g = glyph(nm);
      var ic = document.createElement('i'); ic.className = 'xic c' + (i % 6 + 1); ic.textContent = g; s.insertBefore(ic, s.firstChild);
      var tg = $('.tag', s); if (tg) tg.classList.add('soon');
    });
  },
  soc: function () {
    var h2 = $('h2', app);
    if (h2 && once(h2, 's')) { var sid = curSub(), snm = (subOf(sid) || {}).name || ''; setT(h2, snm); h2.insertAdjacentHTML('afterbegin', '<i class="xic big' + (sid === 'soc' ? '' : ' c' + ((SUBS().filter(function (x) { return x.live; }).map(function (x) { return x.id; }).indexOf(sid)) % 6 + 1)) + '">' + (sid === 'soc' ? ICON_SOC : glyph(snm)) + '</i>'); var p = h2.nextElementSibling; if (p && p.matches('p.muted')) hide(p); }
    heroStats({'ตอบถูก (ล่าสุด)': 'ถูก', 'นาทีที่ฝึกในเครื่องนี้': 'นาที', 'สอบเสมือนจริงดีที่สุด': 'สอบดีสุด'});
    var g3 = $('.grid.g3', app);
    if (g3 && once(g3, 'g')) {
      g3.classList.add('x2');
      $$('a', g3).forEach(function (a) {
        var t = a.textContent;
        if (/สอบเสมือนจริง/.test(t)) setT(a, '⏱ สอบจำลอง');
        else if (/ทบทวน/.test(t)) { var n = (t.match(/\((\d+)\)/) || [0, 0])[1]; a.innerHTML = '↺ ทบทวน <span class="xbadge">' + n + '</span>'; }
        else if (/ผลของฉัน/.test(t)) hide(a);
      });
    }
    var sec = $('.section', app); if (sec && once(sec, 's')) { setT($('h3', sec), 'สาระ'); hide($('span.muted', sec)); }
    $$('.card.sara', app).forEach(function (c) {
      if (!once(c, 's')) return;
      var hs = $('.hd span.muted', c); hide(hs);
      var last = c.lastElementChild, m = last && last.textContent.match(/ทำแล้ว (\d+)\/(\d+)/);
      if (m) { setT(last, m[1] + '/' + m[2]); last.className = 'xcount'; }
    });
    var src = $('#app > p.small.muted:last-child'); if (src && once(src, 's')) src.innerHTML = '<a href="#/sources">' + (((subOf(curSub()) || {}).bank || {items: []}).items.every(isReal) ? 'ข้อสอบจริงจาก ทปอ. ›' : 'ที่มาของข้อสอบ ›') + '</a>';
  },
  sara: function () {
    var p = $('.sara', app) && $('.sara', app).nextElementSibling;
    if (p && p.matches('p.muted') && once(p, 's')) {
      var a = p.textContent.match(/(?:ข้อสอบจริง|ข้อในคลัง) (\d+) ข้อ/), d = p.textContent.match(/ทำแล้ว (\d+)/);
      hide(p); $('.sara .hd', app).insertAdjacentHTML('beforeend', '<span class="xcount">' + (d ? d[1] : 0) + '/' + (a ? a[1] : '') + '</span>');
    }
    var b1 = $('[data-go="sara"]', app), b2 = $('[data-go="rand"]', app); setT(b1, '▶ เริ่ม'); setT(b2, '⤨ สุ่ม');
    $$('#app > h3').forEach(function (h) { if (h.textContent === 'เลือกหัวข้อย่อย') { setT(h, 'หัวข้อ'); h.className = 'gh'; } });
    $$('.topic small', app).forEach(function (s) { var m = s.textContent.match(/^(\d+) ข้อ · ทำแล้ว (\d+)$/); if (m) setT(s, m[2] + '/' + m[1]); });
  },
  practice: function () {
    var top = $('.q-top', app);
    if (top) { hide(top); var mm = top.textContent.match(/ข้อ (\d+)\/(\d+)/); if (mm) { title.textContent = 'ข้อ ' + mm[1] + '/' + mm[2]; nav.classList.add('shrunk'); } }
    qno();
    var hint = $('#exp > p.muted', app); hide(hint);
    explain($('#exp', app) || app);
    if ($('.score', app)) PAGE.done();
    var card = $('#app .card'); if (card && /ยังไม่มีข้อที่ตอบผิด/.test(card.textContent) && once(card, 'e')) { setT($('p', card), 'ไม่มีข้อผิดค้าง 🎉'); hide($('p.muted', card)); }
  },
  done: function () {
    var h2 = $('h2', app); if (h2 && /^จบชุด/.test(h2.textContent)) setT(h2, 'เสร็จแล้ว ✓');
    var sm = $('.ring small', app); if (sm) setT(sm, 'ถูก/ตอบ');
    var p = $('.score > div:last-child > p', app); hide(p);
  },
  mock: function () {
    var h2 = $('h2', app); setT(h2, 'สอบจำลอง');
    var rules = $('.card .list', app);
    if (rules && once(rules, 'r')) var ln = rules.textContent.match(/^(\d+) ข้อ · เวลา (\d+) นาที/) || [0, 50, 90]; rules.parentNode.innerHTML = '<div class="xchips"><span>✎ ' + ln[1] + ' ข้อ</span><span>⏱ ' + ln[2] + ' นาที</span><span>⚑ ปักธงได้</span><span>⏲ หมดเวลา = ส่ง</span></div>';
    var rs = $('#resume', app); if (rs) { var n = textNode(rs.parentNode); if (n && /^มีชุดที่ทำค้างไว้/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace('มีชุดที่ทำค้างไว้: ', 'ค้างไว้: ').replace(/ · $/, ' '); }
    $$('.card.hl', app).forEach(function (c) {
      if (!once(c, 'm')) return;
      hide($('p.muted', c));
      var h = $('p.small:not(.muted)', c); if (h) { var m = h.textContent.match(/ล่าสุด (\d+\/\d+)/); setT(h, m ? 'ล่าสุด ' + m[1] : 'ยังไม่ทำ'); }
    });
  },
  mockrun: function () {
    var bar = $('.mock-bar', app);
    if (bar && once(bar, 'b')) { var nm = $('b', bar); if (nm) hide(nm); var c = $('.small.muted', bar); if (c) setT(c, '✓ ' + c.textContent.replace('ตอบแล้ว ', '')); }
    qno();
  },
  result: function () {
    var h2 = $('h2', app), name = '';
    if (h2 && /^ผลสอบ: /.test(h2.textContent)) { name = h2.textContent.replace('ผลสอบ: ', ''); setT(h2, 'ผลสอบ'); }
    var sc = $('.card.score', app);
    if (sc && once(sc, 'r')) {
      var info = sc.children[1], t = info ? info.textContent : '';
      var pc = (t.match(/ร้อยละ (\d+)/) || [])[1], an = (t.match(/ตอบ (\d+\/\d+)/) || [])[1], tm = (t.match(/ใช้เวลา ([\d:]+)/) || [])[1], at = (t.match(/ส่งเมื่อ (.*?) \(เวลาไทย\)/) || [])[1];
      var sm = $('.ring small', sc); if (sm) setT(sm, sm.textContent.replace(/^จาก (\d+) ข้อ$/, '/$1'));
      info.innerHTML = '<div class="xnums"><div><b>' + pc + '%</b><span>คะแนน</span></div><div><b>' + tm + '</b><span>เวลา</span></div><div><b>' + an + '</b><span>ตอบ</span></div></div><p class="xcap">' + (name ? name.replace(/</g, '&lt;') + ' · ' : '') + (at || '') + '</p>';
      sc.classList.add('xhero-score');
    }
    $$('#app > h3, .section > h3').forEach(function (h) { if (h.textContent === 'คะแนนรายสาระ') { setT(h, 'รายสาระ'); h.className = 'gh'; } if (h.textContent === 'เฉลยละเอียด') setT(h, 'เฉลย'); });
    var tb = $('.tbl', app);
    if (tb && once(tb, 't')) { var r0 = $('tr', tb); hide(r0); $$('tr td:first-child', tb).forEach(function (td) { var m = td.textContent.match(/^(\d+) /); if (m) setT(td, m[1] + ' ' + SHORT.get(m[1])); }); }
  },
  mockreview: function () {
    var top = $('.q-top', app); if (top) { hide(top); var mm = top.textContent.match(/ข้อ (\d+)\/(\d+)/); if (mm) { title.textContent = 'ข้อ ' + mm[1] + '/' + mm[2]; nav.classList.add('shrunk'); } }
    qno(); explain($('.q-card', app));
  },
  me: function () {
    var h2 = $('h2', app); setT(h2, 'ผลของฉัน');
    var st = h2 && h2.nextElementSibling;
    if (st && st.matches('p.muted') && once(st, 'm')) { var t = st.textContent, m; setT(st, /ครบแล้ว/.test(t) ? '✓ ส่งครูออมครบแล้ว' : (m = t.match(/รอส่งให้ครู (\d+)/)) ? '↑ รอส่ง ' + m[1] + ' รายการ' : 'โหมดตัวอย่าง · ไม่ส่ง'); st.classList.add('xstatus'); }
    heroStats({'ถูก (ผลล่าสุดของแต่ละข้อ)': 'ถูก', 'เวลาฝึกจริง': 'เวลา', 'ครั้งที่สอบเสมือนจริง': 'ครั้งสอบ'});
    var tb = $('.tbl', app);
    if (tb && once(tb, 't')) {
      var th = $$('th', tb); if (th[0]) setT(th[0], 'สาระ'); if (th[1]) setT(th[1], 'ทำ');
      $$('tr', tb).forEach(function (tr) { var td = tr.firstElementChild; if (td && td.classList.contains('small')) tr.classList.add('xsub'); else { var b = td && $('b', td), m = b && b.textContent.match(/^(\d+) /); if (m) setT(b, m[1] + ' ' + SHORT.get(m[1])); } });
      var card = tb.closest('.card'), btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn xmore'; btn.textContent = 'หัวข้อย่อย ▾'; btn.setAttribute('aria-expanded', 'false');
      btn.onclick = function () { var on = card.classList.toggle('xopen'); btn.textContent = on ? 'ย่อ ▴' : 'หัวข้อย่อย ▾'; btn.setAttribute('aria-expanded', String(on)); };
      card.insertAdjacentElement('afterend', btn);
    }
    $$('#app > h3').forEach(function (h) { if (h.textContent === 'ประวัติสอบเสมือนจริง') { setT(h, 'ประวัติสอบ'); h.className = 'gh'; } });
    var emp = $('#app > p.muted'); if (emp && /ยังไม่เคยสอบ/.test(emp.textContent) && once(emp, 'e')) { var a = $('a', emp); if (a) setT(a, 'สอบเลย'); }
    if (!$('#bigSw', app)) {
      var lo = $('#lo', app), box = document.createElement('div');
      box.innerHTML = '<div class="group" style="margin-top:22px"><label class="cell sw"><span>ตัวอักษรใหญ่</span><input type="checkbox" id="bigSw" role="switch"' + (localStorage.getItem('eg6ios:big') === '1' ? ' checked' : '') + '><i aria-hidden="true"></i></label></div>';
      if (lo && lo.parentNode) lo.parentNode.parentNode.insertBefore(box, lo.parentNode); else app.appendChild(box);
      $('#bigSw', app).onchange = function () { localStorage.setItem('eg6ios:big', this.checked ? '1' : '0'); document.body.classList.toggle('big', this.checked); };
    }
  }
};
function heroStats(map) {
  var s = $('.stats', app); if (!s || !once(s, 'h')) return;
  var first = $('.stat', s), m = first && first.textContent.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) { first.innerHTML = ring(+m[1], +m[2], 'ทำแล้ว') + '<span>ทำแล้ว</span>'; first.classList.add('xr'); }
  $$('.stat span', s).forEach(function (sp) { if (map[sp.textContent]) setT(sp, map[sp.textContent]); });
  s.classList.add('xhero-stats');
}
function sheetText() {
  if (modal.hidden || !mbox.firstChild) return;
  swap(mbox, BTN); swap(mbox, MSG);
  var p = $('p', mbox); if (!p || !once(p, 'p')) return;
  var t = p.textContent, m;
  if (/เหลือเวลา/.test(t)) {
    var left = (t.match(/ยังไม่ได้ตอบ (\d+)/) || [])[1], fl = (t.match(/ปักธงไว้ (\d+)/) || [])[1], tm = (t.match(/เหลือเวลา ([\d:]+)/) || [])[1];
    p.innerHTML = '<span class="xchips">' + (left ? '<span>ว่าง <b class="pink">' + left + '</b></span>' : '<span>✓ ครบ</span>') + (fl ? '<span>⚑ ' + fl + '</span>' : '') + '<span>⏱ ' + tm + '</span></span>';
  } else if ((m = t.match(/^50 ข้อ · 90 นาที · เวลาเริ่มนับทันทีที่กดเริ่ม/)) || /^\d+ ข้อ · \d+ นาที/.test(t)) {
    var n = textNode(p); if (n) n.nodeValue = n.nodeValue.replace(' · เวลาเริ่มนับทันทีที่กดเริ่ม', '');
    var w = $('b.pink', p); if (w) setT(w, 'ชุดที่ค้างจะถูกยกเลิก');
  }
}
function syncShort() {
  var t = sync.textContent, s = t, m;
  if (/^บันทึกแล้ว/.test(t)) s = '✓ บันทึก';
  else if ((m = t.match(/^กำลังส่ง (\d+)/))) s = '↑ ' + m[1];
  else if ((m = t.match(/^ออฟไลน์.*?(\d+)/))) s = 'ออฟไลน์ · ' + m[1];
  else if (/^บันทึกไม่ได้/.test(t)) s = '⚠ บันทึกไม่ได้';
  else if (/^โหมดตัวอย่าง/.test(t)) s = 'ตัวอย่าง';
  if (sync.getAttribute('data-s') !== s) sync.setAttribute('data-s', s);
  sync.setAttribute('title', t); sync.setAttribute('aria-label', t);
}
// ---------- ทุกครั้งที่หน้าเปลี่ยน ----------
function decorate() {
  pending = false;
  var h = location.hash.replace(/^#/, '') || '/', r = routeName(h), st = student(), fresh = app.firstElementChild !== lastView;
  lastView = app.firstElementChild;
  if (r === 'practice' && !$('.q-card', app) && $('h2', app)) r = 'done';
  var big = localStorage.getItem('eg6ios:big') === '1';
  document.body.className = document.body.className.replace(/\br-\S+/g, '').trim() + ' r-' + r;
  document.body.classList.toggle('big', big);
  if (fresh) {
    var a = $('.crumb a', app);
    if (a) { back.hidden = false; brand.hidden = true; var bt = a.textContent.replace(/^\s*←\s*/, '').trim(); backT.textContent = {'กลับไปหน้าผลสอบ': 'ผลสอบ', 'เลือกวิชา': 'วิชา', 'สอบเสมือนจริง': 'สอบจำลอง', 'สังคมศึกษา': 'สังคม', 'ภาษาไทย': 'ไทย', 'วิทยาศาสตร์ประยุกต์': 'วิทย์ฯ', 'เปลี่ยนห้อง': 'ห้อง', 'เลือกชื่อใหม่': 'ชื่อ', 'หน้าแรก': 'หน้าแรก'}[bt] || bt || 'กลับ'; back.onclick = function () { a.click(); }; }
    else { back.hidden = true; brand.hidden = false; back.onclick = null; }
    nav.classList.toggle('brandmode', !a);
    if (io) { io.disconnect(); io = null; }
    nav.classList.remove('shrunk'); title.textContent = '';
  }
  try { (PAGE[r] || function () {})(); } catch (e) { if (window.console) console.warn('ios layer', e); }
  swap(app, BTN); swap(app, MSG);
  if (fresh) {
    var lt = $('h2', app) || $('h1', app);
    if (lt && r !== 'practice' && r !== 'mockreview') {
      if (lt.tagName === 'H2') lt.classList.add('lt');
      title.textContent = lt.textContent.replace(/\s+/g, ' ').trim();
      if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (es) { nav.classList.toggle('shrunk', !es[0].isIntersecting); }, {rootMargin: '-' + (nav.offsetHeight + 4) + 'px 0px 0px 0px'}); io.observe(lt); }
    } else if (r === 'mockrun') title.textContent = 'สอบจำลอง';
  }
  var cs = curSub(); $$('a[data-tab]', tabbar).forEach(function (x) { var t = x.dataset.tab, hr = t === 'practice' ? '#/' + cs : t === 'mock' ? '#/' + cs + '/mock' : t === 'me' ? '#/' + cs + '/me' : null; if (hr && x.getAttribute('href') !== hr) x.setAttribute('href', hr); });
  aboutCounts();
  var tab = st ? TAB[r] : undefined, show = st && tab !== undefined;
  tabbar.hidden = !show; document.body.classList.toggle('has-tabs', !!show);
  $$('a', tabbar).forEach(function (x) { var on = x.dataset.tab === tab; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  var stp = $('.steps', app); if (stp) stp.classList.add('seg');
  var f = $('[data-f]', app); if (f && f.parentNode) f.parentNode.classList.add('seg');
}
function aboutCounts() {
  var live = SUBS().filter(function (x) { return x.live && x.bank; }), n = 0, yr = {}; if (!live.length) return;
  var other = 0; live.forEach(function (x) { x.bank.items.forEach(function (it) { if (isReal(it)) { n++; yr[it.year] = 1; } else other++; }); });
  var y = Object.keys(yr).sort(), a = $('[data-ab="n"]', about), b = $('[data-ab="nt"]', about), c = $('[data-ab="s"]', about), d = $('[data-ab="st"]', about);
  if (a) setT(a, String(n)); if (b) setT(b, 'ข้อสอบจริง ทปอ. ' + (y.length > 1 ? y[0] + '–' + y[y.length - 1] : y[0] || '') + (other ? ' + ข้อฝึก TGAT ' + other : ''));
  var mt = $('[data-ab="mt"]', about); if (mt && live.length > 1) setT(mt, 'สอบจำลองจับเวลาเท่าสนามจริง ทุกวิชา');
  if (c) setT(c, String(live.length)); if (d) setT(d, live.length > 1 ? 'วิชา · ' + live.map(function (x) { return SHORTNAME[x.id] || x.name; }).join(' ') : 'สาระ · 17 หัวข้อ');
}
function schedule() { if (!pending) { pending = true; Promise.resolve().then(decorate); } }
new MutationObserver(function (ms) {
  for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (!(t.id === 'timer' || (t.parentNode && t.parentNode.id === 'timer'))) return schedule(); }
}).observe(app, {childList: true, subtree: true});
window.addEventListener('hashchange', function () { about.hidden = true; schedule(); });
new MutationObserver(function () { document.body.classList.toggle('sheet-open', !modal.hidden || !about.hidden); sheetText(); }).observe(modal, {attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true});
new MutationObserver(syncShort).observe(sync, {childList: true, characterData: true, subtree: true});
modal.addEventListener('click', function (e) { if (e.target === modal) { var n = $('#mNo'); if (n) n.click(); } });
// เกี่ยวกับ / ความเป็นส่วนตัว (แผ่นล่าง)
function openAbout(which) { about.hidden = false; document.body.classList.add('sheet-open'); var box = $('.modal-box', about); box.scrollTop = 0; if (which === 'privacy') { var p = $('#privacy'); box.scrollTop = p.offsetTop - 16; } }
function closeAbout() { about.hidden = true; document.body.classList.toggle('sheet-open', !modal.hidden); }
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-about]'); if (b) { e.preventDefault(); openAbout(b.getAttribute('data-about')); } });
about.addEventListener('click', function (e) { if (e.target === about || (e.target.closest && e.target.closest('[data-close]'))) closeAbout(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !about.hidden) closeAbout(); });
sync.addEventListener('click', function () { sync.classList.toggle('full'); });
document.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('button,.btn,.tabbar a'); if (b && !b.disabled && navigator.vibrate) { try { navigator.vibrate(5); } catch (x) {} } }, {passive: true});
syncShort(); decorate();
})();
