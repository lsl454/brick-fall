import { CANVAS_W, CANVAS_H, COLS, ROWS, CELL, BX, BY, BOARD_W, BOARD_H, FRAME, ENERGY_Y, SKILL_Y, DAS, ARR, SOFT_RATE, LOCK_DELAY, MAX_LOCK_RESET, SKILLS, ENERGY_MAX, UI, PALETTE, VIVID } from "./constants.js";
import { mulberry32, clamp, shadeA, roundRect, hexToRgb, Storage } from "./utils.js";
import { TextureFactory } from "./textures.js";
import { BrickRenderer, BoardRenderer, Bloom } from "./renderer.js";
import { Board } from "./board.js";
import { PieceFactory, makePiece } from "./pieces.js";
import { CollisionSystem } from "./collision.js";
import { GravitySystem } from "./gravity.js";
import { ScoreSystem } from "./score.js";
import { ClearSystem } from "./clear.js";
import { SkillSystem } from "./skills.js";
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
    this.mode = "menu";
    this.phase = "control";
    this.buttons = [];
    this.activeBtn = null;
    this.high = Storage.get("bf_high", 0);
    this.timer = 0; this.clearRows = [];
    this.t = 0;
    // 画质档位：2 高（泛光+全粒子） / 1 中（泛光减弱、粒子减半） / 0 低（关泛光）
    this.fxTier = 2; this.lowFx = false;
    this.frameAcc = 0; this.frameN = 0; this.tierCool = 0;
    // 静态棋盘缓存：没有动画时整块棋盘只画一次
    this.boardCache = document.createElement("canvas");
    this.boardCache.width = BOARD_W; this.boardCache.height = BOARD_H;
    this.boardCacheCtx = this.boardCache.getContext("2d");
    this.cacheVersion = -1;
    this.wellTex = BoardRenderer.buildWell();
    this.bg = this.makeBackdrop();
    this.embers = this.makeEmbers();
    this.pieceCells = [];
    this.resetStats();
    this.input = new Input(canvas, this);
    this.last = performance.now();
    requestAnimationFrame((t)=>this.loop(t));
  }

  resetStats(){
    this.score = 0; this.lines = 0; this.chain = 0; this.maxCombo = 0;
    this.level = 1; this.dropT = 0; this.lockT = 0; this.lockResets = 0;
    this.dasT = 0; this.arrT = 0; this.softT = 0;
    this.energy = 0; this.chronoT = 0; this.skillsUsed = 0;
    this.holdType = null; this.holdUsed = false;
    this.piece = null; this.nextPiece = null; this.pendingPiece = null;
  }
  wakeAudio(){ AudioManager.init(); }
  addEnergy(v){ this.energy = clamp(this.energy + v, 0, ENERGY_MAX); }

  /* --------------------------- 背景：炫彩马赛克 --------------------------- */
  makeBackdrop(){
    const cv = document.createElement("canvas");
    cv.width = CANVAS_W; cv.height = CANVAS_H;
    const g = cv.getContext("2d");
    const rnd = mulberry32(20260808);
    const bw = 56, bh = 38;
    for(let y=-bh,row=0; y<CANVAS_H+bh; y+=bh, row++){
      const off = (row % 2) * bw/2;
      for(let x=-bw; x<CANVAS_W+bw; x+=bw){
        const col = VIVID[(rnd()*VIVID.length)|0];
        const light = 0.30 + rnd()*0.34;
        const [r,gg,b] = hexToRgb(col);
        const px=x+off+2, py=y+2, w=bw-4, h=bh-4;
        g.fillStyle = "rgb("+((r*light)|0)+","+((gg*light)|0)+","+((b*light)|0)+")";
        g.fillRect(px,py,w,h);
        g.strokeStyle="rgba(0,0,0,.42)"; g.lineWidth=2; g.strokeRect(px,py,w,h);
        g.strokeStyle="rgba(255,255,255,.18)"; g.lineWidth=1; g.strokeRect(px+1,py+1,w-2,h-2);
        g.fillStyle="rgba(255,255,255,.10)";
        g.fillRect(px+bw*0.18, py+bh*0.14, w*0.5, 2);
      }
    }
    const vg = g.createRadialGradient(CANVAS_W/2, CANVAS_H*0.45, 180, CANVAS_W/2, CANVAS_H/2, 600);
    vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.42)");
    g.fillStyle = vg; g.fillRect(0,0,CANVAS_W,CANVAS_H);
    return cv;
  }
  makeEmbers(){
    const a=[];
    for(let i=0;i<26;i++) a.push({
      x:Math.random()*CANVAS_W, y:Math.random()*CANVAS_H,
      vy:-6-Math.random()*16, vx:(Math.random()-0.5)*6,
      r:0.6+Math.random()*1.6, p:Math.random()*6.283,
      c: VIVID[(Math.random()*VIVID.length)|0]
    });
    return a;
  }
  drawEmbers(ctx, dt){
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    const n = this.fxTier >= 2 ? this.embers.length : (this.embers.length>>1);
    for(let i=0;i<n;i++){ const e = this.embers[i];
      e.y += e.vy*dt; e.x += e.vx*dt; e.p += dt*2;
      if(e.y < -10){ e.y = CANVAS_H+10; e.x = Math.random()*CANVAS_W; }
      ctx.globalAlpha = 0.18 + 0.20*Math.abs(Math.sin(e.p));
      ctx.fillStyle = e.c;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  /* -------------------------------- 动作 -------------------------------- */
  action(name){
    if(name === "sound"){ AudioManager.toggle(); return; }
    if(name === "pause"){ this.togglePause(); return; }
    if(name.indexOf("skill:") === 0){ SkillSystem.use(this, name.slice(6)); return; }
    if(this.mode !== "playing" || this.phase !== "control" || !this.piece) return;
    switch(name){
      case "left":      this.move(-1); break;
      case "right":     this.move(1); break;
      case "softDrop":  this.softDrop(); break;
      case "rotateCW":  this.rotate(1); break;
      case "rotateCCW": this.rotate(-1); break;
      case "hardDrop":  this.hardDrop(); break;
      case "hold":      this.doHold(); break;
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
  /** 技能寄存的方块优先归还，避免流程末尾顶掉玩家手里的方块 */
  spawn(){
    if(this.pendingPiece){
      this.piece = this.pendingPiece; this.pendingPiece = null;
      this.phase = "control"; this.lockT = 0;
      if(CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col)){
        const p = this.piece;
        while(p.row > -2 && CollisionSystem.collides(this.board,p.matrix,p.row,p.col)) p.row--;
      }
      return;
    }
    this.piece = this.nextPiece;
    this.nextPiece = PieceFactory.next();
    this.dropT = 0; this.lockT = 0; this.lockResets = 0;
    this.holdUsed = false;
    this.phase = "control";
    if(CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col))
      this.gameOver();
  }
  gameOver(){
    this.mode = "gameover"; this.piece = null;
    if(this.score > this.high){ this.high = this.score; Storage.set("bf_high", this.high); }
    this.effects.shake(14, 0.55);
    AudioManager.play("over");
    AudioManager.vibrate(140);
  }

  doHold(){
    if(this.holdUsed) return;
    const cur = this.piece.type;
    if(this.holdType === null){
      this.holdType = cur;
      this.piece = this.nextPiece;
      this.nextPiece = PieceFactory.next();
    } else {
      const swap = this.holdType;
      this.holdType = cur;
      this.piece = makePiece(swap);
    }
    this.holdUsed = true;
    this.dropT = 0; this.lockT = 0; this.lockResets = 0;
    AudioManager.play("rotate");
    if(CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col))
      this.gameOver();
  }

  move(d){
    if(!CollisionSystem.collides(this.board, this.piece.matrix, this.piece.row, this.piece.col+d)){
      this.piece.col += d; AudioManager.play("move"); this.resetLock();
    }
  }
  rotate(d){
    if(CollisionSystem.tryRotate(this.board, this.piece, d)){
      AudioManager.play("rotate"); this.resetLock();
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
    AudioManager.play("hard"); AudioManager.vibrate(20);
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
      const cell = this.board.makeCell(p.type);
      cell.squash = 0.5;
      this.board.grid[r][c] = cell;
      this.effects.dust(BX + c*CELL + CELL/2, BY + r*CELL + CELL, 2);
    }
    this.board.touch();
    this.piece = null;
    this.effects.ring(BX + (p.col+1)*CELL, BY + Math.max(0,p.row+1)*CELL, "#ffffff");
    AudioManager.play("land");
    this.chain = 0;
    this.addEnergy(1);
    ClearSystem.checkChain(this);
  }

  /* -------------------------------- 更新 -------------------------------- */
  update(dt){
    this.t += dt;
    this.level = ScoreSystem.levelFor(this.score);
    this.effects.update(dt);
    this.input.update(dt);
    if(this.mode !== "playing"){
      if(this.mode === "gameover") GravitySystem.update(this.board, dt, this.effects, 1);
      return;
    }
    if(this.chronoT > 0) this.chronoT = Math.max(0, this.chronoT - dt);
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
        let interval = ScoreSystem.dropInterval(this.level);
        if(this.chronoT > 0) interval *= 2;
        if(this.dropT >= interval){
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
          const v = 0.45 + 0.55*Math.abs(Math.sin(this.timer*26));
          for(let c=0;c<COLS;c++){ const cell = this.board.grid[r][c]; if(cell) cell.flash = v; }
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
  draw(dt){
    const ctx = this.ctx;
    this.buttons = [];
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    ctx.drawImage(this.bg, 0, 0);
    if(this.fxTier >= 1) this.drawEmbers(ctx, dt);

    if(this.fxTier >= 1) Bloom.begin();

    const off = this.effects.shakeOffset();
    ctx.save(); ctx.translate(off[0], off[1]);
    BoardRenderer.frame(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(BX, BY, BOARD_W, BOARD_H); ctx.clip();
    ctx.drawImage(this.wellTex, BX, BY);
    if(this.mode === "playing" && this.board.topRow() <= 4) BoardRenderer.danger(ctx, this.t);

    this.drawBoardLayer(ctx);
    if(this.mode === "playing" && this.phase === "control" && this.piece) this.drawPiece(ctx);
    this.effects.draw(ctx);
    ctx.restore();
    ctx.restore();

    // 泛光：把亮部糊开后整屏叠一次
    if(this.fxTier >= 1){
      this.maskBoard();
      this.effects.maskTo(Bloom);
      Bloom.composite(ctx, this.fxTier >= 2 ? 0.85 : 0.55);
    }
    this.effects.drawScreen(ctx, CANVAS_W, CANVAS_H);

    this.drawTopBar(ctx);
    this.drawEnergy(ctx);
    this.drawSkills(ctx);

    if(this.mode === "menu") this.drawMenu(ctx);
    else if(this.mode === "paused") this.drawPause(ctx);
    else if(this.mode === "gameover") this.drawGameOver(ctx);
  }

  /** 棋盘层：静止时走缓存，只在有动画或结构变化时重绘 */
  drawBoardLayer(ctx){
    const dyn = this.board.dynamic();
    if(dyn || this.cacheVersion !== this.board.version){
      const c = this.boardCacheCtx;
      c.clearRect(0, 0, BOARD_W, BOARD_H);
      for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++){
        const cell = this.board.grid[r][col];
        if(!cell) continue;
        const x = col*CELL, y = r*CELL + cell.dy;
        if(cell.falling && cell.vy > 260 && this.fxTier >= 1)
          BrickRenderer.streak(c, x, y, cell.type, cell.vy);
        BrickRenderer.draw(c, x, y, cell.type, cell.variant,
                           { squash: cell.squash, flash: cell.flash });
      }
      this.cacheVersion = dyn ? -1 : this.board.version;
    }
    ctx.drawImage(this.boardCache, BX, BY);
  }

  /** 把棋盘与当前方块的亮部喂给 Bloom */
  maskBoard(){
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++){
      const cell = this.board.grid[r][col];
      if(!cell) continue;
      const light = TextureFactory.lightOf(cell.type);
      Bloom.mask(BX + col*CELL + 5, BY + r*CELL + cell.dy + 5, CELL-10, CELL-10,
                 light, cell.flash ? 0.95 : 0.34);
    }
    if(this.piece && this.phase === "control"){
      const light = TextureFactory.lightOf(this.piece.type);
      const a = 0.5 + 0.12*Math.sin(this.t*5);
      for(const c of this.pieceCells)
        Bloom.mask(c.x + 4, c.y + 4, CELL-8, CELL-8, light, a);
    }
  }

  drawPiece(ctx){
    const p = this.piece, n = p.matrix.length;
    const gd = CollisionSystem.dropDistance(this.board, p);
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!p.matrix[y][x]) continue;
      const r = p.row + gd + y, c = p.col + x;
      if(r >= 0) BrickRenderer.drawGhost(ctx, BX + c*CELL, BY + r*CELL, p.type);
    }
    this.pieceCells.length = 0;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!p.matrix[y][x]) continue;
      const r = p.row + y, c = p.col + x;
      if(r < 0) continue;
      const px = BX + c*CELL, py = BY + r*CELL;
      this.pieceCells.push({ x:px, y:py });
      BrickRenderer.draw(ctx, px, py, p.type, r*3+c, {});
    }
    if(this.fxTier >= 2) BrickRenderer.sweep(ctx, this.pieceCells, this.t);
  }

  /** 顶栏：暂停 + 暂存 + 分数 + 下一个，只有这四样 */
  drawTopBar(ctx){
    const pause = { id:"pause", x:8, y:8, w:30, h:30, r:15, font:12,
                    label: this.mode==="paused" ? "\u25b6" : "\u275a\u275a",
                    action: ()=>{ if(this.mode==="playing"||this.mode==="paused") this.togglePause(); } };
    this.buttons.push(pause);
    Hud.button(ctx, pause, this.activeBtn === "pause");

    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";

    // 分数
    ctx.font='700 30px "Segoe UI", system-ui, sans-serif';
    const g=ctx.createLinearGradient(CANVAS_W/2-50,0,CANVAS_W/2+50,0);
    g.addColorStop(0,"#ffb340"); g.addColorStop(0.3,"#ff4fa8");
    g.addColorStop(0.6,"#b06cff"); g.addColorStop(1,"#1fd7ff");
    ctx.fillStyle=g;
    ctx.shadowColor="rgba(176,108,255,.6)"; ctx.shadowBlur=8;
    ctx.fillText(this.score, CANVAS_W/2, 32);
    ctx.shadowBlur=0;
    ctx.font='500 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.textDim;
    let sub = "\u6700\u9ad8 " + Math.max(this.high,this.score) + "   \u00b7   \u7b49\u7ea7 " + this.level;
    if(this.chronoT > 0) sub = "\u7f13\u65f6 " + this.chronoT.toFixed(1) + "s";
    else if(this.chain > 1) sub = "\u8fde\u9501 " + this.chain;
    ctx.fillText(sub, CANVAS_W/2, 58);

    // 暂存 / 下一个
    ctx.font='500 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle="#ffb3e6";
    ctx.fillText("\u6682\u5b58", 76, 70);
    ctx.fillText("\u4e0b\u4e00\u4e2a", 410, 70);
    ctx.restore();

    if(this.holdType) Hud.miniPiece(ctx, makePiece(this.holdType), 76, 38, 12, this.holdUsed ? 0.3 : 1);
    Hud.miniPiece(ctx, this.nextPiece, 410, 38, 12, 1);
  }

  /** 法力：一条贴着棋盘下沿的细线 */
  drawEnergy(ctx){
    const w = BOARD_W, x = BX;
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.06)";
    roundRect(ctx, x, ENERGY_Y, w, 4, 2); ctx.fill();
    const ratio = clamp(this.energy/ENERGY_MAX, 0, 1);
    if(ratio > 0.01){
      const g=ctx.createLinearGradient(x,0,x+w,0);
      g.addColorStop(0,"#1fd7ff"); g.addColorStop(0.3,"#2fe39b");
      g.addColorStop(0.55,"#ffb340"); g.addColorStop(0.8,"#ff4fa8"); g.addColorStop(1,"#b06cff");
      ctx.fillStyle=g;
      roundRect(ctx, x, ENERGY_Y, w*ratio, 4, 2); ctx.fill();
      ctx.shadowColor="#b06cff"; ctx.shadowBlur=8;
      roundRect(ctx, x, ENERGY_Y, w*ratio, 4, 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 底部四枚圆形技能符文，界面上仅剩的操作控件 */
  drawSkills(ctx){
    const d = 44, cxs = [120, 200, 280, 360];
    SKILLS.forEach((s,i)=>{
      const ready = this.energy >= s.cost && this.mode === "playing" && this.phase === "control";
      const b = { id:"sk_"+s.id, x:cxs[i]-d/2, y:SKILL_Y, w:d, h:d,
                  name:s.name, glyph:s.glyph, cost:s.cost, color:s.color,
                  action: ()=>this.action("skill:"+s.id) };
      this.buttons.push(b);
      Hud.skillButton(ctx, b, this.activeBtn === b.id, ready, clamp(this.energy/s.cost,0,1));
    });
  }

  /* ------------------------------ 覆盖界面 ------------------------------ */
  drawMenu(ctx){
    Hud.overlay(ctx, 0.48);
    Hud.title(ctx, "\u5b9d\u77f3\u574d\u7f29", 190, 40, "GEM COLLAPSE");
    Hud.divider(ctx, 250, 300);
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font='500 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.textDim;
    [ "\u6d88\u884c\u4e0d\u4f1a\u8ba9\u4e0a\u65b9\u6574\u4f53\u4e0b\u79fb\uff0c\u6bcf\u5757\u5b9d\u77f3\u72ec\u7acb\u5760\u843d\uff0c",
      "\u5806\u51fa\u65b0\u6ee1\u884c\u5373\u89e6\u53d1\u8fde\u9501\u3002\u6d88\u884c\u79ef\u8d4b\u6cd5\u529b\uff0c\u7528\u6280\u80fd\u6539\u5199\u6218\u5c40\u3002"
    ].forEach((s,i)=> ctx.fillText(s, CANVAS_W/2, 276 + i*20));
    ctx.font='500 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.goldDim;
    [ "\u5de6\u53f3\u6ed1\u52a8 \u79fb\u52a8     \u00b7     \u8f7b\u70b9 \u65cb\u8f6c     \u00b7     \u53cc\u6307\u8f7b\u70b9 \u53cd\u5411\u65cb\u8f6c",
      "\u5feb\u901f\u4e0b\u6ed1 \u786c\u964d     \u00b7     \u6162\u901f\u4e0b\u62d6 \u8f6f\u964d     \u00b7     \u4e0a\u6ed1 \u6682\u5b58"
    ].forEach((s,i)=> ctx.fillText(s, CANVAS_W/2, 326 + i*18));
    ctx.restore();

    // 技能图鉴
    SKILLS.forEach((s,i)=>{
      const y = 380 + i*46;
      Hud.panel(ctx, 40, y, 400, 40, 6);
      ctx.save();
      ctx.textBaseline="middle";
      ctx.font='600 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle=s.color; ctx.textAlign="center";
      ctx.shadowColor=s.color; ctx.shadowBlur=10;
      ctx.fillText(s.glyph, 62, y+20);
      ctx.shadowBlur=0;
      ctx.textAlign="left";
      ctx.font='600 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle=UI.text; ctx.fillText(s.name, 84, y+20);
      ctx.font='500 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle=UI.textDim; ctx.fillText(s.desc, 130, y+20);
      ctx.textAlign="right";
      ctx.font='600 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle=UI.mana; ctx.fillText(s.cost, 428, y+20);
      ctx.restore();
    });

    ctx.save();
    ctx.textAlign="center"; ctx.font='600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.gold;
    ctx.fillText("\u5386\u53f2\u6700\u9ad8  " + this.high, CANVAS_W/2, 592);
    ctx.restore();

    const b1 = { id:"m1", x:CANVAS_W/2-110, y:620, w:220, h:54, r:10, font:17,
                 label:"\u5f00\u59cb\u6e38\u620f", primary:true, action:()=>this.start() };
    const b2 = { id:"m2", x:CANVAS_W/2-110, y:686, w:220, h:44, r:10, font:14,
                 label: AudioManager.enabled ? "\u97f3\u6548\uff1a\u5f00" : "\u97f3\u6548\uff1a\u5173",
                 action:()=>AudioManager.toggle() };
    this.buttons.push(b1,b2);
    Hud.button(ctx,b1,this.activeBtn==="m1");
    Hud.button(ctx,b2,this.activeBtn==="m2");
  }

  drawPause(ctx){
    Hud.overlay(ctx, 0.58);
    Hud.title(ctx, "\u5c01\u5370\u6682\u6b62", 290, 32, "\u65b9\u5757\u5df2\u505c\u6b62\u4e0b\u843d");
    Hud.divider(ctx, 340, 260);
    const bs = [
      { id:"p1", label:"\u7ee7\u7eed\u6e38\u620f", primary:true, y:396, h:52, action:()=>this.togglePause() },
      { id:"p2", label:"\u91cd\u65b0\u5f00\u59cb", y:462, h:46, action:()=>this.start() },
      { id:"p3", label:"\u8fd4\u56de\u9996\u9875", y:520, h:46, action:()=>{ this.mode="menu"; } }
    ];
    for(const s of bs){
      const b = { id:s.id, x:CANVAS_W/2-110, y:s.y, w:220, h:s.h, r:10, font:15,
                  label:s.label, primary:s.primary, action:s.action };
      this.buttons.push(b);
      Hud.button(ctx, b, this.activeBtn === s.id);
    }
  }

  drawGameOver(ctx){
    Hud.overlay(ctx, 0.62);
    const isNew = this.score >= this.high && this.score > 0;
    Hud.title(ctx, "\u5c01\u5370\u5d29\u89e3", 236, 34, isNew ? "\u5237\u65b0\u4e86\u5386\u53f2\u6700\u9ad8" : "\u7b26\u6587\u77f3\u5806\u5230\u4e86\u9876\u7aef");
    Hud.divider(ctx, 288, 300);
    const stats = [["\u672c\u5c40\u5f97\u5206",this.score],["\u5386\u53f2\u6700\u9ad8",this.high],["\u6700\u5927\u8fde\u9501",this.maxCombo],
                   ["\u6d88\u9664\u884c\u6570",this.lines],["\u8fbe\u5230\u7b49\u7ea7",this.level],["\u91ca\u653e\u6280\u80fd",this.skillsUsed]];
    stats.forEach((s,i)=>{
      const col = i % 3, rowI = (i/3)|0;
      Hud.stat(ctx, 80 + col*160, 322 + rowI*72, s[0], s[1], "#fff0c8", 22);
    });
    const b1 = { id:"g1", x:CANVAS_W/2-110, y:504, w:220, h:54, r:10, font:17,
                 label:"\u518d\u6765\u4e00\u5c40", primary:true, action:()=>this.start() };
    const b2 = { id:"g2", x:CANVAS_W/2-110, y:572, w:220, h:44, r:10, font:14,
                 label:"\u8fd4\u56de\u9996\u9875", action:()=>{ this.mode="menu"; } };
    this.buttons.push(b1,b2);
    Hud.button(ctx,b1,this.activeBtn==="g1");
    Hud.button(ctx,b2,this.activeBtn==="g2");
  }

  /* ------------------------------- 主循环 ------------------------------- */
  loop(now){
    let dt = (now - this.last) / 1000;
    this.last = now;
    if(dt > 0.1) dt = 0.1;
    // 动态画质：连续 60 帧偏慢就降档，明显富余则回升，带冷却避免来回抖
    this.frameAcc += dt; this.frameN++;
    if(this.tierCool > 0) this.tierCool -= dt;
    if(this.frameN >= 60){
      const avg = this.frameAcc / this.frameN;
      if(this.tierCool <= 0){
        if(avg > 0.026 && this.fxTier > 0){ this.fxTier--; this.tierCool = 3; }
        else if(avg < 0.0175 && this.fxTier < 2){ this.fxTier++; this.tierCool = 3; }
      }
      this.lowFx = this.fxTier === 0;
      this.frameAcc = 0; this.frameN = 0;
    }
    const slow = this.effects.slowmo > 0 ? 0.35 : 1;
    this.update(dt * slow);
    this.draw(dt);
    requestAnimationFrame((t)=>this.loop(t));
  }
}
