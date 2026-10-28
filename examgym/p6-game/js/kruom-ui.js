// ปิยมิตร ป.6 · UI components — the same markup/classes as the Exam Gym ปิยมิตรมัธยม (ม.1–ม.6) components
// (source: kruom9/kruom-examgym-pmv apps/web/js/eg-ui.js, copied read-only and trimmed). Pages compose these only.
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const attrs = (o) => Object.entries(o || {}).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join("");
  const LOGO = "../p6-line/assets/piyamit-logo-256.png";      // already deployed with the LINE login app
  const KEYS = ["ก", "ข", "ค", "ง", "จ"];
  const UI = {
    esc, attrs, KEYS,
    topbar({ title, sub, back, actions }) {
      return `<header class="eg-top"><div class="eg-top__in">${back ? `<button class="eg-top__back" data-act="${esc(back)}" aria-label="ย้อนกลับ" data-test="back">‹</button>` : ""}`
        + `<img class="eg-top__logo" src="${LOGO}" alt="โรงเรียนปิยมิตรวิทยา">`
        + `<div class="eg-top__title"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`
        + `<div class="eg-top__act">${actions || ""}</div></div></header>`;
    },
    page: (inner, extra) => `<main class="eg-page${extra ? " " + extra : ""}">${inner}</main>`,
    card: (inner, mod, a) => `<section class="eg-card${mod ? " eg-card--" + mod : ""}"${attrs(a)}>${inner}</section>`,
    stack: (inner) => `<div class="eg-stack">${inner}</div>`,
    split: (a, b) => `<div class="eg-split"><div class="eg-stack">${a}</div><div class="eg-stack">${b}</div></div>`,
    h2: (t, right) => `<div class="eg-section-title"><h2 class="eg-h2">${esc(t)}</h2>${right || ""}</div>`,
    p: (t, mod) => `<p class="${mod || "eg-mut"}">${esc(t)}</p>`,
    note: (html, warn, id) => `<div class="eg-note${warn ? " eg-note--warn" : ""}"${attrs({ id, role: warn ? "alert" : null })}>${html}</div>`,
    hero({ title, sub, img, extra }) {
      return UI.card(`<div class="eg-hero">${img ? `<img class="p6-npc" src="${esc(img)}" alt="">` : ""}<div class="eg-hero__txt"><h1 class="eg-h1">${esc(title)}</h1>${sub ? `<p class="eg-mut">${sub}</p>` : ""}${extra || ""}</div></div>`, "hero");
    },
    btn(label, o) {
      o = o || {}; const cls = "eg-btn" + (o.kind ? " eg-btn--" + o.kind : "") + (o.sm ? " eg-btn--sm" : "");
      if (o.href) return `<a class="${cls}"${attrs({ href: o.href, "data-test": o.test })}>${esc(label)}</a>`;
      return `<button class="${cls}"${attrs({ type: "button", "data-act": o.act, "data-arg": o.arg, disabled: !!o.disabled, id: o.id, "data-test": o.test })}>${esc(label)}</button>`;
    },
    btns: (inner, end) => `<div class="eg-btns${end ? " eg-btns--end" : ""}">${inner}</div>`,
    badge(text, kind, icon, a) { return `<span class="eg-badge${kind ? " eg-badge--" + kind : ""}"${attrs(a)}>${icon ? esc(icon) + " " : ""}${esc(text)}</span>`; },
    tile({ icon, title, sub, end, act, arg, mod, test, extra }) {
      return `<button class="eg-tile${mod ? " " + mod : ""}"${attrs(Object.assign({ type: "button", "data-act": act, "data-arg": arg, "data-test": test }, extra))}>`
        + `<span class="eg-tile__icon"><span class="p6-tile-ic">${esc(icon)}</span></span><span class="eg-tile__body"><span class="eg-tile__title">${esc(title)}</span>${sub ? `<span class="eg-tile__sub">${esc(sub)}</span>` : ""}</span>`
        + `<span class="eg-tile__end">${end || ""}<span class="eg-tile__chev" aria-hidden="true">›</span></span></button>`;
    },
    prog(p, kind) { p = Math.max(0, Math.min(100, p)); return `<div class="eg-prog${kind ? " eg-prog--" + kind : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"><i data-p="${p}"></i></div>`; },
    progLine: (p, label, kind) => `<div class="eg-progline">${UI.prog(p, kind)}<span>${esc(label)}</span></div>`,
    stats: (arr) => `<div class="eg-stats">${arr.map(([v, l]) => `<div class="eg-stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`,
    score({ pct, title, pass, passText, failText, sub }) {
      return `<div class="eg-score ${pass ? "eg-score--ok" : "eg-score--no"}"><div class="eg-score__ring" data-ring="${pct}"><b>${pct}%</b></div><div class="eg-score__txt"><b class="eg-h1" data-test="score-title">${esc(title)}</b>${UI.badge(pass ? passText || "ผ่านเกณฑ์" : failText || "ยังไม่ผ่านเกณฑ์", pass ? "ok" : "no", pass ? "✓" : "✗")}${sub ? `<span class="eg-sm eg-mut">${sub}</span>` : ""}</div></div>`;
    },
    table(cols, rows, cls) {
      return `<div class="eg-table-wrap"><table class="eg-table${cls ? " " + cls : ""}"><thead><tr>${cols.map((c) => `<th${c.num ? ' class="eg-num"' : ""}>${esc(c.t)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr${attrs({ "data-row": r._row })}>${cols.map((c) => `<td${c.num ? ' class="eg-num"' : ""}>${c.html ? c.html(r) : esc(r[c.k] == null ? "—" : r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    },
    empty(title, sub, extra) { return `<div class="eg-empty"><b>${esc(title)}</b>${sub ? `<span class="eg-sm">${esc(sub)}</span>` : ""}${extra || ""}</div>`; },
    seg(items, cur, act) { return `<div class="eg-seg" role="tablist">${items.map(([k, t]) => `<button role="tab" type="button" class="${k === cur ? "is-on" : ""}" aria-selected="${k === cur}" data-act="${esc(act)}" data-arg="${esc(k)}" data-test="tab-${esc(k)}">${esc(t)}</button>`).join("")}</div>`; },
    // question + choices. o: {sel, reveal, key (correct index, only after the server checked), meta, after, busy}
    question(it, o) {
      o = o || {};
      const ch = it.choices.map((c, k) => {
        let cls = "eg-choice", mark = "";
        if (o.reveal) { if (k === o.key) { cls += " eg-choice--ok"; mark = "✓ ถูก"; } else if (o.sel === k) { cls += " eg-choice--no"; mark = "✗ ที่เลือก"; } }
        else if (o.sel === k) cls += " eg-choice--sel";
        return `<button type="button" class="${cls}" data-act="choose" data-arg="${k}" data-k="${k}" aria-pressed="${o.sel === k}"${o.reveal || o.busy ? " disabled" : ""}><span class="eg-choice__key">${KEYS[k]}</span><span class="eg-choice__txt">${esc(c)}</span>${mark ? `<span class="eg-choice__mark">${mark}</span>` : ""}</button>`;
      }).join("");
      return `<div class="eg-q" id="q-card"${attrs({ "data-item": it.item_id, "data-pos": it.position })}><div class="eg-q__meta">${o.meta || ""}</div><div class="eg-q__stem" id="q-stem">${esc(it.stem)}</div><div class="eg-choices" id="answers" role="group" aria-label="ตัวเลือก">${ch}</div>${o.after || ""}</div>`;
    },
    explain(ok, lines, title) {
      const kind = ok == null ? "warn" : ok ? "ok" : "no";
      return `<div class="eg-explain eg-explain--${kind}" id="fb" role="status"><b>${esc(title || (ok ? "✓ ถูกต้อง" : "✗ ยังไม่ถูก"))}</b>${(lines || []).filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join("")}</div>`;
    },
    foot: (txt) => `<footer class="eg-foot">${esc(txt)}</footer>`,
    toast(msg) { const d = document.createElement("div"); d.className = "eg-toast"; d.setAttribute("role", "status"); d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); },
    hydrate(root) {
      root.querySelectorAll("[data-p]").forEach((el) => { el.style.width = el.dataset.p + "%"; });
      root.querySelectorAll("[data-ring]").forEach((el) => { el.style.setProperty("--p", el.dataset.ring); });
    }
  };
  window.P6UI = UI;
})();
