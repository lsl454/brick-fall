import { CELL, PALETTE } from "./constants.js";
import { mulberry32, clamp, shade, shadeA, hexToRgb } from "./utils.js";

/**
 * 抛光宝石砖贴图。
 *
 * 高饱和多彩宝石：七种鲜明珠宝色在深色棋盘上碰撞，彩虹般丰富。
 *   - 圆角矩形而非硬方块，边缘柔和，相邻宝石靠深色窄边分隔
 *   - 立体感靠"顶亮底暗 + 内层火光 + 左上高光 + 底部反射光"多层光
 *   - 斜向切面棱线模拟宝石切工，更通透、更有质感
 *   - 只保留极淡颗粒，干净又明亮
 */
export const TextureFactory = {
  base: {}, glow: {},
  VARIANTS: 4,
  SS: 3,

  colorOf(type){ return (PALETTE[type] || PALETTE.T).core; },
  lightOf(type){ return (PALETTE[type] || PALETTE.T).light; },
  shellOf(type){ return (PALETTE[type] || PALETTE.T).shell; },

  get(type, variant){
    let arr = this.base[type];
    if(!arr){
      arr = this.base[type] = [];
      for(let i=0;i<this.VARIANTS;i++) arr.push(this.make(type,i));
    }
    return arr[((variant % this.VARIANTS) + this.VARIANTS) % this.VARIANTS];
  },
  getGlow(type){
    if(!this.glow[type]) this.glow[type] = this.makeGlow(type);
    return this.glow[type];
  },

  /* 柔和外晕：把宝石从深色棋盘上"托"起来，让多彩配色更显眼 */
  makeGlow(type){
    const S = CELL * 2 * this.SS;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d");
    const [r,gg,b] = hexToRgb(this.colorOf(type));
    const rg = g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
    rg.addColorStop(0,    `rgba(${r},${gg},${b},.34)`);
    rg.addColorStop(0.30, `rgba(${r},${gg},${b},.16)`);
    rg.addColorStop(0.65, `rgba(${r},${gg},${b},.045)`);
    rg.addColorStop(1,    `rgba(${r},${gg},${b},0)`);
    g.fillStyle = rg; g.fillRect(0,0,S,S);
    return cv;
  },

  make(type, seed){
    const S = CELL * this.SS;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d");
    const core  = this.colorOf(type);
    const light = this.lightOf(type);
    const shell = this.shellOf(type);
    const rnd = mulberry32(seed*7919 + type.charCodeAt(0)*613);

    const gap = 1.6 * this.SS;
    const O = gap, L = S - gap*2;
    const R = L * 0.24;                       // 圆角半径

    const rr = (x,y,w,h,r)=>{
      g.beginPath();
      g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
      g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
      g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
    };

    // 1. 落地投影，让宝石浮在棋盘上
    g.save();
    g.shadowColor = "rgba(0,0,0,.5)";
    g.shadowBlur = 4*this.SS; g.shadowOffsetY = 2.2*this.SS;
    rr(O,O,L,L,R); g.fillStyle = shade(shell,-0.3); g.fill();
    g.restore();

    // 2. 外壳：深板岩窄边，带纵向渐变，负责把相邻宝石分开
    rr(O,O,L,L,R);
    const shellG = g.createLinearGradient(0, O, 0, O+L);
    shellG.addColorStop(0,   shade(shell, 0.24));
    shellG.addColorStop(0.5, shade(shell, 0.02));
    shellG.addColorStop(1,   shade(shell, -0.20));
    g.fillStyle = shellG; g.fill();

    // 3. 宝石主体：顶亮 → 中间本色 → 底暗 的四段渐变
    const bw = 2.0*this.SS;
    const fx=O+bw, fy=O+bw, fw=L-bw*2, fh=L-bw*2, fr=R-bw*0.6;
    const body = g.createLinearGradient(0, fy, 0, fy+fh);
    body.addColorStop(0,    shade(light, 0.10));
    body.addColorStop(0.28, core);
    body.addColorStop(0.62, shade(core,-0.12));
    body.addColorStop(0.85, shade(core,-0.32));
    body.addColorStop(1,    shade(core,-0.52));
    rr(fx,fy,fw,fh,fr); g.fillStyle = body; g.fill();

    // 3b. 内层"火"：中心偏下的一团亮色，增强通透感
    g.save();
    rr(fx,fy,fw,fh,fr); g.clip();
    const fire = g.createRadialGradient(fx+fw*0.5, fy+fh*0.62, 0,
                                        fx+fw*0.5, fy+fh*0.62, fh*0.78);
    fire.addColorStop(0,   shadeA(light,0.06,0.55));
    fire.addColorStop(0.5, shadeA(light,0.06,0.14));
    fire.addColorStop(1,   shadeA(light,0.06,0));
    g.fillStyle = fire; g.fillRect(fx,fy,fw,fh);

    // 4. 左上柔和高光（宝石的"水头"）
    const spec = g.createRadialGradient(fx+fw*0.30, fy+fh*0.22, 0,
                                        fx+fw*0.30, fy+fh*0.22, fw*0.60);
    spec.addColorStop(0,  "rgba(255,255,255,.55)");
    spec.addColorStop(0.35,"rgba(255,255,255,.16)");
    spec.addColorStop(1,  "rgba(255,255,255,0)");
    g.fillStyle = spec; g.fillRect(fx,fy,fw,fh);

    // 5. 斜向切面棱线，模拟宝石切工
    g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 0.9*this.SS;
    for(let i=1;i<=3;i++){
      const t=i/4;
      const y1=fy+t*fh, y2=fy+Math.min(1,t+0.32)*fh;
      if(y2>fy+fh) break;
      g.beginPath(); g.moveTo(fx,y1); g.lineTo(fx+fw,y2); g.stroke();
    }
    for(let i=1;i<=3;i++){
      const t=i/4;
      const y1=fy+t*fh, y2=fy+Math.min(1,t+0.32)*fh;
      if(y2>fy+fh) break;
      g.beginPath(); g.moveTo(fx+fw,y1); g.lineTo(fx,y2); g.stroke();
    }

    // 6. 底部反射光：从下方弹回来的一道淡光，是"通透"的关键
    const bounce = g.createLinearGradient(0, fy+fh, 0, fy+fh*0.60);
    bounce.addColorStop(0, shadeA(light, 0, 0.34));
    bounce.addColorStop(1, shadeA(light, 0, 0));
    g.fillStyle = bounce; g.fillRect(fx,fy,fw,fh);

    // 7. 极淡颗粒，避免大色块显得塑料
    for(let i=0;i<18;i++){
      g.fillStyle = rnd()>0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.06)";
      g.fillRect(fx+rnd()*fw, fy+rnd()*fh, rnd()*2.2*this.SS+0.6, rnd()*1.8*this.SS+0.6);
    }
    g.restore();

    // 8. 顶部一道亮边 + 底部一道暗边，收出厚度
    g.save();
    rr(fx,fy,fw,fh,fr); g.clip();
    g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.5*this.SS;
    g.beginPath();
    g.moveTo(fx+fr*0.5, fy+0.7*this.SS); g.lineTo(fx+fw-fr*0.5, fy+0.7*this.SS);
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,.30)"; g.lineWidth = 1.6*this.SS;
    g.beginPath();
    g.moveTo(fx+fr*0.5, fy+fh-0.8*this.SS); g.lineTo(fx+fw-fr*0.5, fy+fh-0.8*this.SS);
    g.stroke();
    g.restore();

    // 9. 外圈描边：一层暗、一层同色淡光
    rr(O+0.5*this.SS, O+0.5*this.SS, L-this.SS, L-this.SS, R);
    g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 1.1*this.SS; g.stroke();
    rr(fx,fy,fw,fh,fr);
    g.strokeStyle = shadeA(light, 0.05, 0.40); g.lineWidth = 1.0*this.SS; g.stroke();

    return cv;
  }
};
