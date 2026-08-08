import { COLS, ROWS } from "./constants.js";
import { TextureFactory } from "./textures.js";

export class Board {
  constructor(){ this.cellSeed = 0; this.reset(); }
  reset(){
    this.grid = [];
    for(let r=0;r<ROWS;r++) this.grid.push(new Array(COLS).fill(null));
  }
  makeCell(color){
    return { color, variant:(this.cellSeed++) % TextureFactory.VARIANTS,
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
  anyFalling(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ const x=this.grid[r][c]; if(x&&x.falling) return true; }
    return false;
  }
  height(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(this.grid[r][c]) return ROWS-r;
    return 0;
  }
}
