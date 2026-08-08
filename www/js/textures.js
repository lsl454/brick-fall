import { CELL } from "./constants.js";
import { mulberry32, clamp, shade, shadeA } from "./utils.js";

/**
 * 程序化生成立体石砖贴图。
 * 立体感由 6 层叠加构成：
 *   1. 底座暗色 + 接触阴影（让砖块像"浮"在棋盘上）
 *   2. 四面倒角斜切（上/左受光，下/右背光）—— 提供块体厚度
 *   3. 抬起的中心面 + 双向渐变 —— 提供曲面感
 *   4. 定向高光（左上主光源）+ 边缘光（右下反射光）
 *   5. 石材细节：凹坑、颗粒、裂纹
 *   6. 环境光遮蔽（底部与四角压暗）
 * 每种颜色预生成 6 个随机变体，运行时只做 drawImage。
 */
export const TextureFactory = {
  cache: {},
  VARIANTS: 6,
  SS: 3,                          // 超采样倍数，贴图实际 102x102
  get(color, variant){
    let arr = this.cache[color];
    if(!arr){
      arr = this.cache[color] = [];
      for(let i=0;i<this.VARIANTS;i++) arr.push(this.make(color,i));
    }
    return arr[((variant % this.VARIANTS) + this.VARIANTS) % this.VARIANTS];
  },

  make(color, seed){
    const S = CELL * this.SS;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d");
    const rnd = mulberry32(seed*7919 + color.charCodeAt(1)*131 + color.charCodeAt(3)*17);

    const tint = (rnd()-0.5)*0.09;          // 每块砖轻微色差
    const bev  = 4.2 * this.SS;             // 倒角宽度
    const gap  = 1.0 * this.SS;             // 砖缝

    // ---- 1. 底座 + 接触阴影 ----
    g.clearRect(0,0,S,S);
    const sh = g.createLinearGradient(0,S-bev*2,0,S);
    sh.addColorStop(0,"rgba(0,0,0,0)");
    sh.addColorStop(1,"rgba(0,0,0,.55)");
    g.fillStyle = sh; g.fillRect(0,0,S,S);
    g.fillStyle = "rgba(0,0,0,.9)";
    g.fillRect(gap, gap, S-gap*2, S-gap*2);

    const L = S - gap*2, O = gap;           // 块体区域
    const inX = O+bev, inY = O+bev, inW = L-bev*2, inH = L-bev*2;

    // ---- 2. 四面倒角 ----
    // 上面（最亮，正对光源）
    g.beginPath();
    g.moveTo(O,O); g.lineTo(O+L,O); g.lineTo(inX+inW,inY); g.lineTo(inX,inY); g.closePath();
    let tg = g.createLinearGradient(0,O,0,inY);
    tg.addColorStop(0, shade(color, 0.62+tint));
    tg.addColorStop(1, shade(color, 0.34+tint));
    g.fillStyle = tg; g.fill();

    // 左面（次亮）
    g.beginPath();
    g.moveTo(O,O); g.lineTo(inX,inY); g.lineTo(inX,inY+inH); g.lineTo(O,O+L); g.closePath();
    let lg = g.createLinearGradient(O,0,inX,0);
    lg.addColorStop(0, shade(color, 0.44+tint));
    lg.addColorStop(1, shade(color, 0.20+tint));
    g.fillStyle = lg; g.fill();

    // 右面（背光）
    g.beginPath();
    g.moveTo(O+L,O); g.lineTo(O+L,O+L); g.lineTo(inX+inW,inY+inH); g.lineTo(inX+inW,inY); g.closePath();
    let rg2 = g.createLinearGradient(inX+inW,0,O+L,0);
    rg2.addColorStop(0, shade(color,-0.42+tint));
    rg2.addColorStop(1, shade(color,-0.62+tint));
    g.fillStyle = rg2; g.fill();

    // 下面（最暗）
    g.beginPath();
    g.moveTo(O,O+L); g.lineTo(inX,inY+inH); g.lineTo(inX+inW,inY+inH); g.lineTo(O+L,O+L); g.closePath();
    let bg = g.createLinearGradient(0,inY+inH,0,O+L);
    bg.addColorStop(0, shade(color,-0.55+tint));
    bg.addColorStop(1, shade(color,-0.74+tint));
    g.fillStyle = bg; g.fill();

    // ---- 3. 抬起的中心面 ----
    const face = g.createLinearGradient(inX, inY, inX+inW*0.5, inY+inH);
    face.addColorStop(0,   shade(color, 0.20+tint));
    face.addColorStop(0.42, shade(color, 0.03+tint));
    face.addColorStop(1,   shade(color,-0.24+tint));
    g.fillStyle = face; g.fillRect(inX, inY, inW, inH);

    // 中心面顶部一道明确的转折高光，强化"面"的边界
    g.fillStyle = "rgba(255,255,255,.22)";
    g.fillRect(inX, inY, inW, 1.2*this.SS);
    g.fillStyle = "rgba(0,0,0,.30)";
    g.fillRect(inX, inY+inH-1.2*this.SS, inW, 1.2*this.SS);

    // ---- 5a. 石材颗粒与凹坑（画在高光之前，让高光压住） ----
    for(let i=0;i<70;i++){
      const x = inX + rnd()*inW, y = inY + rnd()*inH, r = rnd()*1.6*this.SS + 0.35;
      g.fillStyle = rnd()>0.5 ? shadeA(color,-0.4,0.18) : shadeA(color,0.45,0.14);
      g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
    }
    for(let i=0;i<8;i++){
      const x = inX + rnd()*inW, y = inY + rnd()*inH, r = (1.4+rnd()*3.2)*this.SS;
      const pit = g.createRadialGradient(x-r*0.3, y-r*0.3, 0, x, y, r);
      pit.addColorStop(0,   shadeA(color,-0.55,0.40));
      pit.addColorStop(0.65,shadeA(color,-0.25,0.16));
      pit.addColorStop(1,   shadeA(color,0.30,0.10));   // 坑沿反光
      g.fillStyle = pit; g.beginPath(); g.arc(x,y,r,0,6.283); g.fill();
    }

    // ---- 4. 定向高光 + 边缘光 ----
    const spec = g.createRadialGradient(inX+inW*0.30, inY+inH*0.24, 0,
                                        inX+inW*0.30, inY+inH*0.24, inW*0.62);
    spec.addColorStop(0,  "rgba(255,255,255,.34)");
    spec.addColorStop(0.45,"rgba(255,255,255,.10)");
    spec.addColorStop(1,  "rgba(255,255,255,0)");
    g.fillStyle = spec; g.fillRect(inX, inY, inW, inH);

    const rim = g.createLinearGradient(inX+inW, inY+inH, inX+inW*0.55, inY+inH*0.55);
    rim.addColorStop(0, shadeA(color, 0.55, 0.20));
    rim.addColorStop(1, shadeA(color, 0.55, 0));
    g.fillStyle = rim; g.fillRect(inX, inY, inW, inH);

    // ---- 5b. 裂纹（带受光侧亮边，看起来是凹陷而非画上去的线） ----
    const cracks = 1 + ((rnd()*3)|0);
    g.lineCap = "round"; g.lineJoin = "round";
    for(let c=0;c<cracks;c++){
      const pts = [];
      let x = inX + rnd()*inW, y = inY + rnd()*inH, ang = rnd()*6.283;
      pts.push([x,y]);
      const segs = 2 + ((rnd()*4)|0);
      for(let s=0;s<segs;s++){
        ang += (rnd()-0.5)*1.6;
        x = clamp(x + Math.cos(ang)*(2.2+rnd()*4.5)*this.SS, inX, inX+inW);
        y = clamp(y + Math.sin(ang)*(2.2+rnd()*4.5)*this.SS, inY, inY+inH);
        pts.push([x,y]);
      }
      const stroke = (dx,dy,style,width)=>{
        g.beginPath();
        pts.forEach((p,i)=> i? g.lineTo(p[0]+dx,p[1]+dy) : g.moveTo(p[0]+dx,p[1]+dy));
        g.strokeStyle = style; g.lineWidth = width; g.stroke();
      };
      stroke(0.9*this.SS, 0.9*this.SS, "rgba(255,255,255,.16)", 1.1*this.SS);  // 下侧亮边
      stroke(0, 0, shadeA(color,-0.78,0.62), 1.6*this.SS);                      // 裂缝本体
    }

    // ---- 6. 环境光遮蔽：四角与底部压暗 ----
    const ao = g.createRadialGradient(S/2, S*0.42, inW*0.30, S/2, S/2, inW*0.82);
    ao.addColorStop(0,"rgba(0,0,0,0)");
    ao.addColorStop(1,"rgba(0,0,0,.34)");
    g.fillStyle = ao; g.fillRect(inX, inY, inW, inH);

    // 外描边：把整块砖从背景里切出来
    g.strokeStyle = "rgba(0,0,0,.85)"; g.lineWidth = 1.4*this.SS;
    g.strokeRect(O+0.7*this.SS, O+0.7*this.SS, L-1.4*this.SS, L-1.4*this.SS);

    return cv;
  }
};
