import { COLS, ROWS, CELL, BX, BY, BOARD_W, SKILLS, CHRONO_TIME, TYPES } from "./constants.js";
import { TextureFactory } from "./textures.js";
import { makePiece } from "./pieces.js";
import { CollisionSystem } from "./collision.js";
import { AudioManager } from "./audio.js";

/**
 * 技能系统。法力由消行积攒，只能在可操作阶段释放。
 *
 * 会改动棋盘的技能（裂地、灭绝）复用消除流程：碎裂 → 坍塌 → 连锁检测。
 * 为了不让流程末尾的 spawn() 顶掉玩家手里正在操作的方块，
 * 释放前把当前方块寄存到 game.pendingPiece，spawn() 会优先把它还回来。
 */
export const SkillSystem = {
  byId(id){ return SKILLS.find(s=>s.id===id); },

  canUse(game, id){
    const s = this.byId(id);
    if(!s) return false;
    if(game.mode !== "playing" || game.phase !== "control" || !game.piece) return false;
    return game.energy >= s.cost;
  },

  use(game, id){
    if(!this.canUse(game, id)){
      if(game.mode === "playing") game.effects.text(BX+BOARD_W/2, BY+120, "\u6cd5\u529b\u4e0d\u8db3", "#ff6b8a", 20);
      AudioManager.play("move");
      return false;
    }
    const s = this.byId(id);
    game.energy -= s.cost;
    game.skillsUsed++;
    AudioManager.play("cast");
    AudioManager.vibrate(40);
    game.effects.text(BX+BOARD_W/2, BY+100, s.name, s.color, 26);
    game.effects.ring(BX+BOARD_W/2, BY+BOARD_W/2, s.color);
    game.effects.screenFlash(s.color, 0.16);

    switch(id){
      case "reforge": return this.reforge(game);
      case "chrono":  return this.chrono(game);
      case "quake":   return this.quake(game);
      case "purge":   return this.purge(game);
    }
    return true;
  },

  /* 换形：把当前方块重铸成另一种形状，位置放不下就退回原样 */
  reforge(game){
    const cur = game.piece;
    const pool = TYPES.filter(t => t !== cur.type);
    for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=pool[i];pool[i]=pool[j];pool[j]=t; }
    for(const t of pool){
      const p = makePiece(t);
      p.row = cur.row; p.col = cur.col;
      if(!CollisionSystem.collides(game.board, p.matrix, p.row, p.col)){
        game.piece = p;
        game.lockT = 0;
        game.effects.burstCell(BX + cur.col*CELL, BY + Math.max(0,cur.row)*CELL,
                               TextureFactory.colorOf(cur.type), 8);
        return true;
      }
    }
    return true;
  },

  /* 缓时：一段时间内下落间隔翻倍 */
  chrono(game){
    game.chronoT = CHRONO_TIME;
    game.effects.slow(0.25);
    return true;
  },

  /* 裂地：震碎最底两行 */
  quake(game){
    const rows = [ROWS-1, ROWS-2].filter(r=>r>=0);
    let hit = 0;
    game.pendingPiece = game.piece;
    game.piece = null;
    for(const r of rows){
      for(let c=0;c<COLS;c++){
        const cell = game.board.grid[r][c];
        if(!cell) continue;
        game.effects.burstCell(BX+c*CELL, BY+r*CELL, TextureFactory.colorOf(cell.type), 10);
        game.board.grid[r][c] = null; hit++;
      }
      game.effects.rowFlash(r);
    }
    game.board.touch();
    game.score += hit * 12;
    game.effects.shake(16, 0.45);
    AudioManager.play("break");
    game.phase = "breakPause"; game.timer = 0;
    return true;
  },

  /* 灭绝：抹除场上数量最多的那种符文石 */
  purge(game){
    const counts = game.board.countByType();
    let best = null, bestN = 0;
    for(const t in counts) if(counts[t] > bestN){ bestN = counts[t]; best = t; }
    if(!best){ return true; }
    game.pendingPiece = game.piece;
    game.piece = null;
    let hit = 0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const cell = game.board.grid[r][c];
      if(!cell || cell.type !== best) continue;
      game.effects.burstCell(BX+c*CELL, BY+r*CELL, TextureFactory.colorOf(best), 10);
      game.board.grid[r][c] = null; hit++;
    }
    game.board.touch();
    game.score += hit * 15;
    game.effects.shake(14, 0.4);
    AudioManager.play("break");
    game.phase = "breakPause"; game.timer = 0;
    return true;
  }
};
