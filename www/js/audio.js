import { Storage } from "./utils.js";

export const AudioManager = {
  ctx: null,
  enabled: Storage.get("bf_sound", true),
  init(){
    if(this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ this.ctx = null; }
    if(this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  toggle(){ this.enabled = !this.enabled; Storage.set("bf_sound", this.enabled); if(this.enabled) this.play("click"); },
  tone(freq,dur,type,vol,slideTo){
    if(!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t+dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  },
  noise(dur,vol,filterHz){
    if(!this.enabled || !this.ctx) return;
    const sr = this.ctx.sampleRate, len = Math.max(1,(sr*dur)|0);
    const buf = this.ctx.createBuffer(1,len,sr), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value = filterHz || 1400;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start();
  },
  play(name){
    if(!this.enabled) return;
    this.init();
    switch(name){
      case "move":   this.tone(220,0.04,"square",0.04); break;
      case "rotate": this.tone(380,0.06,"square",0.05,460); break;
      case "land":   this.noise(0.10,0.18,700); this.tone(120,0.08,"triangle",0.06); break;
      case "hard":   this.noise(0.16,0.30,500); this.tone(90,0.12,"sawtooth",0.07,50); break;
      case "warn":   this.tone(880,0.10,"sine",0.05,1200); break;
      case "break":  this.noise(0.34,0.38,2600); this.tone(160,0.20,"sawtooth",0.06,60); break;
      case "chain":  this.tone(520,0.10,"square",0.06,780); break;
      case "combo":  this.tone(660,0.14,"square",0.07,1180); break;
      case "over":   this.tone(300,0.50,"sawtooth",0.09,70); break;
      case "click":  this.tone(600,0.05,"square",0.05); break;
    }
  },
  vibrate(ms){
    if(!this.enabled) return;
    try { if(navigator.vibrate) navigator.vibrate(ms); } catch(e){}
  }
};
