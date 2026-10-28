// ปิยมิตร ป.6 ฝ่าด่านจุฬาภรณ์ — stage game. World 1 science → World 2 math; each stage = 3 bands of 10 that unlock in order.
(function () {
  "use strict";
  const G = window.GAME_CONFIG, B = window.P6Backend, $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const FAST = qs.get("fast") === "1";                         // test hook: shorter feedback delays
  const T = FAST ? { correctMs: 150, wrongMinMs: 900, wrongPerCharMs: 0, wrongMaxMs: 900 } : G.timing;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const L = "กขคงจ", BN = G.bandNames;
  const sfx = (n) => { try { window.SFX && window.SFX(n); } catch (e) { /* audio is optional */ } };
  const st = { be: null, student: null, stage: 0, prog: {}, band: null, items: [], i: 0, key: "", t0: 0, busy: false, correct: 0, last: null, advance: null };
  window.__game = st;                                           // read-only hook for tests

  // ---------- 844×390 stage, letterboxed ----------
  const screen = $("screen");
  const fit = () => { const k = Math.min(innerWidth / 844, innerHeight / 390); screen.style.transform = `translate(${(innerWidth - 844 * k) / 2}px,${(innerHeight - 390 * k) / 2}px) scale(${k})`; };
  fit(); addEventListener("resize", fit);

  // ---------- grading (สพฐ. 8 ระดับ) ----------
  const pctOf = (score, total) => (total ? Math.floor((score * 100) / total + 1e-9) : 0);
  const grade = (pct) => G.gradeScale.find(([min]) => pct >= min)[1];
  window.__gradeOf = (s, t) => grade(pctOf(s, t));

  // shrink text until it fits its box
  function shrink(el, max, min) { let f = max; el.style.fontSize = f + "px"; while (f > min && el.scrollHeight > el.clientHeight + 1) { f -= 0.5; el.style.fontSize = f + "px"; } }

  const later = (f, ms) => setTimeout(function w() { if (st.hold) return setTimeout(w, 50); f(); }, ms);   // st.hold: test hook
  function show(view) { document.body.dataset.view = view; ["v-map", "v-q"].forEach((v) => ($(v).hidden = v !== view)); $("chip-prog").hidden = $("chip-band").hidden = $("chip-score").hidden = view !== "v-q"; }
  function dlg(html) { $("dim").hidden = false; $("dlg").innerHTML = html; $("dlg").hidden = false; }
  function closeDlg() { $("dim").hidden = true; $("dlg").hidden = true; }
  function center(html) { $("center-box").innerHTML = html; $("center").hidden = false; $("dim").hidden = false; }
  function stageCfg(i = st.stage) { return G.stages[i]; }
  function setWorld(i) {
    const s = stageCfg(i); st.stage = i;
    document.body.dataset.world = s.world; screen.classList.toggle("math", s.world === "math");
    $("bg").style.backgroundImage = `url(${s.bg})`; $("stage-title").textContent = s.title;
    $("map-npc").textContent = $("q-npc-name").textContent = s.npc;
  }
  const rpcMsg = (e) => { const m = B.errText(e);
    if (/band locked/.test(m)) return "ด่านนี้ยังล็อกอยู่ ต้องผ่านด่านก่อนหน้าก่อน";
    if (/not active|inactive/.test(m)) return "ชุดข้อสอบนี้ยังไม่เปิด (รอครูตรวจข้อสอบ)";
    if (/in order/.test(m)) return "ต้องตอบเรียงข้อ";
    return "เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง (" + m + ")"; };

  // ---------- stage map ----------
  async function openStage(i, opt = {}) {
    closeDlg(); setWorld(i); show("v-map");
    const s = stageCfg(i);
    $("stage-sub").textContent = `ด่านที่ ${i + 1} · ${s.short} 30 ข้อ · ผ่านทีละระดับ`;
    $("worldtabs").innerHTML = G.stages.map((x, k) => `<button data-st="${k}" class="${k === i ? "on" : ""}">${k + 1}. ${esc(x.short)}</button>`).join("") +
      `<button data-final="1">🏆 ผลรวม</button>`;
    $("worldtabs").querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { sfx("tap"); openStage(+b.dataset.st); }));
    $("worldtabs").querySelector("[data-final]").onclick = () => { sfx("tap"); finalSummary(); };
    let p;
    try { p = st.prog[s.id] = await st.be.progress(s.id); }
    catch (e) { return center(`<h1>${esc(s.title)}</h1><p>${esc(rpcMsg(e))}</p><div class="row" style="margin-top:12px"><button class="btn sec" id="c-back">กลับ</button></div>`), ($("c-back").onclick = () => { $("center").hidden = true; $("dim").hidden = true; if (i > 0) openStage(0); }); }
    if (p.active === false && st.be.mode !== "preview") return center(`<h1>${esc(s.title)}</h1><p>ชุดข้อสอบนี้ยังไม่เปิด (รอครูตรวจข้อสอบ)</p>`);
    renderTiles(p, opt.unlock);
    const nxt = p.bands.find((b) => b.unlocked && b.plays === 0) || p.bands.filter((b) => b.unlocked).pop();
    $("map-say").innerHTML = opt.say || (nxt ? `แตะ <b>${BN[nxt.band]}</b> เพื่อเริ่ม · ต้องได้อย่างน้อย ${nxt.pass_needed}/${nxt.size} จึงจะปลดล็อกระดับถัดไป` : "");
    if (opt.unlock) { sfx("unlock"); }
  }
  function renderTiles(p, unlockBand) {
    $("tiles").innerHTML = p.bands.map((b) => {
      const anim = b.band === unlockBand && b.unlocked;
      const locked = !b.unlocked || anim;
      const status = !b.unlocked ? `ต้องผ่าน${BN[b.requires]} ${p.bands.find((x) => x.band === b.requires).pass_needed}/10` :
        b.plays ? `ล่าสุด ${b.last_score}/${b.size} · ดีที่สุด ${b.best}` + (b.passed ? " ✓" : "") : "ยังไม่เคยเล่น";
      return `<button class="tile ${locked ? "locked" : ""} ${b.passed ? "passed" : ""} ${anim ? "unlocking" : ""}" data-band="${b.band}" data-locked="${!b.unlocked}">
        <span class="lvl">ระดับ ${b.ord}</span><span class="nm">${BN[b.band]}</span><span class="rng">ข้อ ${b.first}–${b.last}</span>
        <span class="ic">${b.band === "easy" ? "🌱" : b.band === "medium" ? "⚡" : "👑"}</span>
        <span class="st">${esc(status)}</span><span class="go">${b.plays ? "เล่นอีกครั้ง" : "เริ่ม ›"}</span>
        ${locked ? '<span class="lockbig">🔒</span>' : ""}${anim ? '<span class="sparkle"></span>' : ""}</button>`; }).join("");
    if (unlockBand) setTimeout(() => { const t = $("tiles").querySelector(`[data-band="${unlockBand}"]`); if (t) { t.classList.remove("locked", "unlocking"); const l = t.querySelector(".lockbig"); l && l.remove(); t.dataset.unlocked = "1"; } }, 1300);
    $("tiles").querySelectorAll(".tile").forEach((t) => (t.onclick = () => {
      const b = p.bands.find((x) => x.band === t.dataset.band);
      if (!b.unlocked) { sfx("wrong"); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
        $("map-say").innerHTML = `🔒 <b>${BN[b.band]}</b> ยังล็อกอยู่ — ต้องผ่าน<b>${BN[b.requires]}</b> ให้ได้อย่างน้อย ${p.bands.find((x) => x.band === b.requires).pass_needed}/10 ก่อนนะ`; return; }
      sfx("tap"); startBand(b.band);
    }));
  }

  // ---------- continuous play inside a band ----------
  async function startBand(band) {
    const s = stageCfg();
    try { st.items = await st.be.bandItems(s.id, band); } catch (e) { $("map-say").textContent = rpcMsg(e); return; }
    const p = st.prog[s.id]; const bi = p.bands.find((b) => b.band === band); const nx = p.bands.find((b) => b.requires === band);
    st.band = bi; st.nextWasUnlocked = nx ? nx.unlocked : true; st.nextBand = nx || null;
    st.i = 0; st.correct = 0; st.key = (band[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 40);
    show("v-q"); renderQ();
  }
  function renderQ() { screen.querySelectorAll(".praise").forEach((e) => e.remove());
    const it = st.items[st.i], s = stageCfg(), b = st.band, n = st.i + 1;
    st.busy = false; st.t0 = performance.now();
    $("stage-sub").textContent = `${BN[b.band]} · ข้อ ${n}/${b.size} · ต้องได้ ${b.pass_needed} ข้อขึ้นไปเพื่อผ่าน`;
    $("prog-txt").textContent = `ข้อ ${it.position + 1}/30`; $("prog-bar").style.width = ((it.position + 1) / 30) * 100 + "%";
    $("chip-band").textContent = `${BN[b.band]} ${n}/${b.size}`; $("score-txt").textContent = st.correct;
    $("q-tag").textContent = `${s.short} ข้อ ${it.position + 1}`; $("q-meta").textContent = "";
    $("speech").dataset.pos = it.position; $("speech").dataset.item = it.item_id;
    $("q-stem").textContent = it.stem; $("fb").innerHTML = "";
    const long = it.choices.some((c) => String(c).length > 22);
    const a = $("answers"); a.classList.toggle("one", long);
    a.innerHTML = it.choices.map((c, k) => `<button class="ans" data-k="${k}"><b>${L[k]}</b><span>${esc(c)}</span></button>`).join("");
    a.querySelectorAll(".ans").forEach((x) => (x.onclick = () => answer(+x.dataset.k)));
    requestAnimationFrame(() => { $("q-stem").style.maxHeight = "100%"; shrink($("q-stem"), 17, 12.5); a.querySelectorAll(".ans").forEach((x) => shrink(x, long ? 14 : 15, 10.5)); });
  }
  async function answer(k) {
    if (st.busy) return; st.busy = true;
    const it = st.items[st.i], btns = [...$("answers").querySelectorAll(".ans")];
    btns[k].classList.add("wait");
    let r;
    try { r = await st.be.check(stageCfg().id, st.band.band, st.key, it.position, k, Math.round(performance.now() - st.t0)); }
    catch (e) { btns[k].classList.remove("wait"); st.busy = false; $("fb").innerHTML = `<div class="fb bad">${esc(rpcMsg(e))}</div>`; return; }
    st.last = r; btns.forEach((x) => x.classList.remove("wait"));
    if (r.is_correct) {
      st.correct = r.correct; $("score-txt").textContent = r.correct;
      btns[k].classList.add("ok"); btns.forEach((x, j) => j !== k && x.classList.add("dim")); sfx("correct");
      const pr = ["เยี่ยมมาก!", "ถูกต้อง!", "เก่งมาก!", "สุดยอด!", "แม่นมาก!"][it.position % 5];
      const el = document.createElement("div"); el.className = "praise"; el.textContent = "✨ " + pr + " +1"; screen.appendChild(el); setTimeout(() => el.remove(), 950);
      $("fb").innerHTML = `<div class="fb good">✔ ${pr}</div>`;
      later(next, T.correctMs);
    } else {
      st.correct = r.correct; $("score-txt").textContent = r.correct;
      btns[k].classList.add("bad"); btns[r.answer_index].classList.add("ok"); btns.forEach((x, j) => j !== k && j !== r.answer_index && x.classList.add("dim")); sfx("wrong");
      const ex = (r.explanation || []).join(" ");
      const ms = Math.min(T.wrongMaxMs, Math.max(T.wrongMinMs, T.wrongMinMs + Math.max(0, ex.length - 60) * T.wrongPerCharMs));
      $("fb").innerHTML = `<div class="fb bad" id="fb-wrong"><div class="ans-line">คำตอบที่ถูก: ${L[r.answer_index]}. ${esc(it.choices[r.answer_index])}</div>` +
        `<div class="why">💡 ${esc(ex)}</div><div class="tapnext">แตะเพื่อไปต่อ ›<i style="--dur:${ms}ms"></i></div></div>`;
      shrink($("fb").firstChild, 13, 10.5); shrink($("q-stem"), parseFloat($("q-stem").style.fontSize) || 15, 11);
      let done = false; const go = () => { if (done) return; done = true; clearTimeout(tm); screen.removeEventListener("pointerdown", tap, true); next(); };
      const tap = (e) => { if (e.target.closest && e.target.closest("#btn-sound,#btn-back")) return; e.stopPropagation(); go(); };
      const tm = later(go, ms); setTimeout(() => screen.addEventListener("pointerdown", tap, true), 250);
    }
  }
  function next() {
    st.i++;
    if (st.i < st.items.length) return renderQ();
    bandDone();
  }

  // ---------- band summary → unlock ----------
  async function bandDone() {
    const s = stageCfg(), b = st.band, r = st.last;
    const p = st.prog[s.id] = await st.be.progress(s.id);
    const nx = st.nextBand && p.bands.find((x) => x.band === st.nextBand.band);
    const passed = r.correct >= b.pass_needed;
    const stars = r.correct >= b.size ? 3 : r.correct >= Math.ceil(b.size * 0.85) ? 2 : passed ? 1 : 0;
    sfx(passed ? "result" : "tap");
    let btns;
    if (!nx) btns = `<button class="btn" id="d-sum">ดูสรุปผล${esc(s.short)} ›</button><button class="btn sec" id="d-retry">เล่น${BN[b.band]}อีกครั้ง</button>`;
    else if (passed) btns = `<button class="btn" id="d-unlock">${st.nextWasUnlocked ? "ไป" : "🔓 ปลดล็อก"}${BN[nx.band]} ›</button><button class="btn sec" id="d-retry">เล่นซ้ำ</button>`;
    else btns = `<button class="btn" id="d-retry">ลองใหม่อีกครั้ง</button><button class="btn sec" id="d-map">กลับแผนที่</button>`;
    dlg(`<h2>${BN[b.band]} จบแล้ว!</h2>
      <div class="big ${passed ? "ok" : "no"}" id="band-score">${r.correct}<small>/${b.size}</small></div>
      <div class="stars">${[0, 1, 2].map((k) => `<span class="${k < stars ? "" : "off"}">⭐</span>`).join("")}</div>
      <p id="band-msg">${!nx ? "จบทั้ง 3 ระดับแล้ว ไปดูคะแนนรวมของด่านกัน" : passed ? `ผ่านแล้ว! (ต้องได้ ${b.pass_needed}/${b.size}) ${st.nextWasUnlocked ? "" : "ปลดล็อก<b>" + BN[nx.band] + "</b>ได้แล้ว 🎉"}` : `ยังไม่ผ่าน ต้องได้อย่างน้อย ${b.pass_needed}/${b.size} จึงจะปลดล็อก${BN[nx.band]} — ทบทวนแล้วลองใหม่นะ`}</p>
      <div class="row">${btns}</div>`);
    const on = (id, f) => $(id) && ($(id).onclick = () => { sfx("tap"); f(); });
    on("d-retry", () => { closeDlg(); startBand(b.band); });
    on("d-map", () => openStage(st.stage));
    on("d-sum", () => stageSummary(st.stage));
    on("d-unlock", () => openStage(st.stage, st.nextWasUnlocked ? {} : { unlock: nx.band, say: `🔓 ปลดล็อก<b>${BN[nx.band]}</b>แล้ว! แตะเพื่อเล่นต่อ (ข้อ ${nx.first}–${nx.last})` }));
  }

  // ---------- stage + final summaries ----------
  const stageScore = (p) => { const done = p.bands.every((b) => b.last_score !== null && b.last_score !== undefined);
    const score = p.bands.reduce((a, b) => a + (b.last_score || 0), 0), total = p.bands.reduce((a, b) => a + b.size, 0); return { done, score, total }; };
  async function stageSummary(i) {
    const s = stageCfg(i); const p = st.prog[s.id] = await st.be.progress(s.id); const sc = stageScore(p); const pct = pctOf(sc.score, sc.total);
    sfx("rankup");
    dlg(`<h2>สรุปผล${esc(s.title)}</h2>
      <div class="big" id="stage-score">${sc.score}<small>/${sc.total}</small></div>
      <div class="bandrow">${p.bands.map((b) => `<div>${BN[b.band]} ${b.last_score ?? "–"}/${b.size}</div>`).join("")}</div>
      <div class="gradebox"><b id="stage-grade">${grade(pct)}</b><span>ระดับผลการเรียน (เกณฑ์ 8 ระดับ สพฐ.)<br>ร้อยละ ${pct}</span></div>
      <p class="note">คะแนน = ผลล่าสุดของแต่ละระดับ · เกมฝึกทำข้อสอบ ไม่ใช่ผลสอบจริง</p>
      <div class="row">${i + 1 < G.stages.length ? `<button class="btn" id="d-next">ไป${esc(G.stages[i + 1].title)} ›</button>` : `<button class="btn" id="d-final">ดูผลรวม 2 วิชา ›</button>`}<button class="btn sec" id="d-map">กลับแผนที่</button></div>`);
    $("d-map").onclick = () => openStage(i);
    if ($("d-next")) $("d-next").onclick = () => { sfx("tap"); openStage(i + 1); };
    if ($("d-final")) $("d-final").onclick = () => { sfx("tap"); finalSummary(); };
  }
  async function finalSummary() {
    const rows = []; for (const s of G.stages) { const p = st.prog[s.id] = await st.be.progress(s.id); rows.push({ s, ...stageScore(p) }); }
    const tot = rows.reduce((a, r) => a + r.score, 0), totN = rows.reduce((a, r) => a + r.total, 0), all = rows.every((r) => r.done);
    sfx("result");
    dlg(`<h2>🏆 ผลรวม ${esc(G.title)}</h2>
      <table class="final"><tr><th>วิชา</th><th>คะแนน</th><th>ร้อยละ</th><th>ระดับ</th></tr>
      ${rows.map((r, k) => `<tr data-row="${k}"><td>${esc(r.s.short)}</td><td class="sc">${r.done ? r.score : "–"}/${r.total}</td><td>${r.done ? pctOf(r.score, r.total) : "–"}</td><td class="gr">${r.done ? grade(pctOf(r.score, r.total)) : "ยังเล่นไม่ครบ"}</td></tr>`).join("")}
      <tr class="tot" data-row="total"><td>รวม</td><td class="sc">${all ? tot : "–"}/${totN}</td><td>${all ? pctOf(tot, totN) : "–"}</td><td class="gr">${all ? grade(pctOf(tot, totN)) : "–"}</td></tr></table>
      <p class="note">ระดับผลการเรียน 8 ระดับ สพฐ. (80–100 = 4 … 0–49 = 0) · ใช้ผลล่าสุดของแต่ละระดับ · ไม่ใช่เกณฑ์สอบเข้าจริง · ${esc(G.disclaimer)}</p>
      <div class="row"><button class="btn" id="d-again">เล่นอีกครั้ง</button><button class="btn sec" id="d-map">กลับแผนที่</button></div>`);
    $("d-again").onclick = () => { sfx("tap"); openStage(0); };
    $("d-map").onclick = () => openStage(st.stage);
  }

  $("btn-back").onclick = () => { sfx("tap"); openStage(st.stage); };

  // ---------- boot ----------
  (async function boot() {
    const mode = qs.get("mode") || "auto";
    try {
      st.be = await B.create(mode);
      const r = await st.be.init(); st.student = r.student;
    } catch (e) {
      const code = e && e.code;
      const loginUrl = "../p6-line/";
      return center(`<h1 class="title-glow">${esc(G.title)}</h1>` + (code === "login" || code === "nostudent"
        ? `<p>${code === "login" ? "เข้าสู่ระบบด้วย LINE ก่อนเริ่มเล่น" : "ยังไม่ได้ลงทะเบียนนักเรียน ป.6"}</p><div class="row" style="margin-top:14px;justify-content:center;display:flex"><a class="btn" href="${loginUrl}">เข้าสู่ระบบ / ลงทะเบียน</a></div>`
        : `<p>${esc(rpcMsg(e))}</p>`) + `<p class="note">${esc(G.disclaimer)}</p>`);
    }
    $("who").textContent = st.student.full_name;
    const badge = st.be.mode === "preview" ? "PREVIEW · ไม่บันทึกผลในระบบ · มีเฉลยในหน้าเว็บ — สำหรับครูตรวจเท่านั้น"
      : st.be.mode === "legacy" ? "โหมดชั่วคราว (ใช้ฟังก์ชันเดิม) · ล็อกด่านตรวจที่หน้าเว็บ"
      : /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? "LOCAL TEST STACK" : "";
    if (badge) { $("mode-badge").textContent = badge; $("mode-badge").hidden = false; }
    document.body.dataset.mode = st.be.mode;
    openStage(0);
  })();
})();
