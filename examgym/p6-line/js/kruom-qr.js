// QR generator: <ENTRY_URL>?school=<code>[&room=][&exam=]  (default ENTRY_URL = planned GitHub Pages address)
(function () {
  "use strict";
  const C = window.KRUOM_CONFIG || {};
  const DEFAULT_BASE = "https://kruom9.github.io/kruom-cefr/examgym/p6-line/";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = (v, max = 30) => (v && /^[A-Za-z0-9_-]+$/.test(v.trim()) && v.trim().length <= max ? v.trim() : "");
  const q = new URLSearchParams(location.search);
  $("base").value = q.get("base") || C.ENTRY_URL || DEFAULT_BASE;
  let schools = [];
  function fill(list) {
    schools = list; let html = "", grp = null;
    for (const s of list) { if (s.is_other) continue;
      if (s.area_label !== grp) { if (grp !== null) html += "</optgroup>"; grp = s.area_label; html += `<optgroup label="${esc(grp)}">`; }
      html += `<option value="${esc(s.slug || s.code)}">${esc(s.name_th)}</option>`; }
    $("school").innerHTML = html + "</optgroup>";
    const want = q.get("school") || "piyamit"; if ([...$("school").options].some((o) => o.value === want)) $("school").value = want;
    render();
  }
  // static list first (works offline / before the DB exists); piyamit uses its short code
  const staticList = []; for (const g of window.KRUOM_SCHOOLS || []) for (const s of g.schools) if (s.code)
    staticList.push({ code: s.code, slug: s.code === "1156100011" ? "piyamit" : null, name_th: s.name, area_label: g.label });
  fill(staticList);
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) {
    window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
      .from("schools").select("code,slug,name_th,area_label,is_other,sort").order("sort")
      .then(({ data }) => { if (data && data.length) fill(data); }).catch(() => {});
  }
  function url() {
    const code = clean($("code").value) || $("school").value;
    const u = new URL($("base").value.trim() || DEFAULT_BASE);
    u.search = ""; u.hash = ""; u.searchParams.set("school", code);
    const room = clean($("room").value), exam = clean($("exam").value, 60);
    if (room) u.searchParams.set("room", room); if (exam) u.searchParams.set("exam", exam);
    return { href: u.toString(), code };
  }
  function qrDataUrl(text, cell = 8) { const qr = qrcode(0, "M"); qr.addData(text); qr.make(); return qr.createDataURL(cell, 4 * cell); }
  window.kruomQrUrl = url;   // for tests
  function render() {
    let r; try { r = url(); } catch (_) { $("preview-url").textContent = "URL ไม่ถูกต้อง"; return; }
    $("preview-url").textContent = r.href;
    const s = schools.find((x) => x.slug === r.code || x.code === r.code);
    const name = s ? s.name_th : "รหัสโรงเรียน: " + r.code;
    const img = qrDataUrl(r.href);
    const n = Math.max(1, Math.min(40, +$("copies").value || 1));
    document.documentElement.style.setProperty("--cols", $("cols").value);
    $("sheet").innerHTML = Array.from({ length: n }, () => `<div class="qcard"><img class="lg" src="assets/piyamit-logo-256.png" alt="">
      <div>Exam Gym ป.6 · ฝึกทำข้อสอบเข้า ม.1</div><div class="s">${esc(name)}</div>
      <img class="qr" src="${img}" alt="QR" data-url="${esc(r.href)}">
      <div>สแกนด้วยกล้องมือถือ แล้วเข้าสู่ระบบด้วย LINE<br>(LINE ของนักเรียนหรือผู้ปกครอง)</div><div class="u">${esc(r.href)}</div></div>`).join("");
  }
  ["base", "school", "code", "room", "exam", "copies", "cols"].forEach((id) => $(id).addEventListener("input", render));
  $("btn-print").onclick = () => window.print();
  $("btn-png").onclick = () => { const r = url(); const im = new Image();   // library gives GIF → re-encode as real PNG
    im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0);
      const a = document.createElement("a"); a.href = c.toDataURL("image/png");
      a.download = `kruom_examgym_p6_qr_${r.code}${clean($("room").value) ? "_" + clean($("room").value) : ""}.png`; a.click(); };
    im.src = qrDataUrl(r.href, 16); };
})();
