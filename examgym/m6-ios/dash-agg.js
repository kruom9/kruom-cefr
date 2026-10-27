/* Exam Gym ม.6 · แดชบอร์ดครู · ตัวรวมสถิติ (ฟังก์ชันล้วน ไม่มีข้อมูลนักเรียนในไฟล์นี้)
   ใช้ร่วมกัน 3 ที่: Apps Script (คัดลอกเข้า Code_idpw_v7_dash.gs) · เบราว์เซอร์ (ตัวอ่าน Firestore) · ชุดทดสอบ Node
   ข้อมูลเข้า (raw) — ทุกเวลาเป็นมิลลิวินาที:
     roster:   [{sid, room, no, name}]                     เฉพาะนักเรียน (ไม่มีแฮช/เลขประชาชน)
     answers:  [{sid, subject, mode, set, itemId, sara, topic, attempt, correct, blank, sec, ts, sessionId}]
     mocks:    [{sid, subject, set, score, total, usedSec, timeout, answered, ts}]
     sessions: [{sid, sessionId, start, last, activeSec}]
     now:      เวลาปัจจุบัน */
(function (root) {
'use strict';
var DAY = 86400000, TZ_MS = 7 * 3600000; // เวลาไทย UTC+7 (ไม่มีเวลาออมแสง)
function dayKey(ts) { return new Date(Number(ts) + TZ_MS).toISOString().slice(0, 10); }
function dayStart(ts) { return Math.floor((Number(ts) + TZ_MS) / DAY) * DAY - TZ_MS; }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function r1(x) { return Math.round(x * 10) / 10; }
function pct(c, n) { return n ? Math.round(c * 1000 / n) / 10 : null; }
function cmpRoom(a, b) {
  var x = String(a).match(/(\d+)\/(\d+)/), y = String(b).match(/(\d+)\/(\d+)/);
  if (x && y) return (Number(x[1]) - Number(y[1])) || (Number(x[2]) - Number(y[2]));
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

// สรุปทั้งสายชั้น (มุมมอง 1) + สรุปรายคนแบบย่อ (มุมมอง 2 ใช้ต่อได้เลย)
function overview(raw, opt) {
  opt = opt || {};
  var now = num(raw.now) || Date.now(), days = opt.days || 30;
  var t7 = now - 7 * DAY, t30 = now - 30 * DAY, d0 = dayStart(now) - (days - 1) * DAY;
  var S = {}, order = [];
  (raw.roster || []).forEach(function (r) {
    var sid = String(r.sid || ''); if (!sid || own(S, sid)) return;
    S[sid] = {sid: sid, room: String(r.room || ''), no: r.no === '' || r.no == null ? '' : num(r.no), name: String(r.name || ''),
      answers: 0, correct: 0, items: 0, minutes: 0, mocks: 0, last: 0, a7: 0, a30: 0, m7: 0, m30: 0, subj: {}, _items: {}, _act7: false, _act30: false, _sec: 0, _ses: 0};
    order.push(sid);
  });
  var daily = {}, i;
  for (i = 0; i < days; i++) daily[dayKey(d0 + i * DAY + 1)] = {d: dayKey(d0 + i * DAY + 1), answers: 0, mocks: 0, active: 0, _who: {}};
  var SUBJ = {};
  function sub(id) { return SUBJ[id] = SUBJ[id] || {id: id, answers: 0, correct: 0, mocks: 0, a7: 0, students: 0, active7: 0, last: 0, _who: {}, _who7: {}}; }
  function ps(s, id) { return s.subj[id] = s.subj[id] || {answers: 0, correct: 0, items: 0, topics: 0, topicIds: [], last: 0, mocks: 0, mock: null, _items: {}, _topics: {}}; }
  function touch(s, ts) {
    if (ts > s.last) s.last = ts;
    if (ts >= t7) s._act7 = true; if (ts >= t30) s._act30 = true;
    var dk = ts >= d0 ? dayKey(ts) : null; if (dk && daily[dk]) daily[dk]._who[s.sid] = 1;
  }
  (raw.answers || []).forEach(function (a) {
    var s = S[String(a.sid)]; if (!s) return;
    var ts = num(a.ts), id = String(a.subject || 'soc'), x = ps(s, id), g = sub(id), ok = !!a.correct && !a.blank;
    s.answers++; x.answers++; g.answers++; if (ok) { s.correct++; x.correct++; g.correct++; }
    s._sec += Math.max(0, Math.min(3600, num(a.sec)));
    var ik = id + ':' + a.itemId; if (!s._items[ik]) { s._items[ik] = 1; s.items++; }
    if (!x._items[a.itemId]) { x._items[a.itemId] = 1; x.items++; }
    var tp = String(a.topic || ''); if (tp && !x._topics[tp]) { x._topics[tp] = 1; x.topicIds.push(tp); x.topics++; }
    if (ts > x.last) x.last = ts; if (ts > g.last) g.last = ts;
    if (ts >= t7) { s.a7++; g.a7++; g._who7[s.sid] = 1; } if (ts >= t30) s.a30++;
    g._who[s.sid] = 1;
    var dk = ts >= d0 ? dayKey(ts) : null; if (dk && daily[dk]) daily[dk].answers++;
    touch(s, ts);
  });
  (raw.mocks || []).forEach(function (m) {
    var s = S[String(m.sid)]; if (!s) return;
    var ts = num(m.ts), id = String(m.subject || 'soc'), x = ps(s, id), g = sub(id);
    s.mocks++; x.mocks++; g.mocks++; if (ts >= t7) s.m7++; if (ts >= t30) s.m30++;
    if (!x.mock || ts >= x.mock.ts) x.mock = {score: num(m.score), total: num(m.total), pct: pct(num(m.score), num(m.total)), set: String(m.set || ''), ts: ts};
    if (ts > x.last) x.last = ts; if (ts > g.last) g.last = ts; g._who[s.sid] = 1; if (ts >= t7) g._who7[s.sid] = 1;
    var dk = ts >= d0 ? dayKey(ts) : null; if (dk && daily[dk]) daily[dk].mocks++;
    touch(s, ts);
  });
  (raw.sessions || []).forEach(function (q) {
    var s = S[String(q.sid)]; if (!s) return;
    s._ses += Math.max(0, Math.min(14400, num(q.activeSec)));
    var ts = num(q.last) || num(q.start); if (ts && num(q.activeSec) > 0) touch(s, ts);
  });
  var list = order.map(function (k) { return S[k]; });
  list.forEach(function (s) {
    s.minutes = r1(Math.max(s._ses, s._sec) / 60); // เวลาใช้งาน: จากเซสชัน (ถ้าไม่มี ใช้ผลรวมเวลาที่ใช้ตอบ)
    s.pct = pct(s.correct, s.answers); s.active7 = s._act7; s.active30 = s._act30;
    Object.keys(s.subj).forEach(function (id) { var x = s.subj[id]; x.pct = pct(x.correct, x.answers); x.topicIds.sort(); delete x._items; delete x._topics; });
    delete s._items; delete s._act7; delete s._act30; delete s._sec; delete s._ses;
  });
  // อันดับ: ข้อที่ตอบมาก → น้อย · เท่ากันดูเวลาใช้งาน · แล้วล่าสุด · แล้วห้อง/เลขที่
  list.sort(function (a, b) { return (b.answers - a.answers) || (b.minutes - a.minutes) || (b.mocks - a.mocks) || (b.last - a.last) || cmpRoom(a.room, b.room) || (num(a.no) - num(b.no)); });
  list.forEach(function (s, j) { s.rank = j + 1; });
  var rooms = {};
  list.forEach(function (s) {
    var r = rooms[s.room] = rooms[s.room] || {room: s.room, students: 0, active7: 0, active30: 0, answers: 0, correct: 0, mocks: 0, minutes: 0};
    r.students++; if (s.active7) r.active7++; if (s.active30) r.active30++; r.answers += s.answers; r.correct += s.correct; r.mocks += s.mocks; r.minutes = r1(r.minutes + s.minutes);
  });
  var roomList = Object.keys(rooms).map(function (k) { var r = rooms[k]; r.pct = pct(r.correct, r.answers); return r; }).sort(function (a, b) { return cmpRoom(a.room, b.room); });
  var subjList = Object.keys(SUBJ).map(function (k) { var g = SUBJ[k]; g.students = Object.keys(g._who).length; g.active7 = Object.keys(g._who7).length; g.pct = pct(g.correct, g.answers); delete g._who; delete g._who7; return g; })
    .sort(function (a, b) { return b.answers - a.answers || (a.id < b.id ? -1 : 1); });
  var dayList = Object.keys(daily).sort().map(function (k) { var d = daily[k]; d.active = Object.keys(d._who).length; delete d._who; return d; });
  var T = {students: list.length, active7: 0, active30: 0, answers: 0, answers7: 0, answers30: 0, correct: 0, mocks: 0, mocks7: 0, mocks30: 0, minutes: 0};
  list.forEach(function (s) { if (s.active7) T.active7++; if (s.active30) T.active30++; T.answers += s.answers; T.answers7 += s.a7; T.answers30 += s.a30; T.correct += s.correct; T.mocks += s.mocks; T.mocks7 += s.m7; T.mocks30 += s.m30; T.minutes = r1(T.minutes + s.minutes); });
  T.pct = pct(T.correct, T.answers);
  return {ok: true, kind: 'overview', at: now, days: days, totals: T, daily: dayList, subjects: subjList, rooms: roomList, students: list};
}

// รายละเอียดนักเรียน 1 คน (มุมมอง 3): รายหัวข้อ · ชุดฝึก · สอบเสมือนจริง แยกวิชา
function student(raw, sid) {
  sid = String(sid || '');
  var r = (raw.roster || []).filter(function (x) { return String(x.sid) === sid; })[0];
  if (!r) return {ok: false, code: 'not_found'};
  var out = {ok: true, kind: 'student', at: num(raw.now) || Date.now(), sid: sid, room: String(r.room || ''), no: r.no === '' || r.no == null ? '' : num(r.no), name: String(r.name || ''), subjects: {}};
  function ps(id) { return out.subjects[id] = out.subjects[id] || {topics: {}, sets: [], mocks: [], _sets: {}, _items: {}}; }
  (raw.answers || []).forEach(function (a) {
    if (String(a.sid) !== sid) return;
    var id = String(a.subject || 'soc'), x = ps(id), ts = num(a.ts), ok = !!a.correct && !a.blank, tp = String(a.topic || '');
    if (tp) {
      var t = x.topics[tp] = x.topics[tp] || {n: 0, c: 0, items: 0, first: ts, last: ts};
      t.n++; if (ok) t.c++; if (ts < t.first) t.first = ts; if (ts > t.last) t.last = ts;
      var ik = tp + '|' + a.itemId; if (!x._items[ik]) { x._items[ik] = 1; t.items++; }
    }
    if (a.mode === 'mock') return; // คำตอบในสอบเสมือนจริงแสดงเป็นผลสอบ (ด้านล่าง)
    var k = (a.sessionId || dayKey(ts)) + '|' + (a.mode || '') + '|' + (a.set || '');
    var st = x._sets[k]; if (!st) { st = x._sets[k] = {mode: String(a.mode || 'practice'), set: String(a.set || ''), ts: ts, end: ts, n: 0, c: 0, sec: 0}; x.sets.push(st); }
    st.n++; if (ok) st.c++; st.sec += Math.max(0, Math.min(3600, num(a.sec))); if (ts < st.ts) st.ts = ts; if (ts > st.end) st.end = ts;
  });
  (raw.mocks || []).forEach(function (m) {
    if (String(m.sid) !== sid) return;
    var x = ps(String(m.subject || 'soc'));
    x.mocks.push({set: String(m.set || ''), ts: num(m.ts), score: num(m.score), total: num(m.total), pct: pct(num(m.score), num(m.total)), usedSec: Math.round(num(m.usedSec)), timeout: !!m.timeout, answered: num(m.answered)});
  });
  Object.keys(out.subjects).forEach(function (id) {
    var x = out.subjects[id];
    Object.keys(x.topics).forEach(function (k) { var t = x.topics[k]; t.pct = pct(t.c, t.n); });
    x.sets.forEach(function (s) { s.pct = pct(s.c, s.n); s.sec = Math.round(s.sec); });
    x.sets.sort(function (a, b) { return a.ts - b.ts; }); x.mocks.sort(function (a, b) { return a.ts - b.ts; });
    delete x._sets; delete x._items;
  });
  return out;
}

// รวมกับคลังข้อสอบ: หัวข้อทั้งหมดของวิชา (ทำแล้ว/ยังไม่ทำ) · ใช้ในเบราว์เซอร์และทดสอบ
function coverage(bank, topics) {
  topics = topics || {};
  var saras = (bank && bank.saras || []).map(function (sa) {
    return {id: sa.id, name: sa.name, topics: (sa.topics || []).map(function (t) {
      var x = topics[t.id], n = (bank.items || []).filter(function (it) { return String(it.topic) === String(t.id); }).length;
      return {id: t.id, name: t.name, bankItems: n, covered: !!(x && x.n), n: x ? x.n : 0, c: x ? x.c : 0, items: x ? x.items : 0, pct: x ? pct(x.c, x.n) : null, last: x ? x.last : 0};
    })};
  });
  var all = [].concat.apply([], saras.map(function (s) { return s.topics; }));
  return {saras: saras, total: all.length, covered: all.filter(function (t) { return t.covered; }).length};
}
function topicIdsOf(bank) { return [].concat.apply([], (bank && bank.saras || []).map(function (s) { return (s.topics || []).map(function (t) { return String(t.id); }); })); }
function coveredCount(bank, topicIds) { var all = topicIdsOf(bank), have = {}; (topicIds || []).forEach(function (t) { have[String(t)] = 1; }); return {covered: all.filter(function (t) { return have[t]; }).length, total: all.length}; }

var API = {overview: overview, student: student, coverage: coverage, coveredCount: coveredCount, topicIdsOf: topicIdsOf, dayKey: dayKey, dayStart: dayStart, pct: pct, cmpRoom: cmpRoom};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.DashAgg = API;
})(typeof window !== 'undefined' ? window : this);
