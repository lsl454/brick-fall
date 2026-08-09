import { COLS, CELL, BX, BY, BOARD_W, ENERGY_MAX } from "./constants.js";
import { ScoreSystem } from "./score.js";
import { GravitySystem } from "./gravity.js";
import { AudioManager } from "./audio.js";
import { TextureFactory } from "./textures.js";

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
    game.addEnergy(n*11 + (game.chain-1)*9);

    // 记录该行主色，用于光柱着色
    for(const r of rows){
      const probe = game.board.grid[r][(COLS/2)|0] || game.board.grid[r][0];
      if(probe){ game.lastClearType = probe.type; break; }
    }
    const density = game.fxTier >= 2 ? 10 : game.fxTier === 1 ? 6 : 3;
    for(const r of rows){
      for(let c=0;c<COLS;c++){
        const cell = game.board.grid[r][c];
        if(!cell) continue;
        game.effects.burstCell(BX + c*CELL, BY + r*CELL, TextureFactory.colorOf(cell.type), density);
        game.board.grid[r][c] = null;      // 只挖空，绝不整行下移
      }
      game.effects.rowFlash(r);
      game.effects.beam(r, TextureFactory.colorOf(game.lastClearType || 'T'));
    }
    game.board.touch();
    const midY = BY + (rows[0] + (n-1)/2) * CELL;
    game.effects.text(BX + BOARD_W/2, midY, "+" + gained, "#ffe9b0", 24);
    game.effects.shake(7 + n*3 + game.chain*3, 0.26 + game.chain*0.04);
    game.effects.slow(game.chain>=2 ? 0.16 : 0.08);
    game.effects.ring(BX+BOARD_W/2, midY, "#ffffff");
    if(n>=3 || game.chain>=2)
      game.effects.screenFlash("#ffffff", Math.min(0.34, 0.10 + n*0.045 + game.chain*0.03));

    if(game.chain === 1) game.effects.comboPop(n>=4 ? "\u6bc1\u706d\u4e00\u51fb" : "\u51c0\u5316", 1);
    else if(game.chain >= 4) game.effects.comboPop("\u8fde\u9501 " + game.chain + " \u6e0e\u706d", 4);
    else game.effects.comboPop("\u8fde\u9501 " + game.chain, game.chain);

    AudioManager.play("break");
    AudioManager.vibrate(game.chain >= 2 ? 60 : 30);
    if(game.chain >= 2) AudioManager.play("combo");

    game.phase = "breakPause"; game.timer = 0;
  },

  runGravity(game){
    const moved = GravitySystem.apply(game.board);
    game.phase = moved > 0 ? "gravity" : "settlePause";
    game.timer = 0;
  },

  checkChain(game){
    const rows = game.board.fullRows();
    if(rows.length > 0){ AudioManager.play("chain"); this.startFlash(game, rows); }
    else { game.chain = 0; game.spawn(); }
  }
};
