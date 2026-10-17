// ===== กติกาคิดผล CEFR (ใช้ร่วมกันทั้งหน้าเว็บและสคริปต์ทดสอบ) =====
// ระดับรวม = ระดับสูงสุด L ที่ได้ ≥ LEVEL_THRESHOLD ที่ระดับ L และทุกระดับที่ต่ำกว่า · ไม่ถึงเกณฑ์ที่ A1 = Pre-A1
// ระดับรายด้าน = กติกาเดียวกันแต่คิดเฉพาะข้อของด้านนั้น ใช้ PART_THRESHOLD (เพราะแต่ละระดับมีแค่ 2–3 ข้อ)
// สถานะรายด้าน: (1) ดูจากระดับก่อน — ระดับด้าน ≥ ระดับรวม+1 ขั้น = จุดแข็ง · ≤ ระดับรวม−1 ขั้น = ควรพัฒนา
//               (2) ถ้าระดับเท่ากับระดับรวม ดูร้อยละ — ด้านที่ร้อยละสูงสุด (และ ≥ 60%) = จุดแข็ง, ต่ำสุด (และ < 60%) = ควรพัฒนา
//                   เฉพาะเมื่อสูงสุดกับต่ำสุดต่างกันอย่างน้อย PART_GAP จุด · นอกนั้น = พอใช้ (60% = LEVEL_THRESHOLD)
(function(root){
const LEVELS=["A1","A2","B1","B2","C1","C2"],NAMES=["Pre-A1"].concat(LEVELS),PARTS=["vocab","grammar","reading","functional"];
const PART_TH={vocab:"คำศัพท์",grammar:"ไวยากรณ์",reading:"การอ่าน",functional:"ภาษาเพื่อการสื่อสาร"};
function ladder(cells,th){let k=0;for(let i=0;i<LEVELS.length;i++){const c=cells[LEVELS[i]];if(c&&c.n&&c.c/c.n>=th-1e-9)k=i+1;else break}return k}
function score(items,answers,cfg){
 const LT=cfg.LEVEL_THRESHOLD??0.6,PT=cfg.PART_THRESHOLD??0.6,GAP=cfg.PART_GAP??15;
 const lv={},pt={},cell={};LEVELS.forEach(l=>lv[l]={c:0,n:0});PARTS.forEach(p=>{pt[p]={c:0,n:0};cell[p]={};LEVELS.forEach(l=>cell[p][l]={c:0,n:0})});
 let total=0;const detail=items.map((it,i)=>{const ok=answers[i]===it.answer;if(ok)total++;lv[it.level].n++;pt[it.skill].n++;cell[it.skill][it.level].n++;
  if(ok){lv[it.level].c++;pt[it.skill].c++;cell[it.skill][it.level].c++}return ok});
 const idx=ladder(lv,LT),level=NAMES[idx];
 const perLevel={};LEVELS.forEach(l=>perLevel[l]={...lv[l],pct:lv[l].n?Math.round(lv[l].c/lv[l].n*100):0,pass:lv[l].n>0&&lv[l].c/lv[l].n>=LT-1e-9});
 // ผ่านระดับสูงกว่าแต่ไม่ผ่านระดับที่ต่ำกว่า → ผลอาจไม่คงเส้นคงวา (เดา) ให้ครูตรวจ
 const firstFail=LEVELS.findIndex(l=>!perLevel[l].pass),inconsistent=firstFail>=0&&LEVELS.slice(firstFail+1).some(l=>perLevel[l].pass);
 const parts={};PARTS.forEach(p=>{const k=ladder(cell[p],PT);parts[p]={name:PART_TH[p],c:pt[p].c,n:pt[p].n,pct:pt[p].n?Math.round(pt[p].c/pt[p].n*100):0,levelIdx:k,level:NAMES[k],
  cells:Object.fromEntries(LEVELS.map(l=>[l,cell[p][l]]))}});
 const pcts=PARTS.map(p=>parts[p].pct),mx=Math.max(...pcts),mn=Math.min(...pcts),spread=mx-mn>=GAP;
 PARTS.forEach(p=>{const x=parts[p];let s="mid",why="";
  if(x.levelIdx>=idx+1){s="strong";why="ระดับด้านนี้สูงกว่าระดับรวม"}else if(x.levelIdx<=idx-1){s="weak";why="ระดับด้านนี้ต่ำกว่าระดับรวม"}
  else if(spread&&x.pct===mx&&x.pct>=LT*100){s="strong";why="ร้อยละสูงสุดใน 4 ด้าน"}else if(spread&&x.pct===mn&&x.pct<LT*100){s="weak";why="ร้อยละต่ำสุดใน 4 ด้าน"}
  x.status=s;x.statusTh={strong:"จุดแข็ง",mid:"พอใช้",weak:"ควรพัฒนา"}[s];x.why=why});
 const st=PARTS.filter(p=>parts[p].status==="strong").map(p=>PART_TH[p]),wk=PARTS.filter(p=>parts[p].status==="weak").map(p=>PART_TH[p]);
 const join=a=>a.length<2?a.join(""):a.slice(0,-1).join(" ")+"และ"+a[a.length-1];
 const summary=st.length&&wk.length?`น้องเด่นด้าน${join(st)} ควรฝึก${join(wk)}เพิ่ม`:st.length?`น้องเด่นด้าน${join(st)} ด้านอื่นอยู่ในระดับพอใช้`:wk.length?`ควรฝึก${join(wk)}เพิ่มเป็นลำดับแรก`:`ทักษะทั้ง 4 ด้านใกล้เคียงกัน (ระดับรวม ${level})`;
 return {level,levelIdx:idx,total,max:items.length,perLevel,parts,summary,inconsistent,detail};
}
const api={LEVELS,NAMES,PARTS,PART_TH,score};
if(typeof module!=="undefined")module.exports=api;else root.CEFR_SCORING=api;
})(typeof window!=="undefined"?window:this);
