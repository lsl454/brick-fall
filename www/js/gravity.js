import { COLS, ROWS, CELL, BX, BY, GRAV_ACC } from "./constants.js";
import { clamp } from "./utils.js";

/**
 * 独立砖块重力坍塌。
 * 关键点：删除满行时只把该行挖空，绝不做整行数组下移。
 * 之后每一列自底向上扫描，每块砖各自计算落点，因此不同列的下落距离不同。
 */
export const GravitySystem = {
  apply(board){
    let moved = 0;
    for(let c=0;c<COLS;c++){
      let target = ROWS-1;
      for(let r=ROWS-1;r>=0;r--){
        const cell = board.grid[r][c];
        if(!cell) continue;
        if(target !== r){
          cell.dy = -(target - r) * CELL;   // 视觉上仍停在旧位置，逐帧补回
          cell.vy = 0;
          cell.falling = true;
          board.grid[target][c] = cell;
          board.grid[r][c] = null;
          moved++;
        }
        target--;
      }
    }
    if(moved) board.touch();
    return moved;
  },
  update(board, dt, effects, speedMul){
    let stillFalling = false;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const cell = board.grid[r][c];
      if(!cell) continue;
      if(cell.falling){
        cell.vy += GRAV_ACC * speedMul * dt;
        cell.dy += cell.vy * dt;
        if(cell.dy >= 0){
          const impact = clamp(cell.vy/1500, 0.25, 1);
          cell.dy = 0; cell.vy = 0; cell.falling = false;
          cell.squash = impact;
          effects.dust(BX + c*CELL + CELL/2, BY + r*CELL + CELL, 2 + ((impact*4)|0));
        } else stillFalling = true;
      }
      if(cell.squash > 0) cell.squash = Math.max(0, cell.squash - dt*4.5);
      if(cell.flash  > 0) cell.flash  = Math.max(0, cell.flash  - dt*3);
    }
    return stillFalling;
  }
};
