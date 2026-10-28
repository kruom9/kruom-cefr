// ปิยมิตร ป.6 ฝ่าด่านจุฬาภรณ์ — game settings (front end only; no keys here — Supabase URL/key come from ../p6-line/config.js)
window.GAME_CONFIG = {
  title: "ปิยมิตร ป.6 ฝ่าด่านจุฬาภรณ์",
  disclaimer: "เกมฝึกทำข้อสอบ ไม่เกี่ยวข้องกับโรงเรียนจุฬาภรณราชวิทยาลัย",
  sponsor: "โรงเรียนปิยมิตรวิทยา อ.เชียงคำ จ.พะเยา",
  // play order: World 1 then World 2 (exam_sets.item_ids order = seq 1..30, easy→medium→hard)
  stages: [
    { id: "P6-STAGE-SC", world: "science", title: "โลกวิทยาศาสตร์ ป.6", bg: "assets/sci_world_bg.jpg", arena: "assets/sci_boss_arena.jpg", npc: "ดร.ฟ้าใส · ไกด์แล็บ", short: "วิทยาศาสตร์" },
    { id: "P6-STAGE-MA", world: "math",    title: "โลกคณิตศาสตร์ ป.6",  bg: "assets/math_world_map.jpg", arena: "assets/math_boss_arena.jpg", npc: "น้องเรขา", short: "คณิตศาสตร์" }
  ],
  bandNames: { easy: "ด่านง่าย", medium: "ด่านปานกลาง", hard: "ด่านยาก" },
  // Pass mark to unlock the next band. The server's exam_sets.unlock_rule.bands[].pass wins when present;
  // this is the fallback (and the value used in preview mode). 7 of 10 = 70 % = mastery_pct.
  bandPass: 7,
  timing: { correctMs: 900, wrongMinMs: 3000, wrongPerCharMs: 18, wrongMaxMs: 6000 },   // wrong: ~3 s, longer for long explanations (tap to skip)
  // สพฐ. 8 ระดับ (percent is floored to an integer first)
  gradeScale: [[80, "4"], [75, "3.5"], [70, "3"], [65, "2.5"], [60, "2"], [55, "1.5"], [50, "1"], [0, "0"]]
};
