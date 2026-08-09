import { SHAPES, COLS, TYPES } from "./constants.js";

export function rotateMatrix(m, dir){
  const n=m.length, r=[];
  for(let i=0;i<n;i++) r.push(new Array(n).fill(0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    if(dir>0) r[x][n-1-y]=m[y][x];
    else      r[n-1-x][y]=m[y][x];
  }
  return r;
}

export function makePiece(type){
  const m = SHAPES[type].map(r=>r.slice());
  return {
    type, matrix:m, rot:0,
    row: type==="I" ? -1 : -2,
    col: Math.floor((COLS - m.length)/2)
  };
}

export const PieceFactory = {
  bag: [],
  reset(){ this.bag = []; },
  refill(){
    const keys = TYPES.slice();
    for(let i=keys.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      const t=keys[i]; keys[i]=keys[j]; keys[j]=t;
    }
    this.bag = keys;
  },
  next(){
    if(this.bag.length===0) this.refill();
    return makePiece(this.bag.pop());
  }
};
