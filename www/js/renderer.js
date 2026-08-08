import { CELL, BX, BY, BOARD_W, BOARD_H, COLS, ROWS } from "./constants.js";
import { TextureFactory } from "./textures.js";
import { shade, shadeA, mulberry32, clamp } from "./utils.js";

export const BrickRenderer = {
  draw(ctx, x, y, color, variant, opt){
    opt = opt || {};
    const tex = TextureFactory.get(color, variant);
    const sq = opt.squash || 0;
    const sx = 1 + sq*0.24, sy = 1 - sq*0.28;
    const w = CELL*sx, h = CELL*sy;
    const dx = x - (w-CELL)/2, dy = y + (CELL-h);
    ctx.save();
    if(opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ctx.drawImage(tex, dx, dy, w, h);
    ctx.restore();
    if(opt.glow){
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = shade(color, 0.7);
      ctx.fillRect(dx+2, dy+2, w-4, h-4);
      ctx.restore();
    }
    if(opt.flash){
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(opt.flash,0,1)*0.92;
      ctx.fillStyle = "#fff4ea";
      ctx.fillRect(dx+1, dy+1, w-2, h-2);
      ctx.restore();
    }
  },
  drawGhost(ctx,x,y,color){
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = shadeA(color,0.1,0.18);
    ctx.fillRect(x+3,y+3,CELL-6,CELL-6);
    ctx.strokeStyle = shade(color,0.4); ctx.lineWidth = 2;
    ctx.setLineDash([5,4]);
    ctx.strokeRect(x+3,y+3,CELL-6,CELL-6);
    ctx.restore();
  }
};

export const BoardRenderer = {
  frame(ctx, FRAME){
    const x=BX-FRAME, y=BY-FRAME, w=BOARD_W+FRAME*2, h=BOARD_H+FRAME*2;
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.75)"; ctx.shadowBlur=20; ctx.shadowOffsetY=6;
    const g=ctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,"#71605b"); g.addColorStop(0.5,"#4a3d3b"); g.addColorStop(1,"#2f2726");
    ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    const rnd=mulberry32(4242);
    for(let i=0;i<180;i++){
      ctx.fillStyle = rnd()>0.5 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.06)";
      ctx.fillRect(x+rnd()*w, y+rnd()*h, rnd()*5+1, rnd()*3+1);
    }
    ctx.restore();
    ctx.strokeStyle="rgba(255,220,215,.16)"; ctx.lineWidth=1;
    ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.strokeStyle="rgba(0,0,0,.6)";
    ctx.strokeRect(BX-.5,BY-.5,BOARD_W+1,BOARD_H+1);
  },
  well(ctx){
    ctx.fillStyle="#1a1416"; ctx.fillRect(BX,BY,BOARD_W,BOARD_H);
    const g=ctx.createLinearGradient(BX,BY,BX,BY+BOARD_H);
    g.addColorStop(0,"rgba(0,0,0,.6)"); g.addColorStop(0.22,"rgba(0,0,0,0)");
    ctx.fillStyle=g; ctx.fillRect(BX,BY,BOARD_W,BOARD_H);
    ctx.strokeStyle="rgba(255,255,255,.035)"; ctx.lineWidth=1;
    for(let c=1;c<COLS;c++){ ctx.beginPath(); ctx.moveTo(BX+c*CELL+.5,BY); ctx.lineTo(BX+c*CELL+.5,BY+BOARD_H); ctx.stroke(); }
    for(let r=1;r<ROWS;r++){ ctx.beginPath(); ctx.moveTo(BX,BY+r*CELL+.5); ctx.lineTo(BX+BOARD_W,BY+r*CELL+.5); ctx.stroke(); }
  }
};
