import {
  CANVAS_W, CANVAS_H, COLS, ROWS, CELL, BX, BY, BOARD_W, BOARD_H, FRAME,
  PAD_TOP, DAS, ARR, SOFT_RATE, LOCK_DELAY, MAX_LOCK_RESET
} from "./constants.js";
import { mulberry32, clamp, Storage } from "./utils.js";
import { TextureFactory } from "./textures.js";
import { BrickRenderer, BoardRenderer } from "./renderer.js";
import { Board } from "./board.js";
import { PieceFactory } from "./pieces.js";
import { CollisionSystem } from "./collision.js";
import { GravitySystem } from "./gravity.js";
import { ScoreSystem } from "./score.js";
import { ClearSystem } from "./clear.js";
import { Effects } from "./effects.js";
import { AudioManager } from "./audio.js";
import { Hud } from "./hud.js";
import { Input } from "./input.js";

export class Game {
  constructor(canvas){
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.board = new Board();
    this.effects = new Effects();
    this.mode = "menu";              // menu | playing | paused | gameover
    this.phase = "control";          // control | flash | breakPause | gravity | settlePause
    this.buttons = [];
    this.activeBtn = null;
    this.high = Storage.get("bf_high", 0);
    this.timer = 0; this.clearRows = [];
    this.lowFx = false; this.frameAcc = 0; this.frameN = 0;
    this.bg = this.makeWall();
    this.resetStats();
    this.input = new Input(canvas, this);
    this.last = performance.now();
    requestAnimationFrame((t)=>this.loop(t));
  }

  resetStats(){
    this.score = 0; this.lines = 0; this.chain = 0; this.maxCombo = 0;
    this.level = 1; this.dropT = 0; this.lockT = 0; this.lockResets = 0;
    this.dasT = 0; this.arrT = 0; this.softT = 0;
    this.piece = null; this.nextPiece = null;
  }

  wakeAudio(){ AudioManager.init(); }

  /* ---------------------- 背景水泥墙（预渲染一次） ---------------------- */
  makeWall(){
    const cv = document.createElement("canvas");
    cv.width = CANVAS_W; cv.height = CANVAS_H;
    const g = cv.getContext("2d");
    const grd = g.createRadialGradient(CANVAS_W/2, CANVAS_H*0.32, 60, CANVAS_W/2, CANVAS_H*0.5, 620);
    grd.addColorStop(0,"#3a3033"); grd.addColorStop(1,"#171314");
    g.fillStyle = grd; g.fillRect(0,0,CANVAS_W,CANVAS_H);
    const rnd = mulberry32(20260808);
    const bw = 104, bh = 46;
    for(let y=0,row=0; y<CANVAS_H; y+=bh, row++){
      const off = (row % 2) * bw/2;
      for(let x=-bw; x<CANVAS_W+bw; x+=bw){
        const px=x+off+2, py=y+2, w=bw-4, h=bh-4;
        const v=(rnd()-0.5)*14;
        g.fillStyle = "rgb("+((58+v)|0)+","+((50+v)|0)+","+((52+v)|0)+")";
        g.fillRect(px,py,w,h);
        g.strokeStyle="rgba(0,0,0,.38)"; g.lineWidth=2; g.strokeRect(px,py,w,h);
        g.strokeStyle="rgba(255,255,255,.05)"; g.lineWidth=1; g.strokeRect(px+1,py+1,w-2,h-2);
        for(let i=0;i<10;i++){
          g.fillStyle = rnd()>0.5 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.05)";
          g.fillRect(px+rnd()*w, py+rnd()*h, rnd()*3+1, rnd()*3+1);
        }
      }
    }
    const vg = g.createRadialGradient(CANVAS_W/2, CANVAS_H/2, 200, CANVAS_W/2, CANVAS_H/2, 600);
    vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.75)");
    g.fillStyle = vg; g.fillRect(0,0,CANVAS_W,CANVAS_H);
    return cv;
  }

  /* -------------------------------- 动作 -------------------------------- */
  action(name){
    if(name === "sound"){ AudioManager.toggle(); return; }
    if(name === "pause"){ this.togglePause(); return; }
    if(this.mode !== "playing" || this.phase !== "control" || !this.piece) return;
    switch(name){
      case "left":      this.move(-1); break;
      case "right":     this.move(1); break;
      case "softDrop":  this.softDrop(); break;
      case "rotateCW":  this.rotate(1); break;
      case "rotateCCW": this.rotate(-1); break;
      case "hardDrop":  this.hardDrop(); break;
    }
  }

  start(){
    this.board.reset(); this.effects.clear(); PieceFactory.reset();
    this.resetStats();
    this.mode = "playing"; this.phase = "control";
    this.nextPiece = PieceFactory.next();
    this.spawn();
  }
  togglePause(){
    if(this.mode === "playing") this.mode = "paused";
    else if(this.mode === "paused") this.mode = "playing";
    AudioManager.play("click");
  }
  spawn(){
    this.piece = this.nextPiece;
    this.nextPiece = PieceFactory.next();
    this.dropT = 0; this.lockT = 0; this.lockResets = 0;
    this.phase = "control";
    if(CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col))
      this.gameOver();
  }
  gameOver(){
    this.mode = "gameover"; this.piece = null;
    if(this.score > this.high){ this.high = this.score; Storage.set("bf_high", this.high); }
    this.effects.shake(12, 0.5);
    AudioManager.play("over");
    AudioManager.vibrate(120);
  }

  move(d){
    if(!CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col+d)){
      this.piece.col += d;
      AudioManager.play("move");
      this.resetLock();
    }
  }
  rotate(d){
    if(CollisionSystem.tryRotate(this.board, this.piece, d)){
      AudioManager.play("rotate");
      this.resetLock();
    }
  }
  softDrop(){
    if(!CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row+1, this.piece.col)){
      this.piece.row++; this.score += 1; this.dropT = 0;
    }
  }
  hardDrop(){
    const d = CollisionSystem.dropDistance(this.board, this.piece);
    this.piece.row += d; this.score += d*2;
    this.effects.shake(4 + d*0.35, 0.16);
    AudioManager.play("hard");
    AudioManager.vibrate(20);
    this.lockPiece();
  }
  resetLock(){
    if(this.lockT > 0 && this.lockResets < MAX_LOCK_RESET){ this.lockT = 0; this.lockResets++; }
  }
  lockPiece(){
    const p = this.piece, n = p.matrix.length;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!p.matrix[y][x]) continue;
      const r = p.row+y, c = p.col+x;
      if(r < 0){ this.gameOver(); return; }
      const cell = this.board.makeCell(p.color);
      cell.squash = 0.5;
      this.board.grid[r][c] = cell;
      this.effects.dust(BX + c*CELL + CELL/2, BY + r*CELL + CELL, 2);
    }
    this.piece = null;
    AudioManager.play("land");
    this.chain = 0;
    ClearSystem.checkChain(this);
  }

  /* -------------------------------- 更新 -------------------------------- */
  update(dt){
    this.level = ScoreSystem.levelFor(this.score);
    this.effects.update(dt);
    this.input.update(dt);
    if(this.mode !== "playing"){
      if(this.mode === "gameover") GravitySystem.update(this.board, dt, this.effects, 1);
      return;
    }
    const speedMul = 1 + (this.level-1)*0.06;

    switch(this.phase){
      case "control": {
        if(!this.piece) break;
        const h = this.input.held;
        if(h.left || h.right){
          this.dasT += dt;
          if(this.dasT >= DAS){
            this.arrT += dt;
            if(this.arrT >= ARR){ this.arrT = 0; this.move(h.left ? -1 : 1); }
          }
        } else { this.dasT = 0; this.arrT = 0; }
        if(h.down){
          this.softT += dt;
          if(this.softT >= SOFT_RATE){ this.softT = 0; this.softDrop(); }
        }
        this.dropT += dt;
        if(this.dropT >= ScoreSystem.dropInterval(this.level)){
          this.dropT = 0;
          if(!CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row+1, this.piece.col))
            this.piece.row++;
        }
        const landed = CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row+1, this.piece.col);
        if(landed){ this.lockT += dt; if(this.lockT >= LOCK_DELAY) this.lockPiece(); }
        else this.lockT = 0;
        GravitySystem.update(this.board, dt, this.effects, speedMul);
        break;
      }
      case "flash": {
        this.timer += dt;
        for(const r of this.clearRows){
          const t = 0.45 + 0.55*Math.abs(Math.sin(this.timer*26));
          for(let c=0;c<COLS;c++){ const cell = this.board.grid[r][c]; if(cell) cell.flash = t; }
        }
        if(this.timer >= 0.32) ClearSystem.breakRows(this);
        break;
      }
      case "breakPause": {
        this.timer += dt;
        GravitySystem.update(this.board, dt, this.effects, speedMul);
        if(this.timer >= 0.10) ClearSystem.runGravity(this);
        break;
      }
      case "gravity": {
        if(!GravitySystem.update(this.board, dt, this.effects, speedMul)){
          this.phase = "settlePause"; this.timer = 0;
        }
        break;
      }
      case "settlePause": {
        this.timer += dt;
        GravitySystem.update(this.board, dt, this.effects, speedMul);
        if(this.timer >= 0.08) ClearSystem.checkChain(this);
        break;
      }
    }
  }

  /* -------------------------------- 绘制 -------------------------------- */
  draw(){
    const ctx = this.ctx;
    this.buttons = [];
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    ctx.drawImage(this.bg, 0, 0);

    const off = this.effects.shakeOffset();
    ctx.save(); ctx.translate(off[0], off[1]);
    BoardRenderer.frame(ctx, FRAME);
    ctx.save();
    ctx.beginPath(); ctx.rect(BX, BY, BOARD_W, BOARD_H); ctx.clip();
    BoardRenderer.well(ctx);
    this.drawCells(ctx);
    if(this.mode === "playing" && this.phase === "control" && this.piece) this.drawPiece(ctx);
    this.effects.draw(ctx);
    ctx.restore();
    ctx.restore();

    this.drawTopBar(ctx);
    this.drawStats(ctx);
    this.drawPad(ctx);

    if(this.mode === "menu") this.drawMenu(ctx);
    else if(this.mode === "paused") this.drawPause(ctx);
    else if(this.mode === "gameover") this.drawGameOver(ctx);
  }

  drawCells(ctx){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const cell = this.board.grid[r][c];
      if(!cell) continue;
      BrickRenderer.draw(ctx, BX + c*CELL, BY + r*CELL + cell.dy, cell.color, cell.variant,
                         { squash: cell.squash, flash: cell.flash });
    }
  }
  drawPiece(ctx){
    const p = this.piece, n = p.matrix.length;
    const gd = CollisionSystem.dropDistance(this.board, p);
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!p.matrix[y][x]) continue;
      const r = p.row + gd + y, c = p.col + x;
      if(r >= 0) BrickRenderer.drawGhost(ctx, BX + c*CELL, BY + r*CELL, p.color);
    }
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!p.matrix[y][x]) continue;
      const r = p.row + y, c = p.col + x;
      if(r >= 0) BrickRenderer.draw(ctx, BX + c*CELL, BY + r*CELL, p.color, (r*3+c), { glow:true });
    }
  }

  drawTopBar(ctx){
    ctx.save();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
    const g = ctx.createLinearGradient(0, 10, 0, 36);
    g.addColorStop(0,"#ffe9e2"); g.addColorStop(1,"#e2607d");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText("砖块消消落", 16, 26);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "#8d7276";
    ctx.fillText("LV " + this.level, 132, 27);
    ctx.restore();

    const pause = { id:"pause", x:CANVAS_W-92, y:8, w:38, h:38, r:9, font:16,
                    label: this.mode==="paused" ? "▶" : "❚❚",
                    action: ()=>{ if(this.mode==="playing"||this.mode==="paused") this.togglePause(); } };
    const sound = { id:"sound", x:CANVAS_W-46, y:8, w:38, h:38, r:9, font:16,
                    label: AudioManager.enabled ? "♪" : "✕",
                    action: ()=>AudioManager.toggle() };
    this.buttons.push(pause, sound);
    Hud.button(ctx, pause, this.activeBtn === "pause");
    Hud.button(ctx, sound, this.activeBtn === "sound");
  }

  drawStats(ctx){
    Hud.panel(ctx, 10, 52, 288, 62);
    Hud.stat(ctx, 66,  62, "分数", this.score, "#ffd9c8", 22);
    Hud.stat(ctx, 154, 62, "最高", Math.max(this.high, this.score), "#e8b6bd", 18);
    Hud.stat(ctx, 242, 62, "连锁", this.chain > 0 ? this.chain : this.maxCombo, "#f0a0b4", 18);

    Hud.panel(ctx, 306, 52, 164, 62);
    ctx.save();
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "#a2858a"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("下一个", 318, 62);
    ctx.restore();
    if(this.nextPiece){
      const p = this.nextPiece, n = p.matrix.length;
      let minX=9,maxX=-1,minY=9,maxY=-1;
      for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(p.matrix[y][x]){
        if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
      const s = 15;
      const pw = (maxX-minX+1)*s, ph = (maxY-minY+1)*s;
      const ox = 306 + 164*0.62 - pw/2, oy = 52 + 31 - ph/2;
      for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++){
        if(!p.matrix[y][x]) continue;
        const tex = TextureFactory.get(p.color, y*3+x);
        ctx.save();
        ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=4; ctx.shadowOffsetY=2;
        ctx.drawImage(tex, ox+(x-minX)*s, oy+(y-minY)*s, s, s);
        ctx.restore();
      }
    }
  }

  drawPad(ctx){
    const y1 = PAD_TOP, y2 = PAD_TOP + 66, h = 58, w = 144;
    const xs = [14, 168, 322];
    const defs = [
      { id:"ccw",  x:xs[0], y:y1, w, h, label:"↺", sub:"逆时针", act:"rotateCCW" },
      { id:"cw",   x:xs[1], y:y1, w, h, label:"↻", sub:"顺时针", act:"rotateCW" },
      { id:"hard", x:xs[2], y:y1, w, h, label:"⤓", sub:"硬降", act:"hardDrop", primary:true },
      { id:"left", x:xs[0], y:y2, w, h, label:"◀", sub:"左移", act:"left", repeat:true },
      { id:"down", x:xs[1], y:y2, w, h, label:"▼", sub:"软降", act:"softDrop", repeat:true },
      { id:"right",x:xs[2], y:y2, w, h, label:"▶", sub:"右移", act:"right", repeat:true }
    ];
    for(const d of defs){
      const b = { id:d.id, x:d.x, y:d.y, w:d.w, h:d.h, r:12, font:24,
                  label:d.label, sub:d.sub, primary:d.primary, repeat:d.repeat,
                  action: ()=>this.action(d.act) };
      this.buttons.push(b);
      Hud.button(ctx, b, this.activeBtn === d.id);
    }
  }

  drawMenu(ctx){
    Hud.overlay(ctx, 0.84);
    Hud.title(ctx, "砖块消消落", 250, 40, "BRICK FALL");
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = '500 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "#95787c";
    const lines = [
      "消除满行后，上方砖块不会整体下移。",
      "每一块砖独立受重力坠落，可能堆出新的满行，",
      "触发连锁：×1 → ×1.5 → ×2 → ×3。",
      "",
      "棋盘上左右滑动移动，轻点旋转，快速下滑硬降。"
    ];
    lines.forEach((t,i)=> ctx.fillText(t, CANVAS_W/2, 340 + i*24));
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "#d8a3ad";
    ctx.fillText("历史最高分  " + this.high, CANVAS_W/2, 500);
    ctx.restore();
    const b1 = { id:"m1", x:CANVAS_W/2-110, y:552, w:220, h:56, r:12, font:18,
                 label:"开始游戏", primary:true, action:()=>this.start() };
    const b2 = { id:"m2", x:CANVAS_W/2-110, y:622, w:220, h:46, r:12, font:15,
                 label: AudioManager.enabled ? "音效：开" : "音效：关",
                 action:()=>AudioManager.toggle() };
    this.buttons.push(b1,b2);
    Hud.button(ctx,b1,this.activeBtn==="m1");
    Hud.button(ctx,b2,this.activeBtn==="m2");
  }
  drawPause(ctx){
    Hud.overlay(ctx, 0.74);
    Hud.title(ctx, "已暂停", 300, 34, "方块已停止下落");
    const bs = [
      { id:"p1", label:"继续游戏", primary:true, y:400, h:52, action:()=>this.togglePause() },
      { id:"p2", label:"重新开始", y:466, h:46, action:()=>this.start() },
      { id:"p3", label:"返回首页", y:524, h:46, action:()=>{ this.mode="menu"; } }
    ];
    for(const s of bs){
      const b = { id:s.id, x:CANVAS_W/2-110, y:s.y, w:220, h:s.h, r:12, font:16,
                  label:s.label, primary:s.primary, action:s.action };
      this.buttons.push(b);
      Hud.button(ctx, b, this.activeBtn === s.id);
    }
  }
  drawGameOver(ctx){
    Hud.overlay(ctx, 0.84);
    const isNew = this.score >= this.high && this.score > 0;
    Hud.title(ctx, "游戏结束", 250, 36, isNew ? "新纪录！" : "砖墙堆到顶了");
    const stats = [["本局得分",this.score],["历史最高",this.high],
                   ["最大连锁",this.maxCombo],["达到等级",this.level],["消除行数",this.lines]];
    stats.forEach((s,i)=>{
      const col = i % 3, rowI = (i/3)|0;
      const cx = 80 + col*160, cy = 350 + rowI*74;
      Hud.stat(ctx, cx, cy, s[0], s[1], "#ffd9c8", 24);
    });
    const b1 = { id:"g1", x:CANVAS_W/2-110, y:530, w:220, h:56, r:12, font:18,
                 label:"再来一局", primary:true, action:()=>this.start() };
    const b2 = { id:"g2", x:CANVAS_W/2-110, y:600, w:220, h:46, r:12, font:15,
                 label:"返回首页", action:()=>{ this.mode="menu"; } };
    this.buttons.push(b1,b2);
    Hud.button(ctx,b1,this.activeBtn==="g1");
    Hud.button(ctx,b2,this.activeBtn==="g2");
  }

  /* ------------------------------- 主循环 ------------------------------- */
  loop(now){
    let dt = (now - this.last) / 1000;
    this.last = now;
    if(dt > 0.1) dt = 0.1;
    // 低端机自动降级：连续 90 帧平均超过 24ms 则减少粒子
    this.frameAcc += dt; this.frameN++;
    if(this.frameN >= 90){
      if(this.frameAcc / this.frameN > 0.024) this.lowFx = true;
      this.frameAcc = 0; this.frameN = 0;
    }
    const slow = this.effects.slowmo > 0 ? 0.35 : 1;
    this.update(dt * slow);
    this.draw();
    requestAnimationFrame((t)=>this.loop(t));
  }
}
