// Exam Gym ม.6 · e2e Firebase · TARGET=emu (Local Emulator Suite) | real (โปรเจกต์จริง · ต้องมี GOOGLE_APPLICATION_CREDENTIALS)
// ใช้บัญชีทดสอบชั่วคราว (เลข 998xx/9999x · role test) แล้วลบทิ้งตอนจบ · ไม่แตะบัญชีจริง ยกเว้น EG_VERIFY_FILE (ตรวจว่าเข้าด้วยรหัสครั้งแรกแล้วถูกบังคับเปลี่ยน · ไม่เปลี่ยนรหัส)
import fs from 'fs';
import { require, PROJECT, AUTH_HOST, FS_HOST, DOMAIN, FIRST_PW, clearEmulators, makeFbRec, startSheetMock, startStatic, testConfig, ok, expectReject, summary } from './harness.mjs';
const TARGET = process.env.TARGET || 'emu', REAL = TARGET === 'real';
if (!REAL) { process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST; process.env.FIRESTORE_EMULATOR_HOST = FS_HOST; }
const admin = require('firebase-admin');
const { initializeApp, deleteApp } = require('firebase/app');
const A = require('firebase/auth'), F = require('firebase/firestore');
const { chromium } = require('playwright');
const FBCFG = REAL ? JSON.parse(fs.readFileSync(process.env.EG_FIREBASE_CONFIG, 'utf8')) : { apiKey: 'fake-api-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1' };
admin.initializeApp(REAL ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))), projectId: PROJECT } : { projectId: PROJECT });
const auth = admin.auth(), db = admin.firestore();
const TS = admin.firestore.FieldValue.serverTimestamp;
const T = { stu: '99999', other: '99997', teacher: '99998', par: Array.from({ length: 30 }, (_, i) => String(99800 + i)) };
const TEACHER_EMAIL = 'teacher99998@test.examgym-m6.invalid';
const em = (sid) => `${sid}@${DOMAIN}`;
const P1 = 'Tst-' + Math.random().toString(36).slice(2, 10), P2 = 'Tst2-' + Math.random().toString(36).slice(2, 10), OTHER_PW = 'Oth-' + Math.random().toString(36).slice(2, 10);
const TEMP_UIDS = ['s' + T.stu, 's' + T.other, 't' + T.teacher, ...T.par.map((s) => 's' + s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = (a) => { const s = a.slice().sort((x, y) => x - y), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return `n=${s.length} min ${s[0]}ms · median ${q(0.5)}ms · p95 ${q(0.95)}ms · max ${s[s.length - 1]}ms`; };

async function mkUser(uid, email, pw, prof, claims) {
  try { await auth.deleteUser(uid); } catch {}
  await auth.createUser({ uid, email, password: pw, emailVerified: true });
  if (claims) await auth.setCustomUserClaims(uid, claims);
  await db.doc('users/' + uid).set({ ...prof, email, createdAt: TS() });
}
async function seed() {
  await mkUser('s' + T.stu, em(T.stu), FIRST_PW, { sid: T.stu, name: 'TEST ทดสอบ 99999 (ลบได้)', room: 'TEST', no: 0, role: 'test', mustChange: true }, { role: 'test' });
  await mkUser('s' + T.other, em(T.other), OTHER_PW, { sid: T.other, name: 'TEST อื่น 99997 (ลบได้)', room: 'TEST', no: 0, role: 'test', mustChange: false }, { role: 'test' });
  await db.doc(`results/s${T.other}_Aseedother01`).set({ type: 'answer', eid: 'Aseedother01', uid: 's' + T.other, sid: T.other, room: 'TEST', itemId: '69-1', mode: 'practice', savedAt: TS() });
  await mkUser('t' + T.teacher, TEACHER_EMAIL, OTHER_PW, { sid: T.teacher, name: 'TEST ครู 99998 (ลบได้)', room: 'ครู', no: '', role: 'teacher', mustChange: false }, { role: 'teacher' });
  await db.doc('roles/t' + T.teacher).set({ teacher: true, sid: T.teacher, test: true });
  await Promise.all(T.par.map((s) => mkUser('s' + s, em(s), FIRST_PW, { sid: s, name: 'TEST พร้อมกัน ' + s, room: 'TEST', no: 0, role: 'test', mustChange: true }, { role: 'test' })));
}
async function cleanup(extraUids = []) {
  const uids = TEMP_UIDS.concat(extraUids);
  for (const col of ['results', 'sessions']) {
    for (const u of uids) { const q = await db.collection(col).where('uid', '==', u).get(); await Promise.all(q.docs.map((d) => d.ref.delete())); }
  }
  await Promise.all(uids.map((u) => db.doc('users/' + u).delete()));
  await db.doc('roles/t' + T.teacher).delete();
  const r = await auth.deleteUsers(uids);
  return r.successCount;
}
// ---- client SDK (Node) ----
let appN = 0;
async function client(email, pw) {
  const app = initializeApp(FBCFG, 'c' + (++appN)), a = A.getAuth(app), d = F.getFirestore(app);
  if (!REAL) { A.connectAuthEmulator(a, `http://${AUTH_HOST}`, { disableWarnings: true }); F.connectFirestoreEmulator(d, ...FS_HOST.split(':').map((x, i) => (i ? Number(x) : x))); }
  if (email === 'signup') { const c = await A.createUserWithEmailAndPassword(a, `stranger${Date.now()}@test.examgym-m6.invalid`, 'Str-' + Math.random().toString(36).slice(2)); return { app, a, d, uid: c.user.uid }; }
  if (email) await A.signInWithEmailAndPassword(a, email, pw);
  return { app, a, d, uid: a.currentUser && a.currentUser.uid };
}

async function main() {
  console.log(`TARGET=${TARGET} · project ${PROJECT}`);
  if (!REAL) await clearEmulators();
  await seed(); console.log('seed: บัญชีทดสอบชั่วคราว ' + TEMP_UIDS.length);
  const teacherEmails = { [TEACHER_EMAIL]: T.teacher };
  const roster = [['TEST', 0, T.stu, 'TEST ทดสอบ 99999 (ลบได้)', ''], ['ครู', '', T.teacher, 'TEST ครู', 'ครู']];
  const fbRec = makeFbRec(roster, teacherEmails, REAL ? { lookupBase: 'https://identitytoolkit.googleapis.com', apiKey: FBCFG.apiKey } : {});
  const sheet = await startSheetMock(8138, fbRec);
  const web = await startStatic(8137, testConfig({ saveUrl: 'http://127.0.0.1:8138/exec', emulators: !REAL, firebaseConfig: FBCFG }));
  const URL0 = 'http://127.0.0.1:8137/';
  const browser = await chromium.launch();
  let strangerUid = '';
  try {
    // ===== 1) เข้าสู่ระบบครั้งแรก → บังคับตั้งรหัส =====
    console.log('\n[1] นักเรียนทดสอบ 99999: เข้าครั้งแรก + บังคับตั้งรหัส');
    const ctx = await browser.newContext(), pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.goto(URL0 + '#/register'); await pg.waitForSelector('#un');
    ok(await pg.locator('#pw').getAttribute('placeholder') === 'ครั้งแรก: รหัสที่ครูแจ้ง', 'หน้าเข้าสู่ระบบ Firebase แสดง (ไม่บอกรหัสครั้งแรก)');
    const login = async (u, p) => { await pg.fill('#un', u); await pg.fill('#pw', p); await pg.click('#go'); };
    const msg = async () => pg.evaluate(() => (document.querySelector('#msg') || {}).textContent || '');
    await login(T.stu, 'wrong-pass-1'); await pg.waitForFunction(() => document.querySelector('#msg') && document.querySelector('#msg').textContent.length > 0);
    ok(/ไม่ถูกต้อง/.test(await msg()), 'รหัสผิด → ข้อความผิดพลาด', await msg());
    let t0 = Date.now(); await login(T.stu, FIRST_PW); await pg.waitForSelector('#sf', { timeout: 20000 });
    ok(true, 'รหัสครั้งแรก → หน้าบังคับตั้งรหัสใหม่', `${Date.now() - t0}ms`);
    const setpw = async (a, b) => { await pg.fill('#np', a); await pg.fill('#np2', b); await pg.click('#go'); await sleep(150); return msg(); };
    ok(/อย่างน้อย 6/.test(await setpw('12345', '12345')), 'รหัสใหม่สั้นกว่า 6 ตัว → ไม่ผ่าน');
    ok(/ไม่ตรงกัน/.test(await setpw(P1, P1 + 'x')), 'ยืนยันไม่ตรงกัน → ไม่ผ่าน');
    ok(/รหัสครั้งแรก/.test(await setpw(FIRST_PW, FIRST_PW)), 'ใช้รหัสครั้งแรกเป็นรหัสใหม่ → ไม่ผ่าน');
    ok((await db.doc('users/s' + T.stu).get()).get('mustChange') === true, 'ก่อนตั้งรหัส: mustChange ยังเป็น true');
    t0 = Date.now(); await setpw(P1, P1); await pg.waitForURL(/#\/subjects/, { timeout: 20000 });
    ok(true, 'ตั้งรหัสใหม่สำเร็จ → เข้าหน้าวิชา', `${Date.now() - t0}ms`);
    const prof = (await db.doc('users/s' + T.stu).get()).data();
    ok(prof.mustChange === false && !!prof.pwChangedAt, 'Firestore: mustChange=false + pwChangedAt');
    // ===== 2) บันทึกคะแนน → Firestore + Sheet =====
    console.log('\n[2] บันทึกผล → Firestore + Sheet (ผ่าน fbRec_ ' + (fbRec.gs ? 'ของ .gs จริง' : 'JS') + ')');
    await pg.goto(URL0 + '#/soc/sara/1'); await pg.waitForSelector('[data-go],[data-t]'); await pg.locator('[data-go],[data-t]').first().click();
    await pg.waitForSelector('.choices button'); await pg.locator('.choices button').first().click();
    await pg.evaluate(() => window.__EG.flush(true));
    let fsDocs = [], sheetRows = [];
    for (let i = 0; i < 40; i++) { fsDocs = (await db.collection('results').where('uid', '==', 's' + T.stu).get()).docs.map((d) => d.data()); sheetRows = sheet.rows.filter((r) => r._sid === T.stu); if (fsDocs.length && sheetRows.length) break; await sleep(500); await pg.evaluate(() => window.__EG.flush(true)); }
    ok(fsDocs.length >= 1 && fsDocs[0].type === 'answer' && fsDocs[0].sid === T.stu, 'Firestore results มีคำตอบของ 99999', `${fsDocs.length} รายการ`);
    ok(sheetRows.length >= 1 && sheetRows.some((r) => fsDocs.some((f) => f.eid === r.eid)), 'Sheet (/exec events + fbtoken) ได้รับคำตอบเดียวกัน', `${sheetRows.length} แถว`);
    ok(sheet.log.every((l) => !l.hasTok), 'ไม่ส่ง token ของ Apps Script (ใช้ fbtoken)');
    const q = await pg.evaluate(() => JSON.parse(localStorage.getItem('eg6:q') || '[]').filter((x) => x.type !== 'session').length);
    ok(q === 0, 'คิวในเครื่องว่างหลังส่ง', `เหลือ ${q}`);
    // ===== 3) รีเฟรช / ออก / เข้าใหม่ =====
    console.log('\n[3] รีเฟรช · ออกจากระบบ · เข้าใหม่');
    await pg.reload(); await pg.goto(URL0 + '#/subjects'); await sleep(1500);
    ok(/subjects/.test(pg.url()) && /TEST ทดสอบ 99999/.test(await pg.content()), 'รีเฟรชแล้วยังเข้าสู่ระบบอยู่');
    const logout = async () => { await pg.goto(URL0 + '#/soc/me'); await pg.waitForSelector('#lo'); await pg.click('#lo'); await pg.locator('#modal button.pri, #modal .btn.pri').first().click(); await pg.waitForSelector('#un'); };
    await logout(); ok(true, 'ออกจากระบบ (ผลของฉัน)');
    await login(T.stu, FIRST_PW); await pg.waitForFunction(() => document.querySelector('#msg').textContent.length > 0);
    ok(/ไม่ถูกต้อง/.test(await msg()), 'รหัสครั้งแรกใช้ไม่ได้อีก');
    t0 = Date.now(); await login(T.stu, P1); await pg.waitForURL(/#\/subjects/, { timeout: 20000 });
    ok(true, 'เข้าด้วยรหัสใหม่ → ตรงเข้าหน้าวิชา (ไม่บังคับเปลี่ยนซ้ำ)', `${Date.now() - t0}ms`);
    // ===== 4) เปลี่ยนรหัสเอง (ผลของฉัน) =====
    console.log('\n[4] เปลี่ยนรหัสผ่านเอง');
    await pg.goto(URL0 + '#/soc/me'); await pg.waitForSelector('#chpw'); await pg.click('#chpw'); await pg.waitForSelector('#op');
    await pg.fill('#op', 'not-the-old-pw'); ok(/เดิมไม่ถูกต้อง/.test(await (async () => { await pg.fill('#np', P2); await pg.fill('#np2', P2); await pg.click('#go'); await pg.waitForFunction(() => document.querySelector('#msg').textContent.length > 0, null, { timeout: 20000 }); return msg(); })()), 'รหัสเดิมผิด → ไม่ผ่าน');
    await pg.fill('#op', P1); await pg.fill('#np', P1); await pg.fill('#np2', P1); await pg.click('#go'); await sleep(150);
    ok(/ไม่ซ้ำรหัสเดิม/.test(await msg()), 'รหัสใหม่ซ้ำรหัสเดิม → ไม่ผ่าน');
    await pg.fill('#op', P1); await pg.fill('#np', P2); await pg.fill('#np2', P2); await pg.click('#go');
    await pg.waitForSelector('#meflash', { timeout: 20000 }); ok(true, 'เปลี่ยนรหัสสำเร็จ (ข้อความยืนยัน)');
    await logout(); await login(T.stu, P1); await pg.waitForFunction(() => document.querySelector('#msg').textContent.length > 0);
    ok(/ไม่ถูกต้อง/.test(await msg()), 'รหัสเก่าใช้ไม่ได้หลังเปลี่ยน');
    await login(T.stu, P2); await pg.waitForURL(/#\/subjects/, { timeout: 20000 }); ok(true, 'รหัสใหม่ล่าสุดใช้ได้');
    await logout();
    ok(errs.length === 0, 'ไม่มี JavaScript error ในหน้าเว็บ', errs.slice(0, 2).join(' | '));
    await ctx.close();

    // ===== 5) Security rules =====
    console.log('\n[5] Security rules (client SDK)');
    const S = await client(em(T.stu), P2), D = S.d;
    ok((await F.getDoc(F.doc(D, 'users', S.uid))).exists(), 'นักเรียนอ่านโปรไฟล์ตัวเองได้');
    await expectReject(F.getDoc(F.doc(D, 'users', 's' + T.other)), 'นักเรียนอ่านโปรไฟล์คนอื่นไม่ได้', /permission/);
    await expectReject(F.getDoc(F.doc(D, 'results', `s${T.other}_Aseedother01`)), 'นักเรียนอ่านผลของคนอื่นไม่ได้', /permission/);
    await expectReject(F.getDocs(F.collection(D, 'results')), 'นักเรียน list ผลทั้งหมดไม่ได้', /permission/);
    await expectReject(F.getDocs(F.collection(D, 'users')), 'นักเรียน list users ไม่ได้', /permission/);
    ok((await F.getDocs(F.query(F.collection(D, 'results'), F.where('uid', '==', S.uid)))).size >= 1, 'นักเรียน query ผลของตัวเองได้');
    await expectReject(F.setDoc(F.doc(D, 'results', `s${T.other}_Aforge00001`), { type: 'answer', eid: 'Aforge00001', uid: 's' + T.other, sid: T.other, itemId: '69-1', mode: 'practice', savedAt: F.serverTimestamp() }), 'เขียนผลในชื่อคนอื่นไม่ได้', /permission/);
    await expectReject(F.setDoc(F.doc(D, 'results', `${S.uid}_Aforge00002`), { type: 'answer', eid: 'Aforge00002', uid: S.uid, sid: T.other, itemId: '69-1', mode: 'practice', savedAt: F.serverTimestamp() }), 'ปลอม sid ในผลไม่ได้', /permission/);
    const own = `${S.uid}_Aown0000001`;
    await F.setDoc(F.doc(D, 'results', own), { type: 'answer', eid: 'Aown0000001', uid: S.uid, sid: T.stu, room: 'TEST', itemId: '69-2', mode: 'practice', sara: 1, chosen: 2, correct: false, sec: 12.5, savedAt: F.serverTimestamp() });
    ok(true, 'นักเรียนเขียนผลของตัวเองได้');
    await expectReject(F.updateDoc(F.doc(D, 'results', own), { correct: true }), 'แก้ผลที่ส่งแล้วไม่ได้ (immutable)', /permission/);
    await expectReject(F.deleteDoc(F.doc(D, 'results', own)), 'ลบผลไม่ได้', /permission/);
    await expectReject(F.updateDoc(F.doc(D, 'users', S.uid), { name: 'แฮก' }), 'แก้ชื่อในโปรไฟล์ไม่ได้', /permission/);
    await expectReject(F.updateDoc(F.doc(D, 'users', S.uid), { role: 'teacher' }), 'ตั้งตัวเองเป็นครูไม่ได้', /permission/);
    await expectReject(F.updateDoc(F.doc(D, 'users', S.uid), { mustChange: true, pwChangedAt: F.serverTimestamp() }), 'ตั้ง mustChange กลับไม่ได้', /permission/);
    await expectReject(F.setDoc(F.doc(D, 'roles', S.uid), { teacher: true }), 'สร้าง roles ให้ตัวเองไม่ได้', /permission/);
    await expectReject(F.setDoc(F.doc(D, 'other', 'x'), { a: 1 }), 'เขียนคอลเลกชันอื่นไม่ได้', /permission/);
    await deleteApp(S.app);
    const N = await client(em(T.par[0]), FIRST_PW);
    await expectReject(F.setDoc(F.doc(N.d, 'results', `${N.uid}_Anotready01`), { type: 'answer', eid: 'Anotready01', uid: N.uid, sid: T.par[0], itemId: '69-1', mode: 'practice', savedAt: F.serverTimestamp() }), 'ยังไม่ตั้งรหัสเอง (mustChange) → ส่งผลไม่ได้', /permission/);
    await expectReject(F.updateDoc(F.doc(N.d, 'users', N.uid), { mustChange: false }), 'ปิด mustChange โดยไม่มี pwChangedAt ไม่ได้', /permission/);
    await deleteApp(N.app);
    const Tc = await client(TEACHER_EMAIL, OTHER_PW);
    const allUsers = await F.getDocs(F.collection(Tc.d, 'users')); ok(allUsers.size >= 3, 'ครูอ่าน users ทั้งหมดได้', `${allUsers.size} คน`);
    const allRes = await F.getDocs(F.collection(Tc.d, 'results')); ok(allRes.docs.some((d) => d.get('uid') === 's' + T.stu), 'ครูอ่านผลของนักเรียนทุกคนได้', `${allRes.size} รายการ`);
    ok((await F.getDocs(F.collection(Tc.d, 'sessions'))).size >= 0, 'ครูอ่าน sessions ได้');
    await deleteApp(Tc.app);
    const U = await client(null);
    await expectReject(F.getDoc(F.doc(U.d, 'users', 's' + T.stu)), 'ไม่ได้เข้าสู่ระบบ → อ่านไม่ได้', /permission/);
    await deleteApp(U.app);
    try {
      const X = await client('signup'); strangerUid = X.uid;
      ok(true, 'หมายเหตุ: สมัครเองผ่าน apiKey ได้ (ควรปิด sign-up ใน Console)');
      await expectReject(F.getDoc(F.doc(X.d, 'users', 's' + T.stu)), 'บัญชีที่สมัครเอง (ไม่มีโปรไฟล์) อ่านข้อมูลคนอื่นไม่ได้', /permission/);
      await expectReject(F.setDoc(F.doc(X.d, 'results', `${X.uid}_Astranger01`), { type: 'answer', eid: 'Astranger01', uid: X.uid, sid: '1', itemId: '69-1', mode: 'practice', savedAt: F.serverTimestamp() }), 'บัญชีที่สมัครเองส่งผลไม่ได้', /permission/);
      await expectReject(F.getDocs(F.collection(X.d, 'results')), 'บัญชีที่สมัครเอง list ผลไม่ได้', /permission/);
      await deleteApp(X.app);
    } catch (e) { ok(/admin-restricted|operation-not-allowed/.test(e.code || ''), 'สมัครเองผ่าน apiKey ถูกปิดแล้ว', e.code); }

    // ===== 6) 30 คนเข้าพร้อมกัน =====
    console.log('\n[6] 30 คนเข้าสู่ระบบพร้อมกัน (เบราว์เซอร์ 30 หน้าต่าง)');
    const ctxs = await Promise.all(T.par.map(() => browser.newContext()));
    const pages = await Promise.all(ctxs.map(async (c) => { const p = await c.newPage(); await p.goto(URL0 + '#/register'); await p.waitForSelector('#un'); return p; }));
    await Promise.all(pages.map((p, i) => p.fill('#un', T.par[i]).then(() => p.fill('#pw', FIRST_PW))));
    await sleep(1500); // ให้ SDK โหลดเสร็จ (โหลดล่วงหน้าตอนเปิดหน้า)
    const times = await Promise.all(pages.map(async (p) => { const t = Date.now(); await p.click('#go'); await p.waitForSelector('#sf', { timeout: 60000 }); return Date.now() - t; }));
    ok(times.length === 30, '30/30 เข้าได้และถูกบังคับตั้งรหัส', stats(times));
    await Promise.all(ctxs.map((c) => c.close()));
    console.log('    (Node SDK) 30 signIn + อ่านโปรไฟล์ พร้อมกัน');
    const nt = await Promise.all(T.par.map(async (s) => { const t = Date.now(); const c = await client(em(s), FIRST_PW); await F.getDoc(F.doc(c.d, 'users', c.uid)); const dt = Date.now() - t; await deleteApp(c.app); return dt; }));
    ok(nt.length === 30, '30/30 (Node SDK)', stats(nt));

    // ===== 7) ตรวจบัญชีจริง (เข้าด้วยรหัสครั้งแรก → ถูกบังคับเปลี่ยน → ยกเลิก/ออก · ไม่เปลี่ยนรหัส) =====
    if (process.env.EG_VERIFY_FILE) {
      const users = fs.readFileSync(process.env.EG_VERIFY_FILE, 'utf8').split(/\s+/).filter(Boolean);
      console.log(`\n[7] ตรวจบัญชีจริง ${users.length} บัญชี (หน้าเว็บในเครื่อง)`);
      let good = 0; const bad = [], vt = [];
      for (let i = 0; i < users.length; i += 6) {
        await Promise.all(users.slice(i, i + 6).map(async (u) => {
          const c = await browser.newContext(), p = await c.newPage();
          try {
            await p.goto(URL0 + '#/register'); await p.waitForSelector('#un'); await p.fill('#un', u); await p.fill('#pw', FIRST_PW);
            const t = Date.now(); await p.click('#go'); await p.waitForSelector('#sf', { timeout: 30000 }); vt.push(Date.now() - t);
            await p.$eval('#back', (a) => a.click()); await p.waitForSelector('#un', { timeout: 15000 });
            const still = await p.evaluate(() => localStorage.getItem('eg6:student'));
            if (still && still !== 'null') throw new Error('ยังค้างสถานะเข้าสู่ระบบ');
            good++;
          } catch (e) { bad.push('#' + (users.indexOf(u) + 1) + ':' + e.message.split('\n')[0].slice(0, 60)); }
          await c.close();
        }));
      }
      ok(good === users.length, `บัญชีจริงเข้าด้วยรหัสครั้งแรก + ถูกบังคับตั้งรหัส ${good}/${users.length}`, (vt.length ? stats(vt) : '') + (bad.length ? ' · ไม่ผ่าน: ' + bad.join(', ') : ''));
    }
  } finally {
    await browser.close(); web.close(); sheet.srv.close();
    const n = await cleanup(strangerUid ? [strangerUid] : []);
    const left = (await Promise.all(TEMP_UIDS.map((u) => db.doc('users/' + u).get()))).filter((s) => s.exists).length;
    console.log(`\ncleanup: ลบบัญชีทดสอบ ${n} · โปรไฟล์ทดสอบที่เหลือ ${left}`);
  }
  process.exit(summary(`สรุป TARGET=${TARGET}`) ? 1 : 0);
}
main().catch(async (e) => { console.error('FATAL', e); try { await cleanup(); } catch {} process.exit(1); });
