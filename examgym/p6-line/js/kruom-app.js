// kruom Exam Gym ป.6 — QR → LINE Login → (consent → school → grade) → exams.  Plain JS + supabase-js (UMD).
(function () {
  "use strict";
  const C = window.KRUOM_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = (v, max = 30) => (v && /^[A-Za-z0-9_-]+$/.test(v) && v.length <= max ? v : null);
  const SS = { get: (k) => { try { return JSON.parse(sessionStorage.getItem("kruom_" + k)); } catch { return null; } },
               set: (k, v) => sessionStorage.setItem("kruom_" + k, JSON.stringify(v)), del: (k) => sessionStorage.removeItem("kruom_" + k) };
  const LS = { get: (k) => localStorage.getItem("kruom_" + k), set: (k, v) => localStorage.setItem("kruom_" + k, v), del: (k) => localStorage.removeItem("kruom_" + k) };
  const ERR_TH = {
    line_access_denied: "ยกเลิกการเข้าสู่ระบบ LINE แล้ว — กดปุ่มอีกครั้งเมื่อพร้อม",
    state: "ลิงก์เข้าสู่ระบบหมดอายุหรือถูกใช้ไปแล้ว — กรุณากดเข้าสู่ระบบด้วย LINE อีกครั้ง",
    state_cookie: "เบราว์เซอร์สลับระหว่างทาง — กรุณาเปิดลิงก์ใหม่แล้วลองอีกครั้ง",
    not_configured: "ระบบยังตั้งค่า LINE Login ไม่เสร็จ (โรงเรียนกำลังดำเนินการ)",
    token: "เชื่อมต่อ LINE ไม่สำเร็จ ลองอีกครั้ง", id_token: "ตรวจสอบตัวตนกับ LINE ไม่สำเร็จ ลองอีกครั้ง",
    id_token_claims: "ตรวจสอบตัวตนกับ LINE ไม่สำเร็จ ลองอีกครั้ง", server: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
  };
  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || !C.LINE_AUTH_FUNCTION_URL) { document.body.innerHTML = "<p style='padding:20px'>ยังไม่ได้ตั้งค่า config.js</p>"; return; }
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "kruom-p6-auth" } });

  const st = { ctx: SS.get("ctx") || {}, line: SS.get("line") || {}, students: [], student: null, schools: [], school: null,
               grades: [], grade: null, consent: SS.get("consent") || null, exam: null, items: [], startedAt: 0 };
  function show(id) { document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id)); window.scrollTo(0, 0); document.body.dataset.screen = id; }
  function err(id, msg) { const e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function rpcMsg(e) { const m = (e && e.message) || String(e);
    if (/consent/.test(m)) return "ต้องได้รับความยินยอมจากผู้ปกครองก่อน"; if (/invalid name/.test(m)) return "กรุณากรอกชื่อ–นามสกุล (3–80 ตัวอักษร)";
    if (/phone|ID-card/.test(m)) return "ห้ามกรอกเลขบัตรประชาชนหรือเบอร์โทรศัพท์"; if (/school/.test(m)) return "กรุณาเลือก/กรอกชื่อโรงเรียน";
    if (/grade/.test(m)) return "ชั้นนี้ยังไม่เปิด"; return "เกิดข้อผิดพลาด: " + m; }

  // ---------- 0. read entry params (?school=&room=&exam=) and the callback fragment ----------
  function readEntry() {
    const q = new URLSearchParams(location.search);
    const fromQ = { school: clean(q.get("school")), room: clean(q.get("room")), exam: clean(q.get("exam"), 60) };
    if (fromQ.school || fromQ.room || fromQ.exam) { st.ctx = { ...st.ctx, ...Object.fromEntries(Object.entries(fromQ).filter(([, v]) => v)) }; SS.set("ctx", st.ctx); }
    const h = new URLSearchParams(location.hash.slice(1));
    const out = { th: h.get("kruom_th"), err: h.get("kruom_err") };
    if (out.th || out.err) {
      const fromH = { school: clean(h.get("school")), room: clean(h.get("room")), exam: clean(h.get("exam"), 60) };
      st.ctx = { ...st.ctx, ...Object.fromEntries(Object.entries(fromH).filter(([, v]) => v)) }; SS.set("ctx", st.ctx);
      if (out.th) { st.line = { name: h.get("name") || "", pic: (h.get("pic") || "").startsWith("https://") ? h.get("pic") : "", friend: h.get("friend") }; SS.set("line", st.line); }
      history.replaceState(null, "", location.pathname + location.search);   // one-time hash leaves the address bar
    }
    return out;
  }
  function loginUrl() {
    const u = new URL(C.LINE_AUTH_FUNCTION_URL.replace(/\/+$/, "") + "/login");
    for (const k of ["school", "room", "exam"]) if (st.ctx[k]) u.searchParams.set(k, st.ctx[k]);
    return u.toString();
  }
  async function loadSchools() {
    if (st.schools.length) return;
    const { data, error } = await sb.from("schools").select("code,slug,name_th,area_label,is_other,sort").order("sort");
    if (error) throw error; st.schools = data;
  }
  const findSchool = (key) => key && st.schools.find((s) => s.slug === key || s.code === key);

  // ---------- 1. landing ----------
  async function landing(errCode) {
    show("s-landing");
    try { await loadSchools(); } catch (_) {}
    const s = findSchool(st.ctx.school);
    $("landing-school").hidden = !s; if (s) $("landing-school").textContent = "🏫 " + s.name_th;
    err("landing-err", errCode ? (ERR_TH[errCode] || ERR_TH[errCode.startsWith("line_") ? "line_access_denied" : "server"]) : "");
  }
  $("btn-line").onclick = () => { $("btn-line").disabled = true; location.assign(loginUrl()); };

  // ---------- after sign-in: route ----------
  function renderWho() {
    const w = $("who"); w.hidden = false;
    w.innerHTML = (st.line.pic ? `<img src="${esc(st.line.pic)}" alt="" referrerpolicy="no-referrer">` : "") + `<span>${esc(st.line.name || "LINE")}</span>`;
  }
  async function route() {
    renderWho();
    const { data, error } = await sb.from("students").select("*").order("created_at");
    if (error) { err("landing-err", rpcMsg(error)); return show("s-landing"); }
    st.students = data;
    if (!st.line.name) { const li = await sb.from("line_identities").select("display_name,picture_url").maybeSingle();
      if (li.data) { st.line.name = li.data.display_name || ""; st.line.pic = st.line.pic || li.data.picture_url || ""; SS.set("line", st.line); renderWho(); } }
    if (!data.length) return startNew(true);
    const last = LS.get("last_student"); const one = data.length === 1 ? data[0] : data.find((s) => s.id === last);
    if (data.length === 1 || (one && st.ctx.exam)) { st.student = one; return exams(); }
    return pick();
  }

  // ---------- 2. consent ----------
  function startNew(first) {
    if (st.consent && st.consent.ok) return chooseSchool();
    $("consent-text").innerHTML = (window.KRUOM_CONSENT || {}).html || "";
    $("c-name").textContent = "บัญชี LINE: " + (st.line.name || ""); $("c-pic").hidden = !st.line.pic; if (st.line.pic) $("c-pic").src = st.line.pic;
    $("btn-consent-cancel").hidden = !first; err("consent-err", ""); show("s-consent");
  }
  document.querySelectorAll("input[name=holder]").forEach((r) => (r.onchange = () => ($("rel-box").hidden = r.value !== "guardian" || !r.checked)));
  $("btn-consent").onclick = () => {
    const holder = (document.querySelector("input[name=holder]:checked") || {}).value;
    const rel = (document.querySelector("input[name=rel]:checked") || {}).value || null;
    if (!holder) return err("consent-err", "กรุณาเลือกว่า LINE นี้เป็นของใคร");
    if (holder === "guardian" && !rel) return err("consent-err", "กรุณาเลือกความเกี่ยวข้องกับนักเรียน");
    if (!$("chk-consent").checked) return err("consent-err", "ต้องติ๊กยินยอมก่อนจึงจะใช้งานได้");
    st.consent = { ok: true, holder, rel: holder === "guardian" ? rel : null, push: $("chk-push").checked, version: (window.KRUOM_CONSENT || {}).version };
    SS.set("consent", st.consent); chooseSchool();
  };
  $("btn-consent-cancel").onclick = () => logout();

  // ---------- 3. school (skipped when the QR carried ?school=) ----------
  async function chooseSchool(force) {
    await loadSchools();
    const pre = findSchool(st.ctx.school);
    if (pre && !force) { st.school = pre; return chooseGrade(); }
    renderSchools(""); show("s-school"); $("school-q").value = ""; 
  }
  function renderSchools(q) {
    const t = q.trim(); let html = "", grp = null;
    for (const s of st.schools) {
      if (t && !s.name_th.includes(t) && !s.is_other) continue;
      if (s.area_label !== grp) { grp = s.area_label; html += `<div class="grp">${esc(grp)}</div>`; }
      html += `<button class="item" data-code="${esc(s.code)}">${esc(s.name_th)}</button>`;
    }
    $("school-list").innerHTML = html || "<p class='muted'>ไม่พบ — เลือก “อื่นๆ” แล้วพิมพ์ชื่อโรงเรียน</p>";
  }
  $("school-q").oninput = (e) => renderSchools(e.target.value);
  $("school-list").onclick = (e) => { const b = e.target.closest("[data-code]"); if (!b) return; st.school = st.schools.find((s) => s.code === b.dataset.code); chooseGrade(); };

  // ---------- 4. grade + name ----------
  async function chooseGrade() {
    if (!st.grades.length) { const { data } = await sb.from("grades").select("code,name_th,status,sort").order("sort"); st.grades = data || []; }
    $("grade-school").textContent = "🏫 " + st.school.name_th; $("other-box").hidden = !st.school.is_other;
    st.grade = st.grades.find((g) => g.code === "P6" && g.status === "live") ? "P6" : null;
    $("grade-list").innerHTML = st.grades.map((g) => `<button data-g="${esc(g.code)}" class="${g.code === st.grade ? "sel" : ""}" ${g.status === "live" ? "" : "disabled"}>${esc(g.name_th)}${g.status === "live" ? "" : "<br><small>เร็วๆ นี้</small>"}</button>`).join("");
    err("grade-err", ""); show("s-grade");
  }
  $("grade-list").onclick = (e) => { const b = e.target.closest("button[data-g]"); if (!b || b.disabled) return; st.grade = b.dataset.g;
    $("grade-list").querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b)); };
  $("btn-change-school").onclick = () => chooseSchool(true);
  $("btn-register").onclick = async () => {
    const name = $("full-name").value.trim();
    if (!st.grade) return err("grade-err", "กรุณาเลือกชั้น");
    if (name.length < 3) return err("grade-err", "กรุณากรอกชื่อ–นามสกุลนักเรียน");
    if (/\d{13}|0\d{8,9}/.test(name.replace(/[\s-]/g, ""))) return err("grade-err", "ห้ามกรอกเลขบัตรประชาชนหรือเบอร์โทรศัพท์");
    $("btn-register").disabled = true;
    const { data, error } = await sb.rpc("p6_register_student", {
      p_full_name: name, p_school_code: st.school.code, p_school_other: st.school.is_other ? $("school-other").value.trim() : null,
      p_grade_code: st.grade, p_account_holder: st.consent.holder, p_guardian_consent: true, p_guardian_relation: st.consent.rel,
      p_consent_push: !!st.consent.push, p_src: st.ctx.room || st.ctx.school || null, p_consent_version: st.consent.version });
    $("btn-register").disabled = false;
    if (error) return err("grade-err", rpcMsg(error));
    st.students.push(data); st.student = data; $("full-name").value = ""; exams();
  };

  // ---------- 5. learner picker (siblings) ----------
  function pick() {
    $("pick-list").innerHTML = st.students.map((s) => `<button class="item" data-id="${s.id}">${esc(s.full_name)}<small>${esc(s.school)} · ป.6</small></button>`).join("");
    show("s-pick");
  }
  $("pick-list").onclick = (e) => { const b = e.target.closest("[data-id]"); if (!b) return; st.student = st.students.find((s) => s.id === b.dataset.id); exams(); };
  $("btn-add-child").onclick = () => { st.ctx.school = st.ctx.school || null; startNew(false); };
  $("btn-switch").onclick = () => pick();

  // ---------- 6. exam list ----------
  async function exams() {
    LS.set("last_student", st.student.id);
    $("exams-student").textContent = "👤 " + st.student.full_name; $("btn-switch").hidden = st.students.length < 2;
    const { data, error } = await sb.from("exam_sets").select("id,name_th,n_items,minutes,kind,item_ids,pass_pct").eq("grade_code", st.student.grade_code).order("sort");
    if (error) { $("exam-list").innerHTML = `<div class="err">${esc(error.message)}</div>`; return show("s-exams"); }
    $("exam-list").innerHTML = data.length ? data.map((x) => `<button class="item" data-x="${esc(x.id)}">${esc(x.name_th)}<small>${x.n_items} ข้อ${x.minutes ? " · " + x.minutes + " นาที" : ""}</small></button>`).join("")
      : "<p class='muted'>ยังไม่มีชุดข้อสอบ</p>";
    st.sets = data;
    const h = await sb.from("attempts").select("exam_set_id,score_pct,n_correct,n_items,submitted_at").eq("student_id", st.student.id).order("submitted_at", { ascending: false }).limit(5);
    $("hist").innerHTML = (h.data || []).map((a) => `<div class="item">${esc((data.find((x) => x.id === a.exam_set_id) || {}).name_th || a.exam_set_id)}<small>${a.n_correct}/${a.n_items} · ${a.score_pct}% · ${new Date(a.submitted_at).toLocaleString("th-TH")}</small></div>`).join("") || "<p class='muted'>ยังไม่เคยสอบ</p>";
    show("s-exams");
    if (st.ctx.exam && data.find((x) => x.id === st.ctx.exam)) { const id = st.ctx.exam; st.ctx.exam = null; SS.set("ctx", st.ctx); openExam(id); }
  }
  $("exam-list").onclick = (e) => { const b = e.target.closest("[data-x]"); if (b) openExam(b.dataset.x); };

  // ---------- 7. exam ----------
  async function openExam(id) {
    st.exam = st.sets.find((x) => x.id === id);
    const ids = st.exam.item_ids || [];
    const { data, error } = await sb.from("items").select("id,stem,choices,media").in("id", ids);
    if (error) return alert(error.message);
    st.items = ids.map((i) => data.find((d) => d.id === i)).filter(Boolean);
    $("exam-title").textContent = st.exam.name_th; $("exam-meta").textContent = `${st.items.length} ข้อ · ผ่านเมื่อได้ ${st.exam.pass_pct}%`;
    $("exam-form").innerHTML = st.items.map((it, n) => `<div class="q"><div class="stem">${n + 1}. ${esc(it.stem)}</div>` +
      it.choices.map((c, k) => `<label><input type="radio" name="q${n}" value="${k}"> ${"กขคงจ"[k]}. ${esc(c)}</label>`).join("") + "</div>").join("");
    err("exam-err", ""); st.startedAt = Date.now(); show("s-exam");
  }
  $("btn-exam-back").onclick = () => exams();
  $("btn-submit").onclick = async () => {
    const ans = st.items.map((it, n) => { const v = (document.querySelector(`input[name=q${n}]:checked`) || {}).value;
      return { item_id: it.id, position: n, choice_index: v === undefined ? null : +v }; });
    const blank = ans.filter((a) => a.choice_index === null).length;
    if (blank && !confirm(`ยังไม่ได้ตอบ ${blank} ข้อ ส่งเลยไหม?`)) return;
    $("btn-submit").disabled = true;
    const { data, error } = await sb.rpc("p6_record_attempt", { p: {
      student_id: st.student.id, grade_code: st.student.grade_code, kind: st.exam.kind, exam_set_id: st.exam.id,
      client_attempt_id: "w-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      started_at: new Date(st.startedAt).toISOString(), duration_s: Math.round((Date.now() - st.startedAt) / 1000),
      meta: { room: st.ctx.room || null, entry_school: st.ctx.school || null }, answers: ans } });
    $("btn-submit").disabled = false;
    if (error) return err("exam-err", rpcMsg(error));
    result(data);
  };

  // ---------- 8. result + review ----------
  async function result(a) {
    $("result-box").innerHTML = `<span class="${a.passed ? "ok" : "no"}">${a.n_correct}/${a.n_items}</span><div class="small">${a.score_pct}% · ${a.passed ? "ผ่าน 🎉" : "ยังไม่ผ่าน ลองอีกครั้ง"}</div>`;
    const { data } = await sb.rpc("p6_attempt_review", { p_attempt_id: a.id });
    $("review").innerHTML = (data || []).map((r) => { const it = st.items.find((i) => i.id === r.item_id) || { stem: r.item_id, choices: [] };
      return `<div class="item"><b>${r.position + 1}. ${esc(it.stem)}</b><small class="${r.is_correct ? "ok" : "no"}">${r.is_correct ? "✔ ถูก" : "✘ ผิด"} · เฉลย: ${esc(it.choices[r.answer_keys[0]] ?? "")}</small>` +
        (Array.isArray(r.explanation) && r.explanation.length ? `<small>${esc(r.explanation.join(" "))}</small>` : "") + "</div>"; }).join("");
    show("s-result");
  }
  $("btn-result-back").onclick = () => exams();

  // ---------- 9. my data / PDPA ----------
  $("btn-settings").onclick = async () => {
    const li = await sb.from("line_identities").select("display_name,consent_push,is_friend,created_at").maybeSingle();
    const d = li.data || {};
    $("me-box").innerHTML = `<div class="item">บัญชี LINE: ${esc(d.display_name || "")}<small>เป็นเพื่อนกับ OA ${esc(C.LINE_OA_ID || "")}: ${d.is_friend === true ? "ใช่" : d.is_friend === false ? "ไม่ใช่" : "ไม่ทราบ"}</small></div>` +
      st.students.map((s) => `<div class="item">${esc(s.full_name)}<small>${esc(s.school)} · ป.6 · ยินยอมเมื่อ ${new Date(s.consent_at).toLocaleString("th-TH")} (${esc(s.consent_version)})</small></div>`).join("");
    $("set-push").checked = !!d.consent_push; $("set-msg").textContent = ""; show("s-settings");
  };
  $("set-push").onchange = async (e) => { const { error } = await sb.rpc("p6_set_push_consent", { p_consent: e.target.checked }); $("set-msg").textContent = error ? rpcMsg(error) : "บันทึกแล้ว"; };
  $("btn-settings-back").onclick = () => exams();
  $("btn-del-one").onclick = async () => {
    if (!confirm(`ลบข้อมูลและผลสอบทั้งหมดของ ${st.student.full_name}?`)) return;
    const { error } = await sb.rpc("p6_delete_my_data", { p_student_id: st.student.id });
    if (error) return ($("set-msg").textContent = rpcMsg(error));
    st.students = st.students.filter((s) => s.id !== st.student.id); st.student = null; LS.del("last_student"); route();
  };
  $("btn-del-all").onclick = async () => {
    if (!confirm("ลบข้อมูลทั้งหมดของบัญชี LINE นี้ (ทุกคน ทุกผลสอบ) และลบบัญชี? ทำย้อนกลับไม่ได้")) return;
    const { data: s } = await sb.auth.getSession();
    await sb.rpc("p6_delete_my_data", { p_student_id: null });
    const r = await fetch(C.LINE_AUTH_FUNCTION_URL.replace(/\/+$/, "") + "/delete", { method: "POST", headers: { authorization: "Bearer " + s.session.access_token } });
    $("set-msg").textContent = r.ok ? "ลบเรียบร้อย" : "ลบข้อมูลแล้ว แต่ลบบัญชีไม่สำเร็จ (แจ้งโรงเรียน)";
    await logout(true);
  };
  $("btn-logout").onclick = () => logout();
  async function logout(keepMsg) {
    await sb.auth.signOut().catch(() => {});
    ["line", "consent"].forEach(SS.del); LS.del("last_student");
    st.students = []; st.student = null; st.consent = null; $("who").hidden = true; await landing(); if (keepMsg) err("landing-err", "ลบข้อมูลเรียบร้อยแล้ว");
  }

  // ---------- boot ----------
  (async function boot() {
    const e = readEntry();
    if (e.th) {
      const { error } = await sb.auth.verifyOtp({ token_hash: e.th, type: "email" });
      if (error) return landing("state");
    }
    const { data } = await sb.auth.getSession();
    if (data.session) return route();
    landing(e.err);
  })();
  window.kruomDebug = { st };
})();
