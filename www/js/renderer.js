import { CANVAS_W, CANVAS_H, CELL, BX, BY, BOARD_W, BOARD_H, COLS, ROWS, UI } from "./constants.js";
import { TextureFactory } from "./textures.js";
import { shade, shadeA, clamp, roundRect } from "./utils.js";

/**
 * 整屏泛光（Bloom）。
 */
export const Bloom = {
  S: 0.25,
  ready: false,
  init(){
    if(this.ready) return;
    const w = Math.round(CANVAS_W*this.S), h = Math.round(CANVAS_H*this.S);
    this.a = document.createElement("canvas"); this.a.width=w; this.a.height=h;
    this.ac = this.a.getContext("2d");
    this.b = document.createElement("canvas"); this.b.width=w>>1; this.b.height=h>>1;
    this.bc = this.b.getContext("2d");
    this.ready = true;
  },
  begin(){
    this.init();
    this.ac.clearRect(0,0,this.a.width,this.a.height);
  },
  /** 收集一块亮部（棋盘坐标，自动缩放） */
  mask(x, y, w, h, color, alpha){
    const s = this.S, c = this.ac;
    c.globalAlpha = alpha === undefined ? 1 : alpha;
    c.fillStyle = color;
    c.fillRect(x*s, y*s, w*s, h*s);
  },
  maskCircle(x, y, r, color, alpha){
    const s = this.S, c = this.ac;
    c.globalAlpha = alpha === undefined ? 1 : alpha;
    c.fillStyle = color;
    c.beginPath(); c.arc(x*s, y*s, r*s, 0, 6.283); c.fill();
  },
  /** 模糊并叠加到主画布 */
  composite(ctx, strength){
    if(!this.ready) return;
    const { a, b, ac, bc } = this;
    ac.globalAlpha = 1;
    bc.clearRect(0,0,b.width,b.height);
    bc.drawImage(a, 0, 0, b.width, b.height);
    ac.clearRect(0,0,a.width,a.height);
    ac.drawImage(b, 0, 0, a.width, a.height);
    bc.clearRect(0,0,b.width,b.height);
    bc.drawImage(a, 0, 0, b.width, b.height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    ctx.drawImage(a, 0, 0, CANVAS_W, CANVAS_H);
    ctx.globalAlpha = strength * 0.75;
    ctx.drawImage(b, 0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
};

export const BrickRenderer = {
  /** 只画石体本身；辉光交给 Bloom 统一处理 */
  draw(ctx, x, y, type, variant, opt){
    opt = opt || {};
    const sq = opt.squash || 0;
    let w = CELL, h = CELL, dx = x, dy = y;
    if(sq > 0){
      const sx = 1 + sq*0.22, sy = 1 - sq*0.26;
      w = CELL*sx; h = CELL*sy;
      dx = x - (w-CELL)/2; dy = y + (CELL-h);
    }
    if(opt.alpha !== undefined){
      ctx.save(); ctx.globalAlpha = opt.alpha;
      ctx.drawImage(TextureFactory.get(type, variant), dx, dy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(TextureFactory.get(type, variant), dx, dy, w, h);
    }

    if(opt.flash){
      const k = clamp(opt.flash,0,1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = k*0.9;
      ctx.fillStyle = TextureFactory.lightOf(type);
      roundRect(ctx, dx+1, dy+1, w-2, h-2, CELL*0.22); ctx.fill();
      ctx.globalAlpha = k*0.55;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, dx+3, dy+3, w-6, h-6, CELL*0.20); ctx.fill();
      ctx.restore();
    }
  },

  /** 高速下落的拖影，速度越快越长 */
  streak(ctx, x, y, type, vy){
    const len = clamp(vy*0.055, 6, CELL*2.6);
    const g = ctx.createLinearGradient(0, y - len, 0, y + CELL*0.5);
    g.addColorStop(0, shadeA(TextureFactory.lightOf(type), 0, 0));
    g.addColorStop(1, shadeA(TextureFactory.lightOf(type), 0, 0.34));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x + CELL*0.16, y - len, CELL*0.68, len + CELL*0.5);
    ctx.restore();
  },

  drawGhost(ctx, x, y, type){
    const core = TextureFactory.colorOf(type);
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = shadeA(core, -0.1, 0.5);
    roundRect(ctx, x+4, y+4, CELL-8, CELL-8, CELL*0.20); ctx.fill();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = shadeA(core, 0.2, 0.6); ctx.lineWidth = 1.5;
    roundRect(ctx, x+4, y+4, CELL-8, CELL-8, CELL*0.20); ctx.stroke();
    ctx.restore();
  },

  /** 当前方块表面的流动扫光，只在少数几个格子上绘制，开销可忽略 */
  sweep(ctx, cells, t){
    if(!cells.length) return;
    let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
    for(const c of cells){
      if(c.x<minX)minX=c.x; if(c.x+CELL>maxX)maxX=c.x+CELL;
      if(c.y<minY)minY=c.y; if(c.y+CELL>maxY)maxY=c.y+CELL;
    }
    const span = (maxX-minX) + (maxY-minY);
    const p = ((t*0.7) % 2.4) / 2.4;        // 每 2.4 秒扫一次
    if(p > 0.42) return;
    const pos = minX + p/0.42 * span * 1.25 - span*0.12;
    ctx.save();
    ctx.beginPath();
    for(const c of cells) roundRect(ctx, c.x, c.y, CELL, CELL, CELL*0.22);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(pos-34, minY, pos+34, maxY);
    g.addColorStop(0,   "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,.35)");
    g.addColorStop(1,   "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(minX-40, minY, (maxX-minX)+80, maxY-minY);
    ctx.restore();
  }
};

export const BoardRenderer = {
  frame(ctx){
    const grad = ctx.createLinearGradient(BX, BY, BX+BOARD_W, BY+BOARD_H);
    grad.addColorStop(0,"#1fd7ff");
    grad.addColorStop(0.2,"#4f8dff");
    grad.addColorStop(0.4,"#b06cff");
    grad.addColorStop(0.6,"#ff4fa8");
    grad.addColorStop(0.8,"#ffb340");
    grad.addColorStop(1,"#2fe39b");

    // 外圈：粗彩条 + 紫色霓虹辉光
    ctx.save();
    ctx.shadowColor = "#b06cff";
    ctx.shadowBlur = 34;
    ctx.strokeStyle = grad; ctx.lineWidth = 5;
    roundRect(ctx, BX-4.5, BY-4.5, BOARD_W+9, BOARD_H+9, 13); ctx.stroke();
    ctx.restore();

    // 中圈：白亮细边，让彩虹更闪
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.6;
    roundRect(ctx, BX-3, BY-3, BOARD_W+6, BOARD_H+6, 12); ctx.stroke();

    // 内圈：多彩渐变描边
    ctx.strokeStyle = grad; ctx.lineWidth = 1.8;
    roundRect(ctx, BX-1.5, BY-1.5, BOARD_W+3, BOARD_H+3, 11); ctx.stroke();
  },

  /** 井底：静态部分预渲染成一张图，每帧只做一次 drawImage */
  buildWell(){
    const cv = document.createElement("canvas");
    cv.width = BOARD_W; cv.height = BOARD_H;
    const g = cv.getContext("2d");
    g.fillStyle = "#0c0b11"; g.fillRect(0,0,BOARD_W,BOARD_H);
    // 炫彩斜向渐变打底，让棋盘区域也透出多巴胺光
    const rain = g.createLinearGradient(0,0,BOARD_W,BOARD_H);
    rain.addColorStop(0,"rgba(31,215,255,.16)");
    rain.addColorStop(0.3,"rgba(79,141,255,.14)");
    rain.addColorStop(0.55,"rgba(176,108,255,.16)");
    rain.addColorStop(0.8,"rgba(255,79,168,.15)");
    rain.addColorStop(1,"rgba(255,179,64,.14)");
    g.fillStyle = rain; g.fillRect(0,0,BOARD_W,BOARD_H);
    const lg = g.createLinearGradient(0,0,0,BOARD_H);
    lg.addColorStop(0, "rgba(255,255,255,.04)");
    lg.addColorStop(0.5, "rgba(255,255,255,0)");
    lg.addColorStop(1, "rgba(0,0,0,.42)");
    g.fillStyle = lg; g.fillRect(0,0,BOARD_W,BOARD_H);
    g.strokeStyle = "rgba(190,180,210,.07)"; g.lineWidth = 1;
    for(let c=1;c<COLS;c++){ g.beginPath(); g.moveTo(c*CELL+.5,0); g.lineTo(c*CELL+.5,BOARD_H); g.stroke(); }
    for(let r=1;r<ROWS;r++){ g.beginPath(); g.moveTo(0,r*CELL+.5); g.lineTo(BOARD_W,r*CELL+.5); g.stroke(); }
    return cv;
  },

  danger(ctx, t){
    const a = 0.16 + 0.16*Math.abs(Math.sin(t*3.5));
    ctx.save();
    ctx.strokeStyle = shadeA(UI.danger, 0, a); ctx.lineWidth = 1.5;
    ctx.setLineDash([7,6]);
    ctx.beginPath();
    ctx.moveTo(BX, BY+4*CELL+.5); ctx.lineTo(BX+BOARD_W, BY+4*CELL+.5);
    ctx.stroke();
    ctx.restore();
  }
};
