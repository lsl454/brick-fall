import { CANVAS_W, CANVAS_H, UI, SKILLS, ENERGY_MAX, VIVID } from "./constants.js";
import { roundRect, shade, shadeA, clamp, hexToRgb } from "./utils.js";
import { TextureFactory } from "./textures.js";

export const Hud = {
  /** 多巴胺面板：半透明炫彩底 + 粗彩虹渐变发光描边 */
  panel(ctx,x,y,w,h,r){
    ctx.save();
    const g=ctx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,"#1fd7ff"); g.addColorStop(0.28,"#4f8dff");
    g.addColorStop(0.5,"#b06cff"); g.addColorStop(0.72,"#ff4fa8");
    g.addColorStop(1,"#ffb340");
    const base=ctx.createLinearGradient(0,y,0,y+h);
    base.addColorStop(0,"rgba(40,26,64,.78)"); base.addColorStop(0.5,"rgba(26,16,40,.85)"); base.addColorStop(1,"rgba(18,10,28,.88)");
    roundRect(ctx,x,y,w,h,r||6); ctx.fillStyle=base; ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.08)";
    roundRect(ctx,x+1.5,y+1.5,w-3,h-3,r||6); ctx.fill();
    ctx.shadowColor="#b06cff"; ctx.shadowBlur=14;
    ctx.strokeStyle=g; ctx.lineWidth=2;
    roundRect(ctx,x+1,y+1,w-2,h-2,r||6); ctx.stroke();
    ctx.restore();
  },
  label(ctx,x,y,text){
    ctx.save();
    ctx.font='600 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.goldDim; ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillText(text,x,y);
    ctx.restore();
  },
  stat(ctx,cx,y,label,val,color,size){
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="top";
    ctx.font='600 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=UI.goldDim; ctx.fillText(label,cx,y);
    ctx.font='700 '+(size||20)+'px "Segoe UI", system-ui, sans-serif';
    const gc=ctx.createLinearGradient(cx-40,0,cx+40,0);
    gc.addColorStop(0,"#1fd7ff"); gc.addColorStop(0.5,"#ff4fa8"); gc.addColorStop(1,"#ffb340");
    ctx.fillStyle=color || gc;
    ctx.shadowColor="rgba(0,0,0,.8)"; ctx.shadowBlur=4;
    ctx.fillText(String(val),cx,y+13);
    ctx.restore();
  },

  /** 拼色按钮：斜向彩虹渐变 */
  button(ctx,b,active){
    ctx.save();
    const dy = active ? 2 : 0;
    const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);
    if(b.primary){
      g.addColorStop(0,"#ff4fa8"); g.addColorStop(0.5,"#b06cff"); g.addColorStop(1,"#4f8dff");
    } else {
      g.addColorStop(0,"#1fd7ff"); g.addColorStop(0.5,"#2fe39b"); g.addColorStop(1,"#ffb340");
    }
    if(!active){ ctx.shadowColor="rgba(0,0,0,.7)"; ctx.shadowBlur=6; ctx.shadowOffsetY=3; }
    ctx.fillStyle=g; roundRect(ctx,b.x,b.y+dy,b.w,b.h,b.r||8); ctx.fill();
    ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    if(active){ ctx.fillStyle="rgba(0,0,0,.28)"; roundRect(ctx,b.x,b.y+dy,b.w,b.h,b.r||8); ctx.fill(); }
    ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=1;
    roundRect(ctx,b.x+.5,b.y+.5+dy,b.w-1,b.h-1,b.r||8); ctx.stroke();
    ctx.font='600 '+(b.font||20)+'px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = b.primary ? "#ffffff" : UI.text;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(b.label, b.x+b.w/2, b.y+b.h/2+1+dy - (b.sub?5:0));
    if(b.sub){
      ctx.font='500 9px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle="rgba(255,255,255,.75)";
      ctx.fillText(b.sub, b.x+b.w/2, b.y+b.h-9+dy);
    }
    ctx.restore();
  },

  /** 技能符文：圆形，法力够则亮起并带光晕，不够则压暗并按比例填充 */
  skillButton(ctx,b,active,ready,ratio){
    const cx=b.x+b.w/2, cy=b.y+b.h/2, R=b.w/2;
    ctx.save();
    const dy = active && ready ? 1.5 : 0;
    ctx.translate(0,dy);

    if(ready){
      ctx.save();
      ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.42;
      const gl=ctx.createRadialGradient(cx,cy,0,cx,cy,R*2.1);
      gl.addColorStop(0,b.color); gl.addColorStop(1,shadeA(b.color,0,0));
      ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(cx,cy,R*2.1,0,6.283); ctx.fill();
      ctx.restore();
    }

    const bg=ctx.createLinearGradient(0,cy-R,0,cy+R);
    bg.addColorStop(0, ready?shadeA(b.color,-0.45,0.98):"rgba(30,26,38,.95)");
    bg.addColorStop(1, ready?shadeA(b.color,-0.62,0.98):"rgba(16,14,20,.95)");
    ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.fillStyle=bg; ctx.fill();

    if(!ready && ratio>0.01){
      ctx.save();
      ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.clip();
      ctx.fillStyle=shadeA(b.color,-0.45,0.28);
      ctx.fillRect(cx-R, cy+R-R*2*ratio, R*2, R*2*ratio);
      ctx.restore();
    }

    ctx.beginPath(); ctx.arc(cx,cy,R-0.5,0,6.283);
    ctx.strokeStyle = ready ? shadeA(b.color,0.45,1) : "rgba(180,170,200,.30)";
    ctx.lineWidth = ready ? 2 : 1.2;
    if(ready){ ctx.shadowColor=b.color; ctx.shadowBlur=12; }
    ctx.stroke();
    ctx.shadowBlur=0;

    ctx.textAlign="center"; ctx.textBaseline="middle";
    if(ready){ ctx.shadowColor=b.color; ctx.shadowBlur=14; }
    ctx.font='600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = ready ? shade(b.color,0.62) : "rgba(180,170,200,.5)";
    ctx.fillText(b.glyph, cx, cy);
    ctx.shadowBlur=0;
    ctx.font='500 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = ready ? shadeA(b.color,0.25,0.8) : "rgba(150,142,160,.45)";
    ctx.fillText(b.name, cx, cy+R+9);
    ctx.restore();
  },

  /** 法力槽 */
  energyBar(ctx,x,y,w,h,value,t){
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,.65)"; roundRect(ctx,x,y,w,h,h/2); ctx.fill();
    ctx.strokeStyle=shadeA(UI.gold,0,0.25); ctx.lineWidth=1;
    roundRect(ctx,x+.5,y+.5,w-1,h-1,h/2); ctx.stroke();
    const ratio = clamp(value/ENERGY_MAX,0,1);
    if(ratio>0.01){
      ctx.save();
      ctx.beginPath(); roundRect(ctx,x+1,y+1,w-2,h-2,(h-2)/2); ctx.clip();
      const g=ctx.createLinearGradient(x,0,x+w,0);
      g.addColorStop(0,"#1fd7ff"); g.addColorStop(0.3,"#2fe39b");
      g.addColorStop(0.55,"#ffb340"); g.addColorStop(0.8,"#ff4fa8"); g.addColorStop(1,"#b06cff");
      ctx.fillStyle=g; ctx.fillRect(x+1,y+1,(w-2)*ratio,h-2);
      // 流动高光
      const p=((t*90)%(w+80))-40;
      const sg=ctx.createLinearGradient(x+p-30,0,x+p+30,0);
      sg.addColorStop(0,"rgba(255,255,255,0)");
      sg.addColorStop(0.5,"rgba(255,255,255,.45)");
      sg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=sg; ctx.fillRect(x+1,y+1,(w-2)*ratio,h-2);
      ctx.restore();
    }
    ctx.restore();
  },

  /** 小号方块预览（HOLD / NEXT 槽） */
  miniPiece(ctx, piece, cx, cy, s, alpha){
    if(!piece) return;
    const m = piece.matrix, n = m.length;
    let minX=9,maxX=-1,minY=9,maxY=-1;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(m[y][x]){
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
    if(maxX<0) return;
    const pw=(maxX-minX+1)*s, ph=(maxY-minY+1)*s;
    const ox=cx-pw/2, oy=cy-ph/2;
    ctx.save();
    ctx.globalAlpha = alpha===undefined?1:alpha;
    const glow = TextureFactory.getGlow(piece.type);
    ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=(alpha===undefined?1:alpha)*0.5;
    ctx.drawImage(glow, cx-pw*0.9, cy-ph*0.9, pw*1.8, ph*1.8);
    ctx.globalCompositeOperation="source-over"; ctx.globalAlpha=alpha===undefined?1:alpha;
    for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++){
      if(!m[y][x]) continue;
      ctx.drawImage(TextureFactory.get(piece.type, y*3+x), ox+(x-minX)*s, oy+(y-minY)*s, s, s);
    }
    ctx.restore();
  },

  overlay(ctx,alpha){
    ctx.save();
    ctx.fillStyle="rgba(5,4,8,"+alpha+")";
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.restore();
  },
  title(ctx,text,y,size,sub){
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font='800 '+size+'px "Segoe UI", system-ui, sans-serif';
    const g=ctx.createLinearGradient(CANVAS_W/2-size*1.6,0,CANVAS_W/2+size*1.6,0);
    g.addColorStop(0,"#ffb340"); g.addColorStop(0.22,"#ff6b4d");
    g.addColorStop(0.45,"#ff4fa8"); g.addColorStop(0.65,"#b06cff");
    g.addColorStop(0.85,"#4f8dff"); g.addColorStop(1,"#1fd7ff");
    ctx.shadowColor="rgba(176,108,255,.55)"; ctx.shadowBlur=24;
    ctx.fillStyle=g; ctx.fillText(text,CANVAS_W/2,y);
    ctx.shadowBlur=0;
    if(sub){
      ctx.font='500 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle=UI.textDim; ctx.fillText(sub,CANVAS_W/2,y+size*0.78);
    }
    ctx.restore();
  },
  divider(ctx,y,w){
    ctx.save();
    const g=ctx.createLinearGradient(CANVAS_W/2-w/2,0,CANVAS_W/2+w/2,0);
    g.addColorStop(0,"rgba(31,215,255,0)");
    g.addColorStop(0.25,"#1fd7ff"); g.addColorStop(0.5,"#b06cff"); g.addColorStop(0.75,"#ff4fa8");
    g.addColorStop(1,"rgba(255,179,64,0)");
    ctx.fillStyle=g; ctx.fillRect(CANVAS_W/2-w/2,y,w,2);
    ctx.restore();
  }
};
