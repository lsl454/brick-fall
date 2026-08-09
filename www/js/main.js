import { Game } from "./game.js";
import { CANVAS_W, CANVAS_H } from "./constants.js";

function fit(){
  const wrap = document.getElementById("wrap");
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / CANVAS_W, vh / CANVAS_H);
  wrap.style.width  = Math.round(CANVAS_W * s) + "px";
  wrap.style.height = Math.round(CANVAS_H * s) + "px";
}
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", ()=>setTimeout(fit,120));
fit();

// 提升高 DPR 屏幕清晰度
const cv = document.getElementById("game");
// DPR 上限压到 2：手机上 3x 渲染的像素量是 2x 的 2.25 倍，肉眼几乎无差别
const dpr = Math.min(window.devicePixelRatio || 1, 2);
cv.width  = CANVAS_W * dpr;
cv.height = CANVAS_H * dpr;
cv.getContext("2d").setTransform(dpr,0,0,dpr,0,0);

new Game(cv);

// 屏蔽移动端双击缩放与页面回弹
document.addEventListener("gesturestart", e=>e.preventDefault());
document.addEventListener("dblclick", e=>e.preventDefault());
