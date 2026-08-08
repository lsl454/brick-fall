import { CANVAS_W, CANVAS_H, CELL, BX, BY, BOARD_W, BOARD_H } from "./constants.js";

/**
 * 输入层：把触摸、鼠标、键盘统一收敛成动作事件交给 Game。
 * 触控支持两套操作，玩家可混用：
 *   A. 底部虚拟按键（长按连发）
 *   B. 棋盘区手势：横向拖动逐格移动、轻点旋转、快速下滑硬降、慢速下滑软降
 */
export class Input {
  constructor(canvas, game){
    this.cv = canvas; this.game = game;
    this.pointers = new Map();          // pointerId -> 状态
    this.held = { left:false, right:false, down:false };
    this.bindPointer();
    this.bindKeyboard();
  }

  toLocal(e){
    const r = this.cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (CANVAS_W / r.width),
      y: (e.clientY - r.top)  * (CANVAS_H / r.height)
    };
  }
  hit(b,p){ return p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h; }
  inBoard(p){ return p.x>=BX-20 && p.x<=BX+BOARD_W+20 && p.y>=BY && p.y<=BY+BOARD_H; }

  bindPointer(){
    const cv = this.cv;
    cv.style.touchAction = "none";

    cv.addEventListener("pointerdown", (e)=>{
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const p = this.toLocal(e);
      this.game.wakeAudio();

      // 1) 先判断是否命中按钮
      for(const b of this.game.buttons){
        if(this.hit(b,p)){
          this.pointers.set(e.pointerId, { kind:"button", btn:b, repeatT:0, dasDone:false });
          this.game.activeBtn = b.id;
          if(b.action) b.action();
          return;
        }
      }
      // 2) 棋盘手势
      if(this.game.mode === "playing" && this.inBoard(p)){
        this.pointers.set(e.pointerId, {
          kind:"gesture", sx:p.x, sy:p.y, lx:p.x, ly:p.y,
          movedCols:0, dragDown:0, t0:performance.now(), moved:false
        });
      } else {
        this.pointers.set(e.pointerId, { kind:"none" });
      }
    }, { passive:false });

    cv.addEventListener("pointermove", (e)=>{
      const st = this.pointers.get(e.pointerId);
      if(!st) return;
      const p = this.toLocal(e);
      if(st.kind === "button"){
        // 手指滑出按钮则取消
        if(!this.hit(st.btn,p)){
          this.pointers.set(e.pointerId, { kind:"none" });
          this.game.activeBtn = null;
        }
        return;
      }
      if(st.kind !== "gesture") return;

      const dx = p.x - st.lx, dy = p.y - st.ly;
      if(Math.abs(p.x-st.sx) > 8 || Math.abs(p.y-st.sy) > 8) st.moved = true;

      // 横向：每滑过一个格宽移动一格
      if(Math.abs(dx) >= CELL*0.72){
        const dir = dx > 0 ? 1 : -1;
        this.game.action(dir > 0 ? "right" : "left");
        st.lx = p.x; st.movedCols++;
      }
      // 纵向下滑：软降
      if(dy >= CELL*0.62){
        this.game.action("softDrop");
        st.ly = p.y; st.dragDown++;
      }
    }, { passive:false });

    const end = (e)=>{
      const st = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      this.game.activeBtn = null;
      if(!st) return;
      if(st.kind === "gesture"){
        const p = this.toLocal(e);
        const dt = (performance.now() - st.t0) / 1000;
        const totalY = p.y - st.sy, totalX = p.x - st.sx;
        // 快速下滑 = 硬降
        if(totalY > CELL*2.2 && dt < 0.32 && Math.abs(totalX) < Math.abs(totalY)){
          this.game.action("hardDrop");
        } else if(!st.moved && dt < 0.35){
          // 轻点 = 顺时针旋转
          this.game.action("rotateCW");
        }
      }
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("contextmenu",(e)=>e.preventDefault());
  }

  /** 每帧调用：处理虚拟按键的长按连发 */
  update(dt){
    for(const st of this.pointers.values()){
      if(st.kind !== "button" || !st.btn.repeat) continue;
      st.repeatT += dt;
      const delay = st.dasDone ? 0.055 : 0.20;
      if(st.repeatT >= delay){
        st.repeatT = 0; st.dasDone = true;
        st.btn.action();
      }
    }
  }

  bindKeyboard(){
    const blocked = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"," "];
    window.addEventListener("keydown",(e)=>{
      if(blocked.includes(e.key) || blocked.includes(e.code)) e.preventDefault();
      this.game.wakeAudio();
      if(e.repeat) return;
      const g = this.game, k = e.code;
      if(k === "KeyM"){ g.action("sound"); return; }
      if(g.mode === "menu"){ if(k==="Enter"||k==="Space") g.start(); return; }
      if(g.mode === "gameover"){
        if(k==="KeyR"||k==="Enter"||k==="Space") g.start();
        else if(k==="Escape") g.mode = "menu";
        return;
      }
      if(k==="KeyP"||k==="Escape"){ g.togglePause(); return; }
      if(k==="KeyR"){ g.start(); return; }
      switch(k){
        case "ArrowLeft": case "KeyA":  this.held.left=true;  g.action("left"); break;
        case "ArrowRight":case "KeyD":  this.held.right=true; g.action("right"); break;
        case "ArrowDown": case "KeyS":  this.held.down=true;  g.action("softDrop"); break;
        case "ArrowUp":   case "KeyW":  g.action("rotateCW"); break;
        case "KeyQ":                    g.action("rotateCCW"); break;
        case "Space":                   g.action("hardDrop"); break;
      }
    });
    window.addEventListener("keyup",(e)=>{
      const k = e.code;
      if(k==="ArrowLeft"||k==="KeyA")  this.held.left=false;
      if(k==="ArrowRight"||k==="KeyD") this.held.right=false;
      if(k==="ArrowDown"||k==="KeyS")  this.held.down=false;
    });
  }
}
