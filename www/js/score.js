import { clamp } from "./utils.js";

export const ScoreSystem = {
  lineBase: {1:100, 2:300, 3:500, 4:800},
  chainMul(chain){ return chain<=1 ? 1 : chain===2 ? 1.5 : chain===3 ? 2 : 3; },
  clearScore(lines, chain){
    const base = this.lineBase[Math.min(4,lines)] || 800;
    return Math.round(base * this.chainMul(chain));
  },
  levelFor(score){ return clamp(1 + Math.floor(score/2000), 1, 20); },
  dropInterval(level){ return Math.max(0.075, 0.85 * Math.pow(0.84, level-1)); }
};
