/* Exam Gym ม.6 · ชั้นการแสดงผลแบบ iOS (ทดลอง) · ไม่แตะตรรกะของ app.js: แค่ย้ายปุ่มกลับไปแถบบน, หัวข้อใหญ่ยุบเมื่อเลื่อน, แถบแท็บล่าง, bottom sheet, segmented, สวิตช์ตัวอักษรใหญ่ */
(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var app = $('#app'), nav = $('#nav'), back = $('#navBack'), backT = $('#navBackT'), brand = $('#navBrand'), title = $('#navTitle'), tabbar = $('#tabbar'), modal = $('#modal');
var io = null, pending = false;
function student() { try { return JSON.parse(localStorage.getItem('eg6:student') || 'null'); } catch (e) { return null; } }
function routeName(h) {
  if (h === '/' || h === '') return 'landing';
  if (h === '/register') return 'register';
  if (h === '/sources') return 'sources';
  if (h === '/subjects') return 'home';
  if (h === '/soc') return 'soc';
  if (/^\/soc\/sara\//.test(h)) return 'sara';
  if (h === '/soc/practice' || h === '/soc/review') return 'practice';
  if (h === '/soc/mock') return 'mock';
  if (h === '/soc/mock/run') return 'mockrun';
  if (/^\/soc\/mock\/result\//.test(h)) return 'result';
  if (/^\/soc\/mock\/review\//.test(h)) return 'mockreview';
  if (h === '/soc/me') return 'me';
  return 'other';
}
var TAB = {home: 'home', soc: 'practice', sara: 'practice', mock: 'mock', result: 'mock', me: 'me', sources: ''};
function decorate() {
  pending = false;
  var h = location.hash.replace(/^#/, '') || '/', r = routeName(h), st = student();
  if (r === 'practice' && !$('.q-card', app) && $('h2', app)) r = 'done';
  document.body.className = document.body.className.replace(/\br-\S+/g, '').trim() + ' r-' + r + (localStorage.getItem('eg6ios:big') === '1' ? ' big' : '');
  document.body.classList.toggle('big', localStorage.getItem('eg6ios:big') === '1');
  // ปุ่มกลับ (ใช้ลิงก์เดิมของหน้า เพื่อให้ทำงานเหมือนเดิมทุกอย่าง)
  var a = $('.crumb a', app);
  if (a) { back.hidden = false; brand.hidden = true; backT.textContent = a.textContent.replace(/^\s*←\s*/, '').trim() || 'กลับ'; back.onclick = function () { a.click(); }; }
  else { back.hidden = true; brand.hidden = false; back.onclick = null; }
  nav.classList.toggle("brandmode", !a);
  // หัวข้อใหญ่ → ยุบเป็นชื่อเล็กบนแถบเมื่อเลื่อน
  var lt = $('h2', app) || $('h1', app);
  if (r === 'practice' || r === 'mockreview') lt = $('.q-meta b', app) || lt;
  if (io) { io.disconnect(); io = null; }
  nav.classList.remove('shrunk');
  if (lt) {
    if (lt.tagName === 'H2') lt.classList.add('lt');
    title.textContent = lt.textContent.replace(/\s+/g, ' ').trim();
    if ('IntersectionObserver' in window && lt.tagName !== 'B') {
      io = new IntersectionObserver(function (es) { nav.classList.toggle('shrunk', !es[0].isIntersecting); }, {rootMargin: '-' + (nav.offsetHeight + 4) + 'px 0px 0px 0px'});
      io.observe(lt);
    } else nav.classList.add('shrunk');
  } else title.textContent = r === 'mockrun' ? 'สอบเสมือนจริง' : '';
  // แถบแท็บล่าง: เฉพาะหน้าหลักที่ลงทะเบียนแล้ว (ซ่อนระหว่างทำข้อสอบ)
  var tab = st ? TAB[r] : undefined, show = st && tab !== undefined;
  tabbar.hidden = !show; document.body.classList.toggle('has-tabs', !!show);
  Array.prototype.forEach.call(tabbar.querySelectorAll('a'), function (x) { var on = x.dataset.tab === tab; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  // segmented controls
  var stp = $('.steps', app); if (stp) stp.classList.add('seg');
  var f = $('[data-f]', app); if (f && f.parentNode) f.parentNode.classList.add('seg');
  // ผลของฉัน: กลุ่ม "การแสดงผล" + สวิตช์ตัวอักษรใหญ่ (เก็บในเครื่องนี้ ไม่ส่งไปไหน)
  if (r === 'me' && !$('#bigSw', app)) {
    var lo = $('#lo', app), box = document.createElement('div');
    box.innerHTML = '<h3 class="gh">การแสดงผล</h3><div class="group"><label class="cell sw"><span>ตัวอักษรใหญ่พิเศษ</span><input type="checkbox" id="bigSw" role="switch"' + (localStorage.getItem('eg6ios:big') === '1' ? ' checked' : '') + '><i aria-hidden="true"></i></label></div><p class="gfoot">โหมดสว่าง/มืดเปลี่ยนตามการตั้งค่าของเครื่อง</p>';
    if (lo && lo.parentNode) lo.parentNode.parentNode.insertBefore(box, lo.parentNode); else app.appendChild(box);
    $('#bigSw', app).onchange = function () { localStorage.setItem('eg6ios:big', this.checked ? '1' : '0'); document.body.classList.toggle('big', this.checked); };
  }
}
function schedule() { if (!pending) { pending = true; Promise.resolve().then(decorate); } }
new MutationObserver(schedule).observe(app, {childList: true});
window.addEventListener('hashchange', schedule);
// bottom sheet: แตะพื้นหลัง = ยกเลิก/ปิด (กดปุ่ม #mNo เดิม)
new MutationObserver(function () { document.body.classList.toggle('sheet-open', !modal.hidden); }).observe(modal, {attributes: true, attributeFilter: ['hidden']});
modal.addEventListener('click', function (e) { if (e.target === modal) { var n = $('#mNo'); if (n) n.click(); } });
// สัมผัสแบบ haptic (อุปกรณ์ที่รองรับเท่านั้น)
document.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('button,.btn,.tabbar a'); if (b && !b.disabled && navigator.vibrate) { try { navigator.vibrate(5); } catch (x) {} } }, {passive: true});
decorate();
})();
