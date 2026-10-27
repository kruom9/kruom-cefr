// Exam Gym ม.6 · ชุดทดสอบ Firebase (Local Emulator Suite) · ไม่มีรหัสผ่านจริง/รายชื่อจริงในไฟล์นี้
// ต้องตั้ง EG_FIRST_PW (รหัสครั้งแรก · อ่านจากไฟล์ส่วนตัว) · EG_NODE_MODULES (โฟลเดอร์ที่มี firebase, firebase-admin, playwright)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
export const require = createRequire(path.join(process.env.EG_NODE_MODULES || process.cwd(), 'package.json'));
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, '../../m6-ios');
export const PROJECT = 'kruom-examgym-m6';
export const AUTH_HOST = '127.0.0.1:9099', FS_HOST = '127.0.0.1:8080';
export const DOMAIN = 'students.examgym-m6.invalid';
export const FIRST_PW = process.env.EG_FIRST_PW || '';
if (FIRST_PW.length < 6) { console.error('ตั้ง EG_FIRST_PW (≥6 ตัว) ก่อน'); process.exit(2); }

export async function clearEmulators() {
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

// ---- Sheet mock: เลียนแบบ Apps Script /exec (health, ack, events ด้วย fbtoken) ----
// ถ้าตั้ง EG_GS_ADDON = path ของ Code_firebase_addon.gs จะรันโค้ด .gs จริง (fbRec_) ด้วย stub · ไม่งั้นใช้ตรรกะเดียวกันใน JS
export function makeFbRec(roster, teacherEmails, { lookupBase = `http://${AUTH_HOST}/identitytoolkit.googleapis.com`, apiKey = 'fake-api-key' } = {}) {
  const cache = new Map();
  const recOf = (r) => ({ room: r[4] === 'ครู' ? 'ครู' : r[0], no: r[1], sid: r[2], name: r[3], role: r[4] === 'ครู' ? 'teacher' : 'student' });
  const bySid = (sid) => { const h = roster.filter((r) => r[2] === sid); return h.length === 1 ? h[0] : null; };
  const lookup = (tok) => {
    const out = execFileSync('curl', ['-s', '-w', '\n%{http_code}', '-X', 'POST', '-H', 'Content-Type: application/json',
      `${lookupBase}/v1/accounts:lookup?key=${apiKey}`, '-d', JSON.stringify({ idToken: tok })]).toString();
    const i = out.lastIndexOf('\n'); return { code: Number(out.slice(i + 1)), text: out.slice(0, i) };
  };
  const src = process.env.EG_GS_ADDON && fs.existsSync(process.env.EG_GS_ADDON) ? fs.readFileSync(process.env.EG_GS_ADDON, 'utf8') : '';
  if (src) {
    const stubs = {
      prop_: (k) => ({ FIREBASE_API_KEY: apiKey, FIREBASE_PROJECT_ID: PROJECT })[k] || '',
      sha_: (s) => crypto.createHash('sha256').update(String(s)).digest('hex'),
      TEACHER_EMAILS: teacherEmails, bySid_: bySid, recOf_: recOf,
      CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
      Utilities: { base64DecodeWebSafe: (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), newBlob: (b) => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }) },
      UrlFetchApp: { fetch: (url, o) => { const r = lookup(JSON.parse(o.payload).idToken); return { getResponseCode: () => r.code, getContentText: () => r.text }; } },
    };
    const fn = new Function(...Object.keys(stubs), src + '\nreturn fbRec_;');
    const f = fn(...Object.values(stubs)); f.gs = true; return f;
  }
  return Object.assign((tok) => {
    const pl = JSON.parse(Buffer.from(String(tok).split('.')[1], 'base64url').toString());
    if (pl.aud !== PROJECT) return null;
    const r = lookup(tok); if (r.code !== 200) return null;
    const u = (JSON.parse(r.text).users || [])[0]; if (!u) return null;
    const email = u.email.toLowerCase(), m = email.match(/^(\d{3,8})@(.+)$/);
    const sid = m && m[2] === DOMAIN ? m[1] : teacherEmails[email]; const row = sid && bySid(sid);
    return row ? recOf(row) : null;
  }, { gs: false });
}
export function startSheetMock(port, fbRec) {
  const rows = [], seen = new Set(), log = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), send = (o, cb) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (cb) { res.setHeader('Content-Type', 'text/javascript'); res.end(`${cb}(${JSON.stringify(o)});`); }
      else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); }
    };
    if (req.method === 'GET') {
      const a = u.searchParams.get('action'), cb = u.searchParams.get('callback');
      if (a === 'ack') return send({ ok: true, have: String(u.searchParams.get('eids') || '').split(',').filter((e) => seen.has(e)) }, cb);
      return send({ ok: true, api: 2, auth: 5, login: 'id', fb: 1 }, cb);
    }
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      let d = {}; try { d = JSON.parse(body); } catch {}
      log.push({ action: d.action, hasFb: !!d.fbtoken, hasTok: !!d.token });
      if (d.action !== 'events') return send({ ok: false, error: 'bad action' });
      const rec = d.fbtoken ? fbRec(d.fbtoken) : null;
      if (!rec) return send({ ok: false, error: 'need login', code: 'need_login' });
      const saved = [], dup = [];
      (d.events || []).forEach((ev) => { if (seen.has(ev.eid)) dup.push(ev.eid); else { seen.add(ev.eid); saved.push(ev.eid); rows.push({ ...ev, _sid: rec.sid, _name: rec.name, _room: rec.room }); } });
      send({ ok: true, saved, dup, bad: [] });
    });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, rows, log })));
}

// ---- เสิร์ฟหน้าเว็บ m6-ios (ไฟล์จริง) · config.js ถูกแทนด้วยค่าทดสอบ ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
export function startStatic(port, configJs) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    if (p === '/config.js') { res.setHeader('Content-Type', MIME['.js']); return res.end(configJs); }
    const f = path.join(APP_DIR, path.normalize(p));
    if (!f.startsWith(APP_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
    res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}
export function testConfig({ saveUrl, provider = 'firebase', emulators = true, firebaseConfig }) {
  const base = fs.readFileSync(path.join(APP_DIR, 'config.js'), 'utf8');
  const cfg = new Function('window', base + '\nreturn window.EXAMGYM_CONFIG;')({});
  cfg.AUTH_PROVIDER = provider; cfg.SAVE_URL = saveUrl;
  if (firebaseConfig) cfg.FIREBASE.config = firebaseConfig;
  if (emulators) cfg.FIREBASE.EMULATORS = { auth: `http://${AUTH_HOST}`, firestore: FS_HOST.split(':').map((x, i) => (i ? Number(x) : x)) };
  return 'window.EXAMGYM_CONFIG = ' + JSON.stringify(cfg) + ';';
}

let pass = 0, fail = 0; const fails = [];
export function ok(cond, name, extra) { if (cond) { pass++; console.log('  ✔ ' + name + (extra ? ' · ' + extra : '')); } else { fail++; fails.push(name); console.log('  ✘ ' + name + (extra ? ' · ' + extra : '')); } }
export async function expectReject(p, name, codeRe) { try { await p; ok(false, name, 'ผ่านทั้งที่ควรถูกปฏิเสธ'); } catch (e) { ok(!codeRe || codeRe.test(e.code || e.message), name, e.code || ''); } }
export function summary(label) { console.log(`\n${label}: ผ่าน ${pass} · ไม่ผ่าน ${fail}` + (fails.length ? ' · ' + fails.join(' | ') : '')); return fail; }
