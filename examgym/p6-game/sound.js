// ระบบเสียง mockup: สังเคราะห์ด้วย Web Audio API (ไม่มีไฟล์เสียง ไม่มีค่าใช้จ่าย) · โทน "แฟนตาซี" นุ่ม สั้น
// เริ่มเสียงหลังการแตะครั้งแรกเท่านั้น (นโยบาย autoplay) · ค่าเริ่มต้นระดับเสียงรวม 60% · จำค่าใน localStorage
(function(){
  const KEY='kruomGameSound_v1';
  const pref=Object.assign({master:0.6,sfx:true,music:true,muted:false},JSON.parse(localStorage.getItem(KEY)||'{}'));
  let ctx=null, out=null;
  const save=()=>localStorage.setItem(KEY,JSON.stringify(pref));
  function ensure(){ if(!ctx){ if(navigator.audioSession){try{navigator.audioSession.type='ambient'}catch(e){}} /* iOS: ambient = เคารพสวิตช์เงียบ */ ctx=new (window.AudioContext||window.webkitAudioContext)(); out=ctx.createGain(); out.connect(ctx.destination);} 
    if(ctx.state==='suspended') ctx.resume(); out.gain.value=pref.muted?0:pref.master*0.5; return ctx; }
  // โน้ตหนึ่งตัว: ระฆัง/ไซน์นุ่ม + เอนเวโลปสั้น
  function tone(f,t0,dur,type='sine',vol=0.25,glide=0){const c=ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,c.currentTime+t0);
    if(glide) o.frequency.exponentialRampToValueAtTime(f*glide,c.currentTime+t0+dur);
    g.gain.setValueAtTime(0.0001,c.currentTime+t0);g.gain.exponentialRampToValueAtTime(vol,c.currentTime+t0+0.012);g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t0+dur);
    o.connect(g);g.connect(out);o.start(c.currentTime+t0);o.stop(c.currentTime+t0+dur+0.02);}
  function chime(f,t0,dur=0.35,vol=0.18){tone(f,t0,dur,'sine',vol);tone(f*2,t0,dur*0.7,'sine',vol*0.35);tone(f*3.01,t0,dur*0.4,'triangle',vol*0.12);}
  // ชุดเสียงประจำโลก (palette) — วิทย์: บับเบิล/ซินธ์นุ่ม · คณิต: ระฆังแก้ว/คลิก
  const P={science:{base:523.25,wave:'sine'},math:{base:659.25,wave:'triangle'}};
  const world=()=>document.body.dataset.world||'science';
  const SFX={
    tap(){tone(P[world()].base*1.5,0,0.06,'triangle',0.08)},
    correct(){const b=P[world()].base;chime(b,0,0.3);chime(b*1.25,0.08,0.3);chime(b*1.5,0.16,0.45)},          // ~0.6s
    wrong(){const b=P[world()].base/2;tone(b*1.2,0,0.25,'sine',0.12,0.85);tone(b,0.12,0.3,'sine',0.1,0.9)},    // นุ่ม ไม่ตำหนิ ~0.4s
    boss(){[196,246.9,293.7,392].forEach((f,i)=>{tone(f,i*0.18,0.9,'triangle',0.12);tone(f/2,i*0.18,0.9,'sine',0.08)});chime(784,0.75,0.9,0.12)}, // <2s
    unlock(){[523.25,659.25,783.99,1046.5].forEach((f,i)=>chime(f,i*0.07,0.35,0.14))},
    power(){tone(400,0,0.35,'sine',0.14,2.2);chime(1046.5,0.18,0.3,0.1)},
    shop(){chime(880,0,0.2,0.12);chime(1318.5,0.06,0.25,0.1)},
    collect(){[783.99,987.77,1174.66,1567.98].forEach((f,i)=>chime(f,i*0.06,0.3,0.12))},
    rankup(){[392,523.25,659.25,783.99].forEach((f,i)=>{chime(f,i*0.12,0.5,0.14);tone(f/2,i*0.12,0.5,'triangle',0.06)})},
    result(){[523.25,659.25,783.99].forEach(f=>chime(f,0,0.9,0.1));chime(1046.5,0.25,0.8,0.12)}
  };
  window.SFX=(name)=>{ if(pref.muted||!pref.sfx) return; ensure(); (SFX[name]||SFX.tap)(); };
  window.SoundPref=pref;
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.querySelector('.sound');
    const paint=()=>{ if(btn){btn.textContent=pref.muted?'🔇':'🔊';btn.classList.toggle('off',pref.muted);} };
    paint();
    btn&&btn.addEventListener('click',e=>{e.stopPropagation();pref.muted=!pref.muted;save();paint();if(!pref.muted){ensure();SFX.tap();}});
    document.addEventListener('pointerdown',()=>ensure(),{once:true});         // ปลดล็อกเสียงหลังแตะครั้งแรก
    document.querySelectorAll('[data-sfx]').forEach(el=>el.addEventListener('click',()=>window.SFX(el.dataset.sfx)));
  });
})();
