import { CELL, BX, BY, BOARD_W, BOARD_H } from "./constants.js";
import { clamp, lerp, shade, shadeA } from "./utils.js";

/** 碎片 / 灰尘 / 火星 / 闪光 / 飘字 / Combo / 震屏，全部对象池复用 */
const MAX_PARTS = 320;   // 粒子硬上限，超出则回收最老的，防止连锁爆炸时掉帧

export class Effects {
  constructor(){
    this.pool = []; this.parts = [];
    this.texts = []; this.flashes = [];
    this.shakeT = 0; this.shakeAmp = 0;
    this.slowmo = 0; this.combo = null; this.rings = []; this.beams = []; this.screen = null;
  }
  clear(){
    this.parts.length=0; this.texts.length=0; this.flashes.length=0;
    this.shakeT=0; this.shakeAmp=0; this.combo=null; this.slowmo=0;
    this.rings.length=0; this.beams.length=0; this.screen=null;
  }
  _get(){
    if(this.parts.length >= MAX_PARTS) this._kill(0);   // 回收最老的
    return this.pool.pop() || {};
  }
  _kill(i){ this.pool.push(this.parts[i]); this.parts.splice(i,1); }

  shard(x,y,color){
    const p=this._get();
    p.kind="shard"; p.x=x; p.y=y;
    p.vx=(Math.random()-0.5)*300; p.vy=-90-Math.random()*280;
    p.size=2.5+Math.random()*7; p.rot=Math.random()*6.283; p.vrot=(Math.random()-0.5)*14;
    p.color=color; p.life=0; p.max=0.6+Math.random()*0.7;
    p.sides=3+((Math.random()*3)|0); p.g=1400;
    this.parts.push(p);
  }
  dust(x,y,n){
    for(let i=0;i<n;i++){
      const p=this._get();
      p.kind="dust"; p.x=x+(Math.random()-0.5)*CELL; p.y=y-Math.random()*6;
      p.vx=(Math.random()-0.5)*90; p.vy=-20-Math.random()*60;
      p.size=3+Math.random()*9; p.color="#9a8d86";
      p.life=0; p.max=0.45+Math.random()*0.5; p.g=-40; p.rot=0; p.vrot=0;
      this.parts.push(p);
    }
  }
  spark(x,y){
    const p=this._get();
    p.kind="spark"; p.x=x; p.y=y;
    p.vx=(Math.random()-0.5)*420; p.vy=-Math.random()*380;
    p.size=1.4+Math.random()*2.2; p.color=Math.random()>0.5?"#ffd9a0":"#fff2c8";
    p.life=0; p.max=0.3+Math.random()*0.4; p.g=900; p.rot=0; p.vrot=0;
    this.parts.push(p);
  }
  burstCell(x,y,color,density){
    const n = density || 9;
    for(let i=0;i<n;i++) this.shard(x+Math.random()*CELL, y+Math.random()*CELL, color);
    this.dust(x+CELL/2, y+CELL, 3);
    if(Math.random()<0.55) this.spark(x+Math.random()*CELL, y+Math.random()*CELL);
  }
  beam(row, color){ this.beams.push({row, color, life:0, max:0.5}); }
  screenFlash(color, a){ this.screen = { color, a, life:0, max:0.32 }; }
  ring(x,y,color){ this.rings.push({x,y,color,life:0,max:0.6}); }
  rowFlash(row){ this.flashes.push({row, life:0, max:0.45}); }
  text(x,y,str,color,size){ this.texts.push({x,y,str,color,size:size||22,life:0,max:1.1}); }
  comboPop(str,level){ this.combo={str, life:0, max:1.25, level}; }
  shake(amp,time){ this.shakeAmp=Math.max(this.shakeAmp,amp); this.shakeT=Math.max(this.shakeT,time); }
  slow(t){ this.slowmo=Math.max(this.slowmo,t); }

  update(dt){
    for(let i=this.parts.length-1;i>=0;i--){
      const p=this.parts[i];
      p.life+=dt;
      if(p.life>=p.max){ this._kill(i); continue; }
      p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vrot*dt;
      if(p.kind==="dust"){ p.vx*=0.96; p.size+=dt*13; }
    }
    for(let i=this.texts.length-1;i>=0;i--){
      const t=this.texts[i]; t.life+=dt; t.y-=dt*44;
      if(t.life>=t.max) this.texts.splice(i,1);
    }
    for(let i=this.flashes.length-1;i>=0;i--){
      const f=this.flashes[i]; f.life+=dt;
      if(f.life>=f.max) this.flashes.splice(i,1);
    }
    for(let i=this.rings.length-1;i>=0;i--){ const r=this.rings[i]; r.life+=dt; if(r.life>=r.max) this.rings.splice(i,1); }
    for(let i=this.beams.length-1;i>=0;i--){ const b=this.beams[i]; b.life+=dt; if(b.life>=b.max) this.beams.splice(i,1); }
    if(this.screen){ this.screen.life+=dt; if(this.screen.life>=this.screen.max) this.screen=null; }
    if(this.combo){ this.combo.life+=dt; if(this.combo.life>=this.combo.max) this.combo=null; }
    if(this.shakeT>0){ this.shakeT-=dt; if(this.shakeT<=0) this.shakeAmp=0; }
    if(this.slowmo>0) this.slowmo=Math.max(0,this.slowmo-dt);
  }
  shakeOffset(){
    if(this.shakeT<=0) return [0,0];
    const a=this.shakeAmp*this.shakeT;
    return [(Math.random()-0.5)*a*2,(Math.random()-0.5)*a*2];
  }
  /** 把亮部喂给 Bloom：只挑碎片与火星，成本极低 */
  maskTo(Bloom){
    for(const p of this.parts){
      if(p.kind==="dust") continue;
      const k=1-p.life/p.max;
      Bloom.maskCircle(p.x, p.y, p.size*1.4, p.color, k*0.55);
    }
    for(const b of this.beams){
      const k=1-b.life/b.max;
      Bloom.mask(BX, BY+b.row*CELL, BOARD_W, CELL, "#ffffff", k*0.8);
    }
  }

  drawScreen(ctx, W, H){
    if(!this.screen) return;
    const k=1-this.screen.life/this.screen.max;
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=this.screen.a*k;
    ctx.fillStyle=this.screen.color;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  draw(ctx){
    for(const r of this.rings){
      const k=r.life/r.max;
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      ctx.globalAlpha=(1-k)*0.85;
      ctx.strokeStyle=r.color; ctx.lineWidth=4*(1-k)+1;
      ctx.shadowColor=r.color; ctx.shadowBlur=20;
      ctx.beginPath(); ctx.arc(r.x,r.y, 20+k*230, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
    for(const b of this.beams){
      const k=1-b.life/b.max;
      const cy=BY+b.row*CELL+CELL/2;
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      // 宽扩散
      ctx.globalAlpha=k*0.5;
      const wide=ctx.createLinearGradient(0,cy-CELL*2.2,0,cy+CELL*2.2);
      wide.addColorStop(0,"rgba(255,255,255,0)");
      wide.addColorStop(0.5,b.color);
      wide.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=wide;
      ctx.fillRect(BX-10, cy-CELL*2.2, BOARD_W+20, CELL*4.4);
      // 白核
      ctx.globalAlpha=k;
      const core=ctx.createLinearGradient(BX,0,BX+BOARD_W,0);
      core.addColorStop(0,"rgba(255,255,255,0)");
      core.addColorStop(0.5,"rgba(255,255,255,1)");
      core.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=core;
      const hh=Math.max(1.5, CELL*0.34*k);
      ctx.fillRect(BX, cy-hh/2, BOARD_W, hh);
      ctx.restore();
    }
    for(const f of this.flashes){
      const k=1-f.life/f.max;
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=k*0.6;
      const g=ctx.createLinearGradient(BX,0,BX+BOARD_W,0);
      g.addColorStop(0,"rgba(255,220,200,0)");
      g.addColorStop(0.5,"rgba(255,240,225,1)");
      g.addColorStop(1,"rgba(255,220,200,0)");
      ctx.fillStyle=g;
      const h=CELL*(0.3+k*1.2);
      ctx.fillRect(BX, BY+f.row*CELL+CELL/2-h/2, BOARD_W, h);
      ctx.restore();
    }
    for(const p of this.parts){
      const k=1-p.life/p.max;
      ctx.save();
      ctx.globalAlpha = p.kind==="dust" ? k*0.32 : k;
      ctx.translate(p.x,p.y);
      if(p.kind==="dust"){
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(0,0,p.size*(1.3-k*0.3),0,6.283); ctx.fill();
      } else if(p.kind==="spark"){
        ctx.globalCompositeOperation="lighter";
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(0,0,p.size,0,6.283); ctx.fill();
      } else {
        ctx.rotate(p.rot);
        const s=p.size;
        ctx.beginPath();
        for(let i=0;i<p.sides;i++){
          const a=i/p.sides*6.283, rr=s*(0.6+((i%2)?0.4:0.75));
          const px=Math.cos(a)*rr, py=Math.sin(a)*rr;
          i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=shade(p.color,0.05); ctx.fill();
        ctx.strokeStyle=shadeA(p.color,-0.6,0.9); ctx.lineWidth=1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s*0.4,-s*0.4); ctx.lineTo(s*0.2,-s*0.5);
        ctx.strokeStyle="rgba(255,255,255,.45)"; ctx.stroke();
      }
      ctx.restore();
    }
    for(const t of this.texts){
      const k=1-t.life/t.max;
      ctx.save();
      ctx.globalAlpha=clamp(k*1.6,0,1);
      ctx.font='700 '+t.size+'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.lineWidth=4; ctx.strokeStyle="rgba(0,0,0,.7)";
      ctx.strokeText(t.str,t.x,t.y);
      ctx.fillStyle=t.color; ctx.fillText(t.str,t.x,t.y);
      ctx.restore();
    }
    if(this.combo){
      const c=this.combo, k=c.life/c.max;
      const scale = k<0.22 ? lerp(0.4,1.22,k/0.22) : lerp(1.22,1.0,clamp((k-0.22)/0.3,0,1));
      const alpha = k>0.75 ? 1-(k-0.75)/0.25 : 1;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(BX+BOARD_W/2, BY+BOARD_H*0.34);
      ctx.scale(scale,scale);
      ctx.textAlign="center"; ctx.textBaseline="middle";
      const size = c.level>=4 ? 34 : c.level>=2 ? 32 : 30;
      ctx.font='800 '+size+'px "Segoe UI", system-ui, sans-serif';
      ctx.shadowColor="rgba(255,120,140,.9)"; ctx.shadowBlur=24;
      ctx.lineWidth=6; ctx.strokeStyle="rgba(40,10,18,.85)";
      ctx.strokeText(c.str,0,0);
      const g=ctx.createLinearGradient(0,-size/2,0,size/2);
      g.addColorStop(0,"#fff1e6"); g.addColorStop(1,"#ff8fa6");
      ctx.fillStyle=g; ctx.fillText(c.str,0,0);
      ctx.restore();
    }
  }
}
