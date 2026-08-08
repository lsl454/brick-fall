import { COLS, CELL, BX, BY, BOARD_W, FLASH_TIME } from "./constants.js";
import { ScoreSystem } from "./score.js";
import { GravitySystem } from "./gravity.js";
import { AudioManager } from "./audio.js";

/** 消除流程编排：flash → break → gravity → settle → 再检测（连锁） */
export const ClearSystem = {
  startFlash(game, rows){
    game.phase = "flash"; game.timer = 0; game.clearRows = rows;
    for(const r of rows)
      for(let c=0;c<COLS;c++){ const cell = game.board.grid[r][c]; if(cell) cell.flash = 1; }
    AudioManager.play("warn");
  },
  breakRows(game){
    const rows = game.clearRows, n = rows.length;
    game.chain++;
    const gained = ScoreSystem.clearScore(n, game.chain);
    game.score += gained;
    game.lines += n;
    game.maxCombo = Math.max(game.maxCombo, game.chain);

    const density = game.lowFx ? 5 : 9;
    for(const r of rows){
      for(let c=0;c<COLS;c++){
        const cell = game.board.grid[r][c];
        if(!cell) continue;
        game.effects.burstCell(BX + c*CELL, BY + r*CELL, cell.color, density);
        game.board.grid[r][c] = null;      // 只挖空，不整体下移
      }
      game.effects.rowFlash(r);
    }
    const midY = BY + (rows[0] + (n-1)/2) * CELL;
    game.effects.text(BX + BOARD_W/2, midY, "+" + gained, "#ffd7c2", 26);
    game.effects.shake(7 + n*3 + game.chain*3, 0.26 + game.chain*0.04);
    game.effects.slow(game.chain>=2 ? 0.16 : 0.08);

    if(game.chain === 1) game.effects.comboPop("CLEAR", 1);
    else if(game.chain >= 4) game.effects.comboPop("AMAZING COMBO", 4);
    else game.effects.comboPop("COMBO " + game.chain, game.chain);

    AudioManager.play("break");
    AudioManager.vibrate(game.chain >= 2 ? 60 : 30);
    if(game.chain >= 2) AudioManager.play("combo");

    game.phase = "breakPause"; game.timer = 0;
  },
  runGravity(game){
    const moved = GravitySystem.apply(game.board);
    if(moved > 0){ game.phase = "gravity"; game.timer = 0; }
    else { game.phase = "settlePause"; game.timer = 0; }
  },
  checkChain(game){
    const rows = game.board.fullRows();
    if(rows.length > 0){ AudioManager.play("chain"); this.startFlash(game, rows); }
    else { game.chain = 0; game.spawn(); }
  }
};
