const { attach } = require('./_drv');
(async()=>{ const {pg}=await attach();
 const r = await pg.evaluate(()=>{
   const b=document.getElementById('form:j_idt115:ajax');
   if(!b) return 'NO-BTN';
   const rc=b.getBoundingClientRect();
   const cx=rc.x+rc.width/2, cy=rc.y+rc.height/2;
   const top=document.elementFromPoint(cx,cy);
   const cs=getComputedStyle(b);
   return {rect:{x:rc.x,y:rc.y,w:rc.width,h:rc.height}, cx,cy,
     top: top? (top.tagName+'#'+top.id+'.'+top.className).slice(0,120):'null',
     esEl: top===b || b.contains(top),
     disabled: b.disabled, cls:b.className,
     pe: cs.pointerEvents, vis: cs.visibility, op: cs.opacity,
     scrollY: window.scrollY, innerH: window.innerHeight };
 });
 console.log(JSON.stringify(r,null,1));
 process.exit(0);})();
