export function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
export function clamp(v,a,b){ return v<a?a:v>b?b:v; }
export function lerp(a,b,t){ return a+(b-a)*t; }
export function hexToRgb(h){
  h=h.replace("#","");
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function f(v,amt){ return amt>=0 ? v+(255-v)*amt : v*(1+amt); }
export function shade(hex,amt){
  const [r,g,b]=hexToRgb(hex);
  return `rgb(${f(r,amt)|0},${f(g,amt)|0},${f(b,amt)|0})`;
}
export function shadeA(hex,amt,a){
  const [r,g,b]=hexToRgb(hex);
  return `rgba(${f(r,amt)|0},${f(g,amt)|0},${f(b,amt)|0},${a})`;
}
export function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
export const Storage = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v===null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
