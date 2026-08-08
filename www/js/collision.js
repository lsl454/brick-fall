import { COLS, ROWS, KICKS_I, KICKS_JLSTZ } from "./constants.js";
import { rotateMatrix } from "./pieces.js";

export const CollisionSystem = {
  collides(board, matrix, row, col){
    const n = matrix.length;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      if(!matrix[y][x]) continue;
      const r=row+y, c=col+x;
      if(c<0 || c>=COLS || r>=ROWS) return true;
      if(r<0) continue;
      if(board.grid[r][c]) return true;
    }
    return false;
  },
  dropDistance(board, piece){
    let d=0;
    while(!this.collides(board, piece.matrix, piece.row+d+1, piece.col)) d++;
    return d;
  },
  tryRotate(board, piece, dir){
    if(piece.type === "O") return true;
    const from = piece.rot, to = (piece.rot + (dir>0?1:3)) % 4;
    const m = rotateMatrix(piece.matrix, dir);
    const table = piece.type === "I" ? KICKS_I : KICKS_JLSTZ;
    const kicks = table[from + ">" + to] || [[0,0]];
    for(const k of kicks){
      const nc = piece.col + k[0], nr = piece.row - k[1];
      if(!this.collides(board, m, nr, nc)){
        piece.matrix = m; piece.rot = to; piece.col = nc; piece.row = nr;
        return true;
      }
    }
    return false;
  }
};
