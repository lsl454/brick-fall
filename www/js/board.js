import { COLS, ROWS } from "./constants.js";
import { TextureFactory } from "./textures.js";

export class Board {
  constructor(){ this.cellSeed = 0; this.version = 0; this.reset(); }
  /** 任何结构性改动后调用，使静态缓存失效 */
  touch(){ this.version++; }

  reset(){
    this.version++;
    this.grid = [];
    for(let r=0;r<ROWS;r++) this.grid.push(new Array(COLS).fill(null));
  }
  /** 单元格只存方块类型，颜色与贴图由 TextureFactory 决定 */
  makeCell(type){
    return { type, variant:(this.cellSeed++) % TextureFactory.VARIANTS,
             dy:0, vy:0, squash:0, flash:0, falling:false };
  }
  isFullSettled(r){
    for(let c=0;c<COLS;c++){ const x=this.grid[r][c]; if(!x || x.falling) return false; }
    return true;
  }
  fullRows(){
    const out=[];
    for(let r=0;r<ROWS;r++) if(this.isFullSettled(r)) out.push(r);
    return out;
  }
  /** 是否有正在播放动画的砖块（决定能否使用静态缓存） */
  dynamic(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const x=this.grid[r][c];
      if(x && (x.falling || x.squash>0 || x.flash>0)) return true;
    }
    return false;
  }
  anyFalling(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ const x=this.grid[r][c]; if(x&&x.falling) return true; }
    return false;
  }
  /** 最高砖块所在行，空棋盘返回 ROWS */
  topRow(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(this.grid[r][c]) return r;
    return ROWS;
  }
  /** 各类型砖块数量统计 */
  countByType(){
    const m = {};
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const x=this.grid[r][c];
      if(x && !x.falling) m[x.type] = (m[x.type]||0)+1;
    }
    return m;
  }
}
