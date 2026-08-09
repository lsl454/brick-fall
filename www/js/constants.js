// ===== 极简竖屏布局：棋盘最大化，底部只保留 4 枚技能符文 =====
export const CANVAS_W = 480, CANVAS_H = 960;
export const COLS = 10, ROWS = 20, CELL = 40;
export const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;   // 400 x 800
export const BX = (CANVAS_W - BOARD_W) / 2;                  // 40
export const BY = 84;
export const FRAME = 6;

export const ENERGY_Y = BY + BOARD_H + 12;     // 896  法力细线
export const SKILL_Y  = BY + BOARD_H + 24;     // 908  技能符文行

export const GRAV_ACC = 3400;
export const DAS = 0.17, ARR = 0.045, SOFT_RATE = 0.045;
export const LOCK_DELAY = 0.5, MAX_LOCK_RESET = 15;

// ===== 绚丽宝石配色 =====
// 高饱和、多彩的珠宝色：七种颜色各自鲜明、碰撞出彩虹般的丰富感。
// 每种宝石带一个浅色高光值和一个同色相深板岩外壳，保证在深色棋盘上醒目又耐看。
export const PALETTE = {
  I: { core:"#1fd7ff", shell:"#062831", light:"#c8f4ff" },  // 电光青
  O: { core:"#b06cff", shell:"#200f3d", light:"#e6d2ff" },  // 亮紫晶
  T: { core:"#ff4fa8", shell:"#3a0b26", light:"#ffd0e8" },  // 蔷薇红
  S: { core:"#2fe39b", shell:"#043628", light:"#c6ffea" },  // 翡翠绿
  Z: { core:"#ff6b4d", shell:"#3a0f06", light:"#ffd2c2" },  // 珊瑚橙
  J: { core:"#4f8dff", shell:"#0a1b3d", light:"#d4e1ff" },  // 宝石蓝
  L: { core:"#ffb340", shell:"#38250a", light:"#ffe9c4" }   // 琥珀金
};
export const TYPES = ["I","O","T","S","Z","J","L"];

// 七种宝石主色，供外围界面拼色复用
export const VIVID = [
  "#1fd7ff", "#b06cff", "#ff4fa8", "#2fe39b", "#ff6b4d", "#4f8dff", "#ffb340"
];

export const UI = {
  gold:"#d9c295", goldDim:"#6f6350",
  text:"#ece7e0", textDim:"#7e7770",
  danger:"#e0708a", mana:"#8fc5d8",
  panel:"rgba(22,20,26,.92)"
};

export const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};

export const SKILLS = [
  { id:"reforge", name:"换形", glyph:"\u2726", cost:20, color:"#8496d6",
    desc:"把当前方块重铸成另一种形状" },
  { id:"chrono",  name:"缓时", glyph:"\u25f7", cost:35, color:"#7fd1e0",
    desc:"12 秒内下落速度减半" },
  { id:"quake",   name:"裂地", glyph:"\u25e4", cost:50, color:"#e0916b",
    desc:"震碎最底两行并触发坍塌" },
  { id:"purge",   name:"灭绝", glyph:"\u2756", cost:70, color:"#e07f9c",
    desc:"抹除场上数量最多的宝石" }
];
export const ENERGY_MAX = 100;
export const CHRONO_TIME = 12;

export const KICKS_JLSTZ = {
  "0>1":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "1>0":[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "1>2":[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "2>1":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "2>3":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "3>2":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "3>0":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "0>3":[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
};
export const KICKS_I = {
  "0>1":[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "1>0":[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "1>2":[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  "2>1":[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "2>3":[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "3>2":[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  "3>0":[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  "0>3":[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
};
