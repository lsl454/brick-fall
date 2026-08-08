import { CANVAS_W, CANVAS_H } from "./constants.js";
import { roundRect, shade } from "./utils.js";

export const Hud = {
  panel(ctx,x,y,w,h,r){
    ctx.save();
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,"rgba(60,45,49,.92)"); g.addColorStop(1,"rgba(33,24,28,.94)");
    ctx.fillStyle=g; roundRect(ctx,x,y,w,h,r||8); ctx.fill();
    ctx.strokeStyle="rgba(255,190,190,.10)"; ctx.lineWidth=1;
    roundRect(ctx,x+.5,y+.5,w-1,h-1,r||8); ctx.stroke();
    ctx.restore();
  },
  stat(ctx,cx,y,label,val,color,size){
    ctx.save();
    ctx.textAlign="center";
    ctx.font='600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle="#a2858a"; ctx.textBaseline="top";
    ctx.fillText(label,cx,y);
    ctx.font='700 '+(size||21)+'px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=color||"#f6e6e0";
    ctx.fillText(String(val),cx,y+15);
    ctx.restore();
  },
  button(ctx,b,active){
    ctx.save();
    const g=ctx.createLinearGradient(0,b.y,0,b.y+b.h);
    if(b.primary){
      g.addColorStop(0,active?"#b3374f":"#d24f6c");
      g.addColorStop(1,active?"#8d2b40":"#992f45");
    } else {
      g.addColorStop(0,active?"#3b2c30":"#4f3c41");
      g.addColorStop(1,active?"#2a2023":"#33272b");
    }
    if(!active){ ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=6; ctx.shadowOffsetY=3; }
    ctx.fillStyle=g; roundRect(ctx,b.x,b.y+(active?2:0),b.w,b.h,b.r||10); ctx.fill();
    ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.strokeStyle=b.primary?"rgba(255,200,205,.35)":"rgba(255,255,255,.12)";
    ctx.lineWidth=1; roundRect(ctx,b.x+.5,b.y+.5+(active?2:0),b.w-1,b.h-1,b.r||10); ctx.stroke();
    ctx.font='600 '+(b.font||20)+'px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle=b.primary?"#fff3f2":"#e8d2ce";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(b.label, b.x+b.w/2, b.y+b.h/2+1+(active?2:0));
    if(b.sub){
      ctx.font='500 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle="rgba(255,255,255,.4)";
      ctx.fillText(b.sub, b.x+b.w/2, b.y+b.h-9+(active?2:0));
    }
    ctx.restore();
  },
  overlay(ctx,alpha){
    ctx.save();
    ctx.fillStyle="rgba(12,8,10,"+alpha+")";
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.restore();
  },
  title(ctx,text,y,size,sub){
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font='800 '+size+'px "Segoe UI", system-ui, sans-serif';
    const g=ctx.createLinearGradient(0,y-size/2,0,y+size/2);
    g.addColorStop(0,"#fff0e8"); g.addColorStop(1,"#e0577a");
    ctx.shadowColor="rgba(226,87,125,.55)"; ctx.shadowBlur=26;
    ctx.fillStyle=g; ctx.fillText(text,CANVAS_W/2,y);
    ctx.shadowBlur=0;
    if(sub){
      ctx.font='500 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle="#a1868a"; ctx.fillText(sub,CANVAS_W/2,y+size*0.74);
    }
    ctx.restore();
  }
};
