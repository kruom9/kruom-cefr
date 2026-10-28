// ปิยมิตร ป.6 ฝ่าด่านจุฬาภรณ์ — World 1 science → World 2 math; each stage = 3 bands of 10 that unlock in order
// (easy 1–10 → medium 11–20 → hard 21–30, pass mark from exam_sets.unlock_rule.bands).
// Exam UI = the Exam Gym ปิยมิตรมัธยม (ม.1–ม.6) practice pattern, mobile-first portrait:
//   one question per screen · "ข้อ n/30" + band progress bar · choices ก–ง (48px+ tap targets) ·
//   select → "ตรวจคำตอบ" (server checks) → green/red + explanation → "ข้อต่อไป" · result screen with score ring + เฉลยทีละข้อ.
// Back end unchanged (js/backend.js): answer keys only ever come back from the server after an answer is recorded.
(function () {
  "use strict";
  const G = window.GAME_CONFIG, B = window.P6Backend, U = window.P6UI, esc = U.esc;
  const qs = new URLSearchParams(location.search);
  const L = U.KEYS, BN = G.bandNames;
  const ICON = { easy: "🌱", medium: "⚡", hard: "👑" };
  const NPC = { science: "assets/sci_npc_guide.jpg", math: "assets/math_npc_guide.jpg" };
  const PRAISE = ["เยี่ยมมาก!", "ถูกต้อง!", "เก่งมาก!", "สุดยอด!", "แม่นมาก!"];
  const sfx = (n) => { try { window.SFX && window.SFX(n); } catch (e) { /* audio is optional */ } };
  const $app = document.getElementById("app"), $ = (id) => document.getElementById(id);
  const st = { be: null, student: null, stage: 0, prog: {}, view: "", band: null, items: [], i: 0, sel: null, checked: false, busy: false, err: "",
               key: "", t0: 0, correct: 0, last: null, log: [], nextBand: null, nextWasUnlocked: true };
  window.__game = st;                                           // read-only hook for tests

  // ---------- grading (สพฐ. 8 ระดับ, percent floored) ----------
  const pctOf = (score, total) => (total ? Math.floor((score * 100) / total + 1e-9) : 0);
  const grade = (pct) => G.gradeScale.find(([min]) => pct >= min)[1];
  window.__gradeOf = (s, t) => grade(pctOf(s, t));
  const fmtT = (sec) => { sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); };

  // ---------- helpers ----------
  const cfg = (i = st.stage) => G.stages[i];
  function setWorld(i) { st.stage = i; document.body.dataset.world = cfg(i).world; }
  function render(html, keepScroll) { $app.innerHTML = html; U.hydrate($app); if (!keepScroll) window.scrollTo(0, 0); }
  const soundBtn = () => { const m = window.SoundPref && window.SoundPref.muted;
    return `<button type="button" class="p6-sound" id="btn-sound" data-act="sound" aria-label="${m ? "เปิดเสียง" : "ปิดเสียง"}">${m ? "🔇" : "🔊"}</button>`; };
  const who = () => (st.student ? st.student.full_name + " · ป.6" : "ป.6");
  const foot = () => U.foot(`${G.sponsor} · ${G.disclaimer}`);
  const rpcMsg = (e) => { const m = B.errText(e);
    if (/band locked/.test(m)) return "ด่านนี้ยังล็อกอยู่ ต้องผ่านด่านก่อนหน้าก่อน";
    if (/not active|inactive/.test(m)) return "ชุดข้อสอบนี้ยังไม่เปิด (รอครูตรวจข้อสอบ)";
    if (/in order/.test(m)) return "ต้องตอบเรียงข้อ";
    return "เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง (" + m + ")"; };
  const tabs = (cur) => U.seg(G.stages.map((x, k) => [String(k), `${k + 1}. ${x.short}`]).concat([["final", "🏆 ผลรวม"]]), cur, "tab");
  const stageScore = (p) => { const done = p.bands.every((b) => b.last_score !== null && b.last_score !== undefined);
    const score = p.bands.reduce((a, b) => a + (b.last_score || 0), 0), total = p.bands.reduce((a, b) => a + b.size, 0); return { done, score, total }; };

  // ---------- stage map (3 level tiles) ----------
  async function openStage(i, opt = {}) {
    setWorld(i); st.view = "map";
    renderMap(i, null, { loading: true });
    const s = cfg(i); let p;
    try { p = st.prog[s.id] = await st.be.progress(s.id); }
    catch (e) { return renderMap(i, null, { error: rpcMsg(e) }); }
    if (p.active === false && st.be.mode !== "preview") return renderMap(i, null, { inactive: true });
    renderMap(i, p, opt);
    if (opt.unlock) sfx("unlock");
  }
  function renderMap(i, p, opt) {
    const s = cfg(i);
    const nPassed = p ? p.bands.filter((b) => b.passed).length : 0;
    let body;
    if (!p) body = opt.loading ? U.empty("กำลังโหลด…") : opt.inactive ? U.empty("ยังไม่เปิด", "ชุดข้อสอบนี้ยังไม่เปิด (รอครูตรวจข้อสอบ)", "", ) : U.empty("โหลดข้อมูลไม่สำเร็จ", opt.error || "", U.btn("ลองใหม่", { kind: "primary", act: "tab", arg: String(i) }));
    else {
      const tiles = p.bands.map((b) => {
        const locked = !b.unlocked, req = locked && p.bands.find((x) => x.band === b.requires);
        const sub = `ข้อ ${b.first}–${b.last} · ` + (locked ? `ต้องผ่าน${BN[b.requires]} ${req.pass_needed}/${req.size}` : b.plays ? `ล่าสุด ${b.last_score}/${b.size} · ดีที่สุด ${b.best}` : "ยังไม่เคยเล่น");
        const end = locked ? U.badge("ยังล็อก", "", "🔒") : b.passed ? U.badge("ผ่านแล้ว", "ok", "✓") : U.badge(b.plays ? "เล่นอีกครั้ง" : "เริ่มเล่น", "pink", "▶");
        const mod = (locked ? "eg-tile--locked" : b.passed ? "eg-tile--passed" : "") + (opt.unlock === b.band ? " p6-unlock" : "");
        return U.tile({ icon: ICON[b.band] || "•", title: `ระดับ ${b.ord} · ${BN[b.band]}`, sub, end, act: "band", arg: b.band, mod, test: "band-" + b.band,
          extra: { "data-band": b.band, "data-locked": String(locked) } });
      }).join("");
      const nxt = p.bands.find((b) => b.unlocked && b.plays === 0) || p.bands.filter((b) => b.unlocked).pop();
      const say = opt.say || (nxt ? `แตะ <b>${BN[nxt.band]}</b> เพื่อเริ่ม · ต้องได้อย่างน้อย ${nxt.pass_needed}/${nxt.size} จึงจะปลดล็อกระดับถัดไป` : "");
      const anyPlayed = p.bands.some((b) => b.plays);
      body = U.h2("เลือกระดับ", U.badge(`ผ่าน ${nPassed}/3`, nPassed === 3 ? "ok" : "pink", nPassed === 3 ? "✓" : null))
        + U.stack(tiles) + U.note(say, false, "map-say")
        + (anyPlayed ? U.tile({ icon: "≡", title: `สรุปผล${s.short}`, sub: "คะแนนรวม 30 ข้อ + ระดับผลการเรียน 8 ระดับ", act: "stagesum", arg: String(i), test: "stagesum" }) : "");
    }
    render(U.topbar({ title: G.title, sub: who(), actions: soundBtn() })
      + U.page(tabs(String(i))
        + U.hero({ title: s.title, img: NPC[s.world], sub: `ด่านที่ ${i + 1} · ${esc(s.short)} 30 ข้อ · ผ่านทีละระดับ<br>ไกด์: ${esc(s.npc)}`,
          extra: U.progLine(nPassed / 3 * 100, `ผ่าน ${nPassed}/3 ระดับ`) })
        + body + foot(), "p6-map"));
  }
  function lockedTap(band) {
    const p = st.prog[cfg().id], b = p.bands.find((x) => x.band === band), req = p.bands.find((x) => x.band === b.requires);
    sfx("wrong");
    const t = $app.querySelector(`[data-band="${band}"]`); if (t) { t.classList.remove("p6-shake"); void t.offsetWidth; t.classList.add("p6-shake"); }
    const say = $("map-say"); if (say) { say.classList.add("eg-note--warn"); say.innerHTML = `🔒 <b>${BN[b.band]}</b> ยังล็อกอยู่ — ต้องผ่าน<b>${BN[b.requires]}</b> ให้ได้อย่างน้อย ${req.pass_needed}/${req.size} ก่อนนะ`; }
  }

  // ---------- one question per screen ----------
  async function startBand(band) {
    const s = cfg(); let items;
    try { items = await st.be.bandItems(s.id, band); }
    catch (e) { const say = $("map-say"); if (say) { say.classList.add("eg-note--warn"); say.textContent = rpcMsg(e); } return; }
    const p = st.prog[s.id], bi = p.bands.find((b) => b.band === band), nx = p.bands.find((b) => b.requires === band);
    Object.assign(st, { items, band: bi, nextBand: nx || null, nextWasUnlocked: nx ? nx.unlocked : true, i: 0, correct: 0, log: [], sel: null, checked: false, busy: false, err: "", last: null,
      key: (band[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 40) });
    st.view = "q"; history.pushState({ p6: "q" }, ""); renderQ();
  }
  function renderQ(keep) {
    const it = st.items[st.i], s = cfg(), b = st.band, n = st.i + 1, done = st.i + (st.checked ? 1 : 0);
    if (!keep) st.t0 = performance.now();
    const meta = U.badge(`ข้อ ${it.position + 1}/30`, "pink", null, { id: "q-tag" }) + U.badge(`${BN[b.band]} ${n}/${b.size}`, "", ICON[b.band]) + U.badge(`ถูก ${st.correct}`, "ok", "✓", { id: "score" });
    let after = "";
    if (st.checked) {
      const r = st.last, ok = r.is_correct;
      after = U.explain(ok, r.explanation || [], ok ? `✓ ถูกต้อง · ${PRAISE[it.position % 5]}` : `✗ ยังไม่ถูก · คำตอบที่ถูก: ${L[r.answer_index]}`);
    }
    if (st.err) after += U.note(esc(st.err), true);
    const last = st.i + 1 >= st.items.length;
    const act = st.checked ? U.btn(last ? "ดูผลด่านนี้" : "ข้อต่อไป ›", { kind: "primary", act: "next", test: "next" })
      : U.btn(st.busy ? "กำลังตรวจ…" : "ตรวจคำตอบ", { kind: "primary", act: "check", disabled: st.sel == null || st.busy, test: "check" });
    render(U.topbar({ title: `${s.short} · ${BN[b.band]}`, sub: `ด่านที่ ${st.stage + 1} · ต้องได้ ${b.pass_needed}/${b.size} เพื่อผ่าน`, back: "quit", actions: soundBtn() })
      + U.page(U.progLine(done / b.size * 100, `${done}/${b.size}`)
        + U.card(U.question(it, { sel: st.sel, reveal: st.checked, key: st.checked ? st.last.answer_index : null, busy: st.busy, meta, after }))
        + `<div class="eg-sticky-bottom">${U.btns(act, true)}</div>`, "p6-q"), keep);
  }
  async function check() {
    if (st.busy || st.checked || st.sel == null) return;
    st.busy = true; st.err = ""; renderQ(true);
    const it = st.items[st.i], k = st.sel, ms = Math.round(performance.now() - st.t0); let r;
    try { r = await st.be.check(cfg().id, st.band.band, st.key, it.position, k, ms); }
    catch (e) { st.busy = false; st.err = rpcMsg(e); sfx("wrong"); return renderQ(true); }
    st.busy = false; st.checked = true; st.last = r; st.correct = r.correct;
    st.log.push({ it, sel: k, key: r.answer_index, ok: r.is_correct, ex: r.explanation || [], ms });
    sfx(r.is_correct ? "correct" : "wrong");
    renderQ(true);
    const fb = $("fb"); if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: "nearest" });
  }
  function next() {
    st.i++; st.sel = null; st.checked = false; st.err = "";
    if (st.i < st.items.length) return renderQ();
    bandDone();
  }

  // ---------- band result → unlock ----------
  async function bandDone() {
    const s = cfg(), b = st.band, r = st.last; st.view = "result";
    let p = st.prog[s.id]; try { p = st.prog[s.id] = await st.be.progress(s.id); } catch (e) { /* keep the cached state */ }
    const nx = st.nextBand && p.bands.find((x) => x.band === st.nextBand.band);
    const passed = r.correct >= b.pass_needed, pct = pctOf(r.correct, b.size);
    const stars = r.correct >= b.size ? 3 : r.correct >= Math.ceil(b.size * 0.85) ? 2 : passed ? 1 : 0;
    const secs = st.log.reduce((a, x) => a + x.ms, 0) / 1000;
    sfx(passed ? "result" : "tap");
    const msg = !nx ? "จบทั้ง 3 ระดับแล้ว ไปดูคะแนนรวมของด่านกัน"
      : passed ? `ผ่านแล้ว! (ต้องได้ ${b.pass_needed}/${b.size}) ${st.nextWasUnlocked ? "" : "ปลดล็อก<b>" + BN[nx.band] + "</b>ได้แล้ว 🎉"}`
      : `ยังไม่ผ่าน ต้องได้อย่างน้อย ${b.pass_needed}/${b.size} จึงจะปลดล็อก${BN[nx.band]} — ทบทวนเฉลยด้านล่างแล้วลองใหม่นะ`;
    let btns;
    if (!nx) btns = U.btn(`ดูสรุปผล${s.short} ›`, { kind: "primary", act: "stagesum", arg: String(st.stage), test: "to-stagesum" }) + U.btn(`เล่น${BN[b.band]}อีกครั้ง`, { kind: "ghost", act: "retry", test: "retry" });
    else if (passed) btns = U.btn(`${st.nextWasUnlocked ? "ไป" : "🔓 ปลดล็อก"}${BN[nx.band]} ›`, { kind: "primary", act: "unlock", test: "unlock" }) + U.btn("เล่นซ้ำ", { kind: "ghost", act: "retry", test: "retry" });
    else btns = U.btn("ลองใหม่อีกครั้ง", { kind: "primary", act: "retry", test: "retry" }) + U.btn("กลับแผนที่", { kind: "ghost", act: "map", test: "map" });
    const review = st.log.map((x) => U.card(U.question(x.it, { sel: x.sel, reveal: true, key: x.key,
      meta: U.badge(`ข้อ ${x.it.position + 1}`, "pink") + (x.ok ? U.badge("ถูก", "ok", "✓") : U.badge("ผิด", "no", "✗")),
      after: U.explain(x.ok, x.ex, x.ok ? "✓ ถูกต้อง" : `คำตอบที่ถูก: ${L[x.key]}`) }).replace(' id="q-card"', "").replace(' id="q-stem"', "").replace(' id="answers"', "").replace(' id="fb"', ""))).join("");
    render(U.topbar({ title: "ผลด่าน", sub: `${s.short} · ${BN[b.band]}`, back: "map", actions: soundBtn() })
      + U.page(U.card(U.score({ pct, title: `${r.correct}/${b.size} ข้อ`, pass: passed, passText: "ผ่านด่าน", failText: "ยังไม่ผ่าน", sub: `${esc(BN[b.band])} · ต้องได้ ${b.pass_needed}/${b.size}` })
          + `<div class="p6-stars" aria-label="${stars} ดาว">${[0, 1, 2].map((k) => `<span class="${k < stars ? "" : "off"}">⭐</span>`).join("")}</div>`
          + U.stats([[`${r.correct}/${b.size}`, "ข้อที่ถูก"], [fmtT(secs), "เวลาที่ใช้"], [`${b.first}–${b.last}`, "ข้อ"]])
          + U.note(msg, !passed && !!nx, "band-msg"), null, { "data-test": "result", id: "band-result", "data-passed": String(passed) })
        + U.btns(btns)
        + U.h2("เฉลยทีละข้อ") + review + foot()));
  }

  // ---------- stage + final summaries ----------
  async function stageSummary(i) {
    setWorld(i); st.view = "summary";
    const s = cfg(i); let p; try { p = st.prog[s.id] = await st.be.progress(s.id); } catch (e) { return U.toast(rpcMsg(e)); }
    const sc = stageScore(p), pct = pctOf(sc.score, sc.total);
    sfx("rankup");
    const rows = p.bands.map((b) => ({ _row: b.band, n: `${b.ord}. ${BN[b.band]}`, s: b.last_score == null ? "–" : `${b.last_score}/${b.size}`, best: b.best == null ? "–" : String(b.best), ok: b.passed }));
    const nextBtn = i + 1 < G.stages.length ? U.btn(`ไป${G.stages[i + 1].title} ›`, { kind: "primary", act: "tab", arg: String(i + 1), test: "next-stage" }) : U.btn("ดูผลรวม 2 วิชา ›", { kind: "primary", act: "tab", arg: "final", test: "to-final" });
    render(U.topbar({ title: `สรุปผล${s.short}`, sub: who(), back: "map", actions: soundBtn() })
      + U.page(U.card(U.score({ pct, title: `${sc.score}/${sc.total} คะแนน`, pass: sc.done && pct >= 50, passText: `ได้ระดับ ${grade(pct)}`, failText: sc.done ? `ได้ระดับ ${grade(pct)}` : "ยังเล่นไม่ครบ 3 ระดับ", sub: esc(s.title) })
          + `<div class="p6-grade"><b id="stage-grade">${sc.done ? grade(pct) : "–"}</b><span class="eg-sm">ระดับผลการเรียน (เกณฑ์ 8 ระดับ สพฐ.) · ร้อยละ ${pct}</span></div>`
          + U.table([{ k: "n", t: "ระดับ" }, { k: "s", t: "ล่าสุด", num: true }, { k: "best", t: "ดีที่สุด", num: true }, { t: "ผล", html: (r) => (r.ok ? U.badge("ผ่าน", "ok", "✓") : U.badge("ยังไม่ผ่าน", "", "–")) }], rows)
          + U.note("คะแนน = ผลล่าสุดของแต่ละระดับ · เกมฝึกทำข้อสอบ ไม่ใช่ผลสอบจริง"), null, { "data-test": "stage-summary", id: "stage-score", "data-score": sc.score })
        + U.btns(nextBtn + U.btn("กลับแผนที่", { kind: "ghost", act: "map", test: "map" })) + foot()));
  }
  async function finalSummary() {
    st.view = "final"; const rows = [];
    try { for (const s of G.stages) { const p = st.prog[s.id] = await st.be.progress(s.id); rows.push({ s, ...stageScore(p) }); } } catch (e) { return U.toast(rpcMsg(e)); }
    const tot = rows.reduce((a, r) => a + r.score, 0), totN = rows.reduce((a, r) => a + r.total, 0), all = rows.every((r) => r.done), pct = pctOf(tot, totN);
    sfx("result");
    const trs = rows.map((r, k) => ({ _row: String(k), n: r.s.short, sc: `${r.done ? r.score : "–"}/${r.total}`, pc: r.done ? String(pctOf(r.score, r.total)) : "–", gr: r.done ? grade(pctOf(r.score, r.total)) : "ยังเล่นไม่ครบ" }))
      .concat([{ _row: "total", n: "รวม", sc: `${all ? tot : "–"}/${totN}`, pc: all ? String(pct) : "–", gr: all ? grade(pct) : "–" }]);
    render(U.topbar({ title: "🏆 ผลรวม", sub: who(), back: "map", actions: soundBtn() })
      + U.page(tabs("final")
        + U.card(U.score({ pct: all ? pct : 0, title: all ? `${tot}/${totN} คะแนน` : "ยังเล่นไม่ครบ", pass: all && pct >= 50, passText: `ได้ระดับ ${grade(pct)}`, failText: all ? `ได้ระดับ ${grade(pct)}` : "เล่นให้ครบ 6 ระดับก่อน", sub: esc(G.title) })
          + U.table([{ k: "n", t: "วิชา" }, { k: "sc", t: "คะแนน", num: true }, { k: "pc", t: "ร้อยละ", num: true }, { t: "ระดับ", html: (r) => `<b>${esc(r.gr)}</b>` }], trs, "p6-final")
          + U.note(`ระดับผลการเรียน 8 ระดับ สพฐ. (80–100 = 4 … 0–49 = 0) · ใช้ผลล่าสุดของแต่ละระดับ · ไม่ใช่เกณฑ์สอบเข้าจริง`), null, { "data-test": "final", id: "final" })
        + U.btns(U.btn("เล่นอีกครั้ง", { kind: "primary", act: "tab", arg: "0", test: "again" }) + U.btn("กลับแผนที่", { kind: "ghost", act: "map", test: "map" })) + foot()));
  }

  // ---------- events (one delegated handler, like the ม.1–ม.6 app) ----------
  const inBand = () => st.view === "q" && (st.i > 0 || st.checked);
  const QUIT = "ออกจากด่านนี้? ข้อที่ตอบแล้วบันทึกไว้แล้ว แต่ถ้าออกตอนนี้ต้องเริ่มด่านนี้ใหม่ตั้งแต่ข้อแรก";
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
    const a = el.dataset.act, arg = el.dataset.arg;
    if (a === "sound") { const pref = window.SoundPref; if (!pref) return; pref.muted = !pref.muted;
      try { localStorage.setItem("kruomGameSound_v1", JSON.stringify(pref)); } catch (x) { /* private mode */ }
      el.textContent = pref.muted ? "🔇" : "🔊"; el.setAttribute("aria-label", pref.muted ? "เปิดเสียง" : "ปิดเสียง"); if (!pref.muted) sfx("tap"); return; }
    if (a === "choose") { if (st.checked || st.busy) return; st.sel = +arg; sfx("tap"); return renderQ(true); }
    if (a === "check") return check();
    if (a === "next") { sfx("tap"); return next(); }
    sfx("tap");
    if (a === "tab") return arg === "final" ? finalSummary() : openStage(+arg);
    if (a === "band") { const b = st.prog[cfg().id].bands.find((x) => x.band === arg); return b.unlocked ? startBand(arg) : lockedTap(arg); }
    if (a === "quit") { if (inBand() && !confirm(QUIT)) return; return openStage(st.stage); }
    if (a === "map") return openStage(st.stage);
    if (a === "retry") return startBand(st.band.band);
    if (a === "unlock") { const nx = st.nextBand; return openStage(st.stage, st.nextWasUnlocked ? {} : { unlock: nx.band, say: `🔓 ปลดล็อก<b>${BN[nx.band]}</b>แล้ว! แตะเพื่อเล่นต่อ (ข้อ ${nx.first}–${nx.last})` }); }
    if (a === "stagesum") return stageSummary(+arg);
  });
  // phone back button: leave the question screen to the map (asks first in the middle of a band)
  addEventListener("popstate", () => {
    if (st.view === "q") { if (inBand() && !confirm(QUIT)) { history.pushState({ p6: "q" }, ""); return; } return openStage(st.stage); }
    if (st.view === "result" || st.view === "summary" || st.view === "final") return openStage(st.stage);
  });

  // ---------- boot ----------
  (async function boot() {
    const mode = qs.get("mode") || "auto";
    try { st.be = await B.create(mode); const r = await st.be.init(); st.student = r.student; }
    catch (e) {
      const code = e && e.code, login = code === "login" || code === "nostudent";
      st.view = "login";
      return render(U.topbar({ title: G.title, sub: "โรงเรียนปิยมิตรวิทยา" })
        + U.page(U.hero({ title: G.title, img: NPC.science, sub: "ฝึกทำข้อสอบ ป.6 วิทยาศาสตร์ + คณิตศาสตร์ ทีละข้อ ผ่านทีละระดับ" })
          + U.card(login ? U.h2(code === "login" ? "เข้าสู่ระบบด้วย LINE ก่อนเริ่มเล่น" : "ยังไม่ได้ลงทะเบียนนักเรียน ป.6") + U.btn("เข้าสู่ระบบ / ลงทะเบียน", { kind: "primary", href: "../p6-line/", test: "login" })
            : U.h2("เชื่อมต่อไม่สำเร็จ") + U.p(rpcMsg(e)), null, { id: "center" }) + foot()));
    }
    const badge = st.be.mode === "preview" ? "PREVIEW · ไม่บันทึกผลในระบบ · มีเฉลยในหน้าเว็บ — สำหรับครูตรวจเท่านั้น"
      : st.be.mode === "legacy" ? "โหมดชั่วคราว (ใช้ฟังก์ชันเดิม) · ล็อกด่านตรวจที่หน้าเว็บ"
      : /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? "LOCAL TEST STACK" : "";
    if (badge) { $("mode-badge").textContent = badge; $("mode-badge").hidden = false; }
    document.body.dataset.mode = st.be.mode;
    openStage(0);
  })();
})();
