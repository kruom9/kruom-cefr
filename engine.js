// ===== เครื่องยนต์ข้อสอบปรับระดับ (adaptive) + กติกาคิดผล · ใช้ร่วมกันทั้งหน้าเว็บ และสคริปต์จำลอง/ทดสอบใน Node =====
// ปรับระดับในแต่ละตอน: เริ่มที่ START_LEVEL (A2) · ตอบถูกติดกัน UP_AFTER (2) ข้อที่ระดับปัจจุบัน → ขึ้น 1 ระดับ
//   ตอบผิดติดกัน DOWN_AFTER (2) ข้อ → ลง 1 ระดับ · ไม่ใช้ข้อซ้ำ · ถ้าข้อในระดับปัจจุบันหมด ใช้ข้อจากระดับที่ใกล้ที่สุด (ระดับต่ำกว่าก่อน)
//   ข้อสำรองแบบนี้: ตอบถูกข้อที่ง่ายกว่าไม่ทำให้ขึ้นระดับ และตอบผิดข้อที่ยากกว่าไม่ทำให้ลงระดับ
// ระดับรายตอน: ระดับสูงสุดที่ตอบ ≥ 3 ข้อ (PART_MIN_ATTEMPTS) และถูก ≥ 60% (PART_PASS)
//   ถ้าไม่มีระดับใดตอบถึง 3 ข้อเลย (ข้อมูลกระจาย เช่น หมดเวลา) ใช้ระดับสูงสุดที่ "ได้เลื่อนขึ้น" (ถูก 2 ข้อติดกันที่ระดับนั้น)
//   ไม่ผ่านเกณฑ์เลย = Pre-A1 · ตอบน้อยกว่า MIN_ANSWERS_PART (8) ข้อ = ข้อมูลไม่พอ (ไม่นำไปคิดระดับรวม)
// ระดับรวม: เฉลี่ยระดับของตอนที่ประเมินได้ (Pre-A1=0, A1=1 … C2=6) แล้วปัดเศษ (.5 ปัดลง)
// จุดแข็ง/ควรพัฒนา: ระดับตอน ≥ ระดับรวม+1 = จุดแข็ง · ≤ ระดับรวม−1 = ควรพัฒนา
//   ถ้าเท่ากับระดับรวม ดู "ระดับเฉลี่ยของข้อช่วงหลัง" (ข้อที่ 9 เป็นต้นไป): สูงสุด = จุดแข็ง ต่ำสุด = ควรพัฒนา เมื่อสูงสุด−ต่ำสุด ≥ PATH_GAP (0.75)
(function(root){
const LEVELS=["A1","A2","B1","B2","C1","C2"],NAMES=["Pre-A1"].concat(LEVELS),PARTS=["grammar","vocab","reading","listening"];
const PART_TH={grammar:"ไวยากรณ์",vocab:"คำศัพท์",reading:"การอ่าน",listening:"การฟัง"};
const D={START_LEVEL:"A2",UP_AFTER:2,DOWN_AFTER:2,ITEMS_PER_PART:25,PART_PASS:0.6,PART_MIN_ATTEMPTS:3,MIN_ANSWERS_PART:8,PATH_GAP:0.75};
const cfgOf=c=>Object.assign({},D,c||{});
function newPart(cfg){cfg=cfgOf(cfg);return{lv:LEVELS.indexOf(cfg.START_LEVEL)+1,sc:0,sw:0,used:[],resp:[],promoted:[],done:false}}
// เลือกข้อถัดไป: pool = รายการข้อของตอนนั้น [{id,level}] · rnd = ฟังก์ชันสุ่ม 0..1
function pick(st,pool,rnd){rnd=rnd||Math.random;const used=new Set(st.used);
 const at=l=>pool.filter(it=>it.level===LEVELS[l-1]&&!used.has(it.id));
 for(let d=0;d<6;d++){for(const l of d===0?[st.lv]:[st.lv-d,st.lv+d]){if(l<1||l>6)continue;const c=at(l);if(c.length)return c[Math.floor(rnd()*c.length)]}}
 return null}
function record(st,item,ok,cfg){cfg=cfgOf(cfg);st.used.push(item.id);st.resp.push({id:item.id,level:item.level,at:LEVELS[st.lv-1],ok:!!ok});
 const il=LEVELS.indexOf(item.level)+1; // ข้อสำรองจากระดับอื่น (เมื่อข้อระดับปัจจุบันหมด): ถูกที่ระดับต่ำกว่าไม่นับขึ้น · ผิดที่ระดับสูงกว่าไม่นับลง
 if(ok){if(il<st.lv)return fin(st,cfg);st.sc++;st.sw=0;if(st.sc>=cfg.UP_AFTER){if(st.lv<6){st.promoted.push(st.lv);st.lv++}st.sc=0}}
 else{if(il>st.lv)return fin(st,cfg);st.sw++;st.sc=0;if(st.sw>=cfg.DOWN_AFTER){if(st.lv>1)st.lv--;st.sw=0}}
 return fin(st,cfg)}
function fin(st,cfg){if(st.resp.length>=cfg.ITEMS_PER_PART)st.done=true;return st}
function scorePart(st,cfg,evaluated){cfg=cfgOf(cfg);const r=st.resp,by={};LEVELS.forEach(l=>by[l]={c:0,n:0});
 r.forEach(x=>{by[x.level].n++;if(x.ok)by[x.level].c++});
 const c=r.filter(x=>x.ok).length,n=r.length;let idx=0,basis="";
 const q=LEVELS.map((l,i)=>i+1).filter(i=>{const b=by[LEVELS[i-1]];return b.n>=cfg.PART_MIN_ATTEMPTS&&b.c/b.n>=cfg.PART_PASS-1e-9});
 const anyMin=LEVELS.some(l=>by[l].n>=cfg.PART_MIN_ATTEMPTS);
 if(q.length){idx=Math.max(...q);basis="rule"}else if(!anyMin&&st.promoted.length){idx=Math.max(...st.promoted);basis="promotion"}else basis=n?"none":"";
 const late=r.length>8?r.slice(8):r,pathScore=late.length?late.reduce((s,x)=>s+LEVELS.indexOf(x.level)+1,0)/late.length:0;
 const status=evaluated===false?"na":n<cfg.MIN_ANSWERS_PART?"insufficient":"ok";
 return{c,n,pct:n?Math.round(c/n*100):0,max:cfg.ITEMS_PER_PART,idx,level:NAMES[idx],basis,byLevel:by,pathScore:Math.round(pathScore*100)/100,status,
  path:r.map(x=>x.level+(x.ok?"✓":"✗")).join(" ")}}
function overall(parts,cfg){cfg=cfgOf(cfg);const inc=PARTS.filter(p=>parts[p]&&parts[p].status==="ok");
 if(!inc.length)return{idx:null,level:null,included:[],summary:"ข้อมูลไม่พอสำหรับประเมินระดับ"};
 const mean=inc.reduce((s,p)=>s+parts[p].idx,0)/inc.length,idx=Math.ceil(mean-0.5-1e-9);
 const ps=inc.map(p=>parts[p].pathScore),mx=Math.max(...ps),mn=Math.min(...ps),spread=mx-mn>=cfg.PATH_GAP-1e-9;
 PARTS.forEach(p=>{const x=parts[p];if(!x)return;if(x.status!=="ok"){x.flag=x.status;x.flagTh=x.status==="na"?"ไม่ได้ประเมิน":"ข้อมูลไม่พอ";x.why="";return}
  let f="mid",why="";if(x.idx>=idx+1){f="strong";why="ระดับตอนนี้สูงกว่าระดับรวม"}else if(x.idx<=idx-1){f="weak";why="ระดับตอนนี้ต่ำกว่าระดับรวม"}
  else if(spread&&x.pathScore===mx){f="strong";why="ทำข้อยากได้ต่อเนื่องที่สุดในช่วงหลัง"}else if(spread&&x.pathScore===mn){f="weak";why="ระดับข้อช่วงหลังต่ำที่สุด"}
  x.flag=f;x.flagTh={strong:"จุดแข็ง",mid:"พอใช้",weak:"ควรพัฒนา"}[f];x.why=why});
 const st=inc.filter(p=>parts[p].flag==="strong").map(p=>PART_TH[p]),wk=inc.filter(p=>parts[p].flag==="weak").map(p=>PART_TH[p]);
 const join=a=>a.length<2?a.join(""):a.slice(0,-1).join(" ")+"และ"+a[a.length-1];
 const summary=inc.length===1?`ประเมินได้เพียงตอน${PART_TH[inc[0]]} (ระดับ ${NAMES[idx]}) ควรทำตอนที่เหลือให้ครบ`:st.length&&wk.length?`น้องเด่นด้าน${join(st)} ควรฝึก${join(wk)}เพิ่ม`:st.length?`น้องเด่นด้าน${join(st)} ด้านอื่นอยู่ในระดับพอใช้`:wk.length?`ควรฝึก${join(wk)}เพิ่มเป็นลำดับแรก`:`ทักษะที่ประเมินได้ใกล้เคียงกัน (ระดับรวม ${NAMES[idx]})`;
 return{idx,level:NAMES[idx],mean:Math.round(mean*100)/100,included:inc,summary}}
const api={LEVELS,NAMES,PARTS,PART_TH,DEFAULTS:D,newPart,pick,record,scorePart,overall};
if(typeof module!=="undefined")module.exports=api;else root.CEFR_ENGINE=api;
})(typeof window!=="undefined"?window:this);
