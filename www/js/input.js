import { CANVAS_W, CANVAS_H, CELL, BX, BY, BOARD_W, BOARD_H } from "./constants.js";

const AXIS_LOCK = 10;   // 位移超过这个像素数就锁定主轴
const AXIS_BIAS = 1.6;  // 纵向优先系数，越大越不容易在速降时误触横移

/**
 * 输入层：把触摸、鼠标、键盘统一收敛成动作事件交给 Game。
 * 极简版：棋盘区全部靠手势操作，界面上只剩暂停与 4 枚技能符文。
 *   横向拖动 → 逐格移动
 *   轻点     → 顺时针旋转
 *   双指轻点 → 逆时针旋转
 *   快速下滑 → 硬降
 *   慢速下拖 → 软降
 *   上滑     → 暂存
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
        // 已有一根手指在棋盘上 → 本次为双指，标记为逆时针旋转
        let multi = false;
        for(const st of this.pointers.values()) if(st.kind === "gesture") multi = true;
        this.pointers.set(e.pointerId, {
          kind:"gesture", sx:p.x, sy:p.y, lx:p.x, ly:p.y, multi, axis:null,
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
        if(!this.hit(st.btn,p)){
          this.pointers.set(e.pointerId, { kind:"none" });
          this.game.activeBtn = null;
        }
        return;
      }
      if(st.kind !== "gesture") return;

      const totalX = p.x - st.sx, totalY = p.y - st.sy;

      // ---- 轴向锁定 ----
      // 手指下滑时几乎不可能走得笔直，稍微偏一点就会顺带触发横移，
      // 表现出来就是"想速降却斜着落下去"。所以一旦判定出主轴，
      // 本次手势就只认这一个方向，另一个轴直接丢弃，直到手指抬起。
      if(st.axis === null){
        const ax = Math.abs(totalX), ay = Math.abs(totalY);
        if(ax > AXIS_LOCK || ay > AXIS_LOCK){
          // 纵向只要占到横向的 1/AXIS_BIAS 就判为纵向，偏向保护速降
          st.axis = (ay * AXIS_BIAS >= ax) ? "v" : "h";
          st.lx = p.x; st.ly = p.y;
        }
      }
      if(Math.abs(totalX) > 8 || Math.abs(totalY) > 8) st.moved = true;
      if(st.axis === null) return;

      if(st.axis === "h"){
        const dx = p.x - st.lx;
        if(Math.abs(dx) >= CELL*0.7){
          const steps = Math.trunc(dx / (CELL*0.7));
          const dir = steps > 0 ? 1 : -1;
          for(let i=0;i<Math.min(Math.abs(steps),3);i++)
            this.game.action(dir > 0 ? "right" : "left");
          st.lx += steps * CELL*0.7;
          st.movedCols += Math.abs(steps);
        }
      } else {
        const dy = p.y - st.ly;
        if(dy >= CELL*0.6){
          const steps = Math.min(Math.trunc(dy / (CELL*0.6)), 4);
          for(let i=0;i<steps;i++) this.game.action("softDrop");
          st.ly += steps * CELL*0.6;
          st.dragDown += steps;
        }
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
        const vertical = st.axis === "v";
        if(vertical && totalY > CELL*1.6 && dt < 0.34){
          this.game.action("hardDrop");
        } else if(vertical && totalY < -CELL*1.4 && dt < 0.42){
          this.game.action("hold");
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
