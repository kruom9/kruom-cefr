// Back ends for the stage game. All three expose the same API:
//   init() → { student }            progress(setId) → { active, bands:[{band,ord,first,last,size,requires,pass_needed,unlocked,passed,best,last_score,plays}] }
//   bandItems(setId, band) → [{position,item_id,stem,choices,strand_id,level}]
//   check(setId, band, attemptKey, position, choice, timeMs) → { is_correct, answer_index, explanation[], answered, correct, size, band_done, band_passed }
// "rpc"     — server gate (pending migration 20261028170000_kruom_p6_stage_band_gate.sql): unlock + keys + scoring server-side.
// "legacy"  — only functions that exist in the cloud today: one p6_record_attempt per question (server-scored) +
//             p6_attempt_review for that question's key; unlock computed in the page from the student's own attempts.
// "preview" — director preview, no login, items from preview/p6_stage_preview.js (contains keys), progress in localStorage.
(function () {
  "use strict";
  const G = window.GAME_CONFIG;
  const BANDS_FALLBACK = [{ band: "easy", items: [1, 10] }, { band: "medium", items: [11, 20], requires: "easy" }, { band: "hard", items: [21, 30], requires: "medium" }];
  function layout(rule) {            // unlock_rule → band list (same rules as p6_private.p6_stage_bands)
    rule = rule || {};
    const src = Array.isArray(rule.bands) ? rule.bands : BANDS_FALLBACK;
    const out = src.map((b, i) => ({ band: b.band, ord: i + 1, first: b.items[0], last: b.items[1], size: b.items[1] - b.items[0] + 1, requires: b.requires || null, own: b.pass }));
    out.forEach((b) => { const nx = src.find((x) => x.requires === b.band);
      b.pass_needed = (nx && nx.pass) || b.own || Math.ceil(b.size * (rule.mastery_pct || 70) / 100) || G.bandPass; delete b.own; });
    return { bands: out, sequential: rule.sequential !== false };
  }
  // runs = [{band, answered, correct, at}] (complete or not) → band states
  function unlockFrom(lay, runs) {
    const st = lay.bands.map((b) => { const done = runs.filter((r) => r.band === b.band && r.answered >= b.size).sort((x, y) => (x.at < y.at ? -1 : 1));
      return { ...b, plays: done.length, best: done.length ? Math.max(...done.map((r) => r.correct)) : null,
               last_score: done.length ? done[done.length - 1].correct : null, passed: done.some((r) => r.correct >= b.pass_needed) }; });
    st.forEach((b) => { b.unlocked = !b.requires || !lay.sequential || !!(st.find((x) => x.band === b.requires) || {}).passed; });
    return st;
  }
  const errText = (e) => (e && (e.message || e.details)) || String(e);

  // ---------------------------------------------------------------- preview
  function Preview() {
    const P = window.P6_PREVIEW, KEY = "kruomP6GamePreview_v1";
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { runs: {} }; } catch { return { runs: {} }; } };
    const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
    return {
      mode: "preview",
      async init() { if (!P) throw new Error("preview data missing"); return { student: { id: "preview", full_name: "โหมดพรีวิว (ครู/ผู้อำนวยการ)" } }; },
      reset() { localStorage.removeItem(KEY); },
      async progress(setId) { const s = P.sets[setId], lay = layout(s.unlock_rule), runs = Object.values(load().runs).filter((r) => r.set === setId);
        return { active: true, bands: unlockFrom(lay, runs) }; },
      async bandItems(setId, band) { const s = P.sets[setId], b = layout(s.unlock_rule).bands.find((x) => x.band === band);
        const pr = await this.progress(setId); if (!pr.bands.find((x) => x.band === band).unlocked) throw new Error("band locked");
        return s.item_ids.slice(b.first - 1, b.last).map((id, i) => { const it = P.items[id]; return { position: b.first - 1 + i, item_id: id, stem: it.stem, choices: it.choices, strand_id: it.strand_id, level: it.level }; }); },
      async check(setId, band, key, position, choice) {
        const s = P.sets[setId], b = layout(s.unlock_rule).bands.find((x) => x.band === band), it = P.items[s.item_ids[position]];
        const st = load(); const r = st.runs[key] || (st.runs[key] = { set: setId, band, answers: {}, at: new Date().toISOString() });
        if (!(position in r.answers)) r.answers[position] = choice;
        r.answered = Object.keys(r.answers).length; r.correct = Object.entries(r.answers).filter(([p, c]) => c === P.items[s.item_ids[p]].answer_index).length; save(st);
        return { is_correct: r.answers[position] === it.answer_index, answer_index: it.answer_index, explanation: it.explanation,
                 answered: r.answered, correct: r.correct, size: b.size, band_done: r.answered >= b.size, band_passed: r.answered >= b.size && r.correct >= b.pass_needed };
      }
    };
  }

  // ---------------------------------------------------------------- Supabase (shared login with ../p6-line)
  function makeClient() {
    const C = window.KRUOM_CONFIG || {};
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) throw new Error("config");
    return window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "kruom-p6-auth" } });
  }
  async function pickStudent(sb) {
    const { data: s } = await sb.auth.getSession();
    if (!s || !s.session) { const e = new Error("login"); e.code = "login"; throw e; }
    const { data, error } = await sb.from("students").select("id,full_name,grade_code,school").order("created_at");
    if (error) throw error;
    const p6 = (data || []).filter((x) => x.grade_code === "P6");
    if (!p6.length) { const e = new Error("no student"); e.code = "nostudent"; throw e; }
    const last = localStorage.getItem("kruom_last_student");
    return p6.find((x) => x.id === last) || p6[0];
  }

  function Rpc(sb) {
    let student;
    return {
      mode: "rpc",
      async init() { student = await pickStudent(sb); return { student }; },
      async progress(setId) { const { data, error } = await sb.rpc("p6_stage_progress", { p_student_id: student.id, p_exam_set_id: setId }); if (error) throw error; return data; },
      async bandItems(setId, band) { const { data, error } = await sb.rpc("p6_stage_band_items", { p_student_id: student.id, p_exam_set_id: setId, p_band: band }); if (error) throw error; return data; },
      async check(setId, band, key, position, choice, timeMs) {
        const { data, error } = await sb.rpc("p6_check_answer", { p_student_id: student.id, p_exam_set_id: setId, p_band: band, p_attempt_key: key,
          p_position: position, p_choice: choice, p_time_ms: Math.min(timeMs | 0, 86400000) });
        if (error) throw error; return data; }
    };
  }

  function Legacy(sb) {
    let student; const sets = {};
    async function set(setId) {
      if (sets[setId]) return sets[setId];
      const { data, error } = await sb.from("exam_sets").select("id,kind,subject_id,grade_code,item_ids,unlock_rule,active").eq("id", setId).maybeSingle();
      if (error) throw error;
      if (!data) { const e = new Error("exam set not active"); e.code = "inactive"; throw e; }   // RLS hides inactive sets
      return (sets[setId] = data);
    }
    async function runs(setId) {
      const { data, error } = await sb.from("attempts").select("meta,n_correct,n_items,submitted_at")
        .eq("student_id", student.id).eq("exam_set_id", setId).eq("meta->>game", "p6-stage-q");
      if (error) throw error;
      const by = {};
      for (const a of data || []) { const k = a.meta.run; const r = by[k] || (by[k] = { key: k, band: a.meta.band, answered: 0, correct: 0, at: a.submitted_at, pos: new Set() });
        if (r.pos.has(a.meta.position)) continue; r.pos.add(a.meta.position); r.answered++; r.correct += a.n_correct; if (a.submitted_at > r.at) r.at = a.submitted_at; }
      return Object.values(by);
    }
    return {
      mode: "legacy",
      async init() { student = await pickStudent(sb); return { student }; },
      async progress(setId) { const s = await set(setId); return { active: s.active, bands: unlockFrom(layout(s.unlock_rule), await runs(setId)) }; },
      async bandItems(setId, band) {
        const s = await set(setId), b = layout(s.unlock_rule).bands.find((x) => x.band === band);
        const pr = await this.progress(setId); if (!pr.bands.find((x) => x.band === band).unlocked) throw new Error("band locked");
        const ids = s.item_ids.slice(b.first - 1, b.last);
        const { data, error } = await sb.from("items").select("id,stem,choices,strand_id").in("id", ids); if (error) throw error;
        return ids.map((id, i) => { const it = data.find((x) => x.id === id); return { position: b.first - 1 + i, item_id: id, stem: it.stem, choices: it.choices, strand_id: it.strand_id }; });
      },
      async check(setId, band, key, position, choice, timeMs) {
        const s = await set(setId), b = layout(s.unlock_rule).bands.find((x) => x.band === band);
        const { data: att, error } = await sb.rpc("p6_record_attempt", { p: {
          student_id: student.id, grade_code: s.grade_code, kind: s.kind, exam_set_id: s.id, subject_id: s.subject_id,
          client_attempt_id: ("q-" + key + "-" + position).slice(0, 80), duration_s: Math.round(timeMs / 1000),
          meta: { game: "p6-stage-q", band, run: key, position },
          answers: [{ item_id: s.item_ids[position], position, choice_index: choice, time_ms: timeMs | 0 }] } });
        if (error) throw error;
        const { data: rev, error: e2 } = await sb.rpc("p6_attempt_review", { p_attempt_id: att.id }); if (e2) throw e2;
        const r = rev[0]; const cur = (await runs(setId)).find((x) => x.key === key);   // this run only (a replay of the band must not read an older run)
        return { is_correct: r.is_correct, answer_index: r.answer_keys[0], explanation: r.explanation || [],
                 answered: cur.answered, correct: cur.correct, size: b.size, band_done: cur.answered >= b.size, band_passed: cur.answered >= b.size && cur.correct >= b.pass_needed };
      }
    };
  }

  window.P6Backend = {
    layout, unlockFrom, errText,
    async create(mode) {
      if (mode === "preview") return Preview();
      const sb = makeClient();
      if (mode === "legacy") return Legacy(sb);
      if (mode === "rpc") return Rpc(sb);
      // auto: use the server gate when it is installed, otherwise the existing functions
      const { error } = await sb.rpc("p6_stage_progress", { p_student_id: "00000000-0000-0000-0000-000000000000", p_exam_set_id: "x" });
      const missing = error && (error.code === "PGRST202" || /Could not find the function/i.test(error.message || ""));
      return missing ? Legacy(sb) : Rpc(sb);
    }
  };
})();
