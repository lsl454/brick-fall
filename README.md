# 砖块消消落 / Brick Fall

竖屏手机端网页游戏：**俄罗斯方块 + 独立砖块重力坍塌 + 连锁消除**。
程序化生成的立体 3D 石砖、碎裂粒子、连锁震屏，支持触屏手势与虚拟按键。
推到 GitHub 后由 Actions 自动打出 Android APK。

---

## 一、三种运行方式

### 1. 最快看效果（不装任何东西）

双击 `preview-single-file.html`，用手机或电脑浏览器打开。这是把所有模块合并成的单文件版本，不需要服务器，功能与正式版完全一致。电脑上按 F12 → 切换设备工具栏 → 选一台手机，即可预览竖屏效果。

> 正式的 `www/index.html` 使用 ES Module，浏览器安全策略禁止从 `file://` 加载模块，必须走 HTTP。这就是单独提供单文件版的原因。

### 2. 本地开发

```bash
npm run dev
# 打开 http://localhost:5173
```

### 3. 打 APK

推到 GitHub 即可，见下一节。

---

## 二、打包 APK（GitHub Actions）

### Debug 版（无需任何配置）

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

推送后进入仓库的 **Actions** 标签页，`Build Debug APK` 会自动运行（约 5～8 分钟）。跑完后在该次运行页面底部的 **Artifacts** 区域下载 `brick-fall-debug-apk`，解压得到 `app-debug.apk`，直接装到手机即可。

Debug 包用的是 Android 默认调试签名，可以安装、可以自用，但**不能上架应用商店**。

### Release 签名版

先在本地生成密钥（只做一次）：

```bash
keytool -genkey -v -keystore my-release.keystore -alias brickfall \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 my-release.keystore > keystore.txt   # macOS 用 base64 -i
```

在仓库 **Settings → Secrets and variables → Actions** 添加四个 secret：

| 名称 | 值 |
|---|---|
| `KEYSTORE_BASE64` | `keystore.txt` 的全部内容 |
| `KEYSTORE_PASSWORD` | 生成密钥时设的库口令 |
| `KEY_ALIAS` | `brickfall` |
| `KEY_PASSWORD` | 生成密钥时设的密钥口令 |

然后打 tag 触发：

```bash
git tag v1.0.0
git push origin v1.0.0
```

`Build Signed Release APK` 会产出可上架的签名包。

**注意：`my-release.keystore` 千万不要提交到仓库**，`.gitignore` 已经拦了 `*.keystore` 和 `*.jks`。密钥丢了就无法给已上架的应用发更新。

### 本地打包（可选）

需要装 Android Studio 与 JDK 17：

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android      # 在 Android Studio 里点运行
# 或直接命令行
cd android && ./gradlew assembleDebug
```

`android/` 目录被 `.gitignore` 排除，由 `npx cap add android` 现场生成。这样仓库保持干净，也避免 Capacitor 版本升级后平台目录与依赖不匹配。

---

## 三、操作方式

### 触屏

| 操作 | 效果 |
|---|---|
| 棋盘上左右滑动 | 逐格移动（每滑过一个格宽移动一格） |
| 棋盘上轻点 | 顺时针旋转 |
| 棋盘上快速下滑 | 硬降 |
| 棋盘上慢速下拖 | 软降 |
| 底部六个虚拟按键 | 逆时针 / 顺时针 / 硬降 / 左移 / 软降 / 右移 |
| 长按左右和软降键 | 连发 |

手势与按键可以混用。消除动画期间所有输入被忽略。

### 键盘（电脑调试用）

`← →` / `A D` 移动，`↓` / `S` 软降，`↑` / `W` 顺时针，`Q` 逆时针，`空格` 硬降，`P` / `Esc` 暂停，`R` 重开，`M` 音效。

---

## 四、3D 砖块是怎么画的

不使用任何外部素材和 3D 引擎，全部由 `textures.js` 用 Canvas 2D 程序化生成，每种颜色预生成 6 个随机变体，运行时只做 `drawImage`。

单块砖由六层叠加构成，这是这版视觉重做的核心：

1. **底座与接触阴影** —— 砖块底部有一道向下的暗部渐变，让它看起来压在棋盘上而不是贴在上面
2. **四面倒角斜切** —— 上面最亮、左面次亮、右面偏暗、下面最暗，四个梯形拼出块体厚度，光源固定在左上
3. **抬起的中心面** —— 双向渐变，顶边一道亮转折线、底边一道暗转折线，明确区分"面"与"倒角"
4. **定向高光与边缘光** —— 左上放射状主高光，右下一层冷色反射光，这是让砖块显得是石头而不是塑料的关键
5. **石材细节** —— 凹坑（带坑沿反光）、颗粒斑点、裂纹。裂纹画两遍：先在偏移位置画一道半透明白色作为受光侧亮边，再画深色本体，视觉上就成了凹进去的缝而不是画上去的线
6. **环境光遮蔽** —— 中心亮、四周与底部压暗

砖块落地时还有压缩回弹（`squash`），横向拉宽、纵向压扁并以底边为锚点，配合扬尘。

---

## 五、核心特色：独立砖块重力坍塌

普通俄罗斯方块消除一行后，上方内容整体下移。本游戏中**每一个小方格独立计算落点**：

```
方块落地 → 锁定 → 检测满行 → 满行发光闪烁 → 碎裂成粒子 → 只把该行挖空
        → 逐列自底向上扫描 → 每块砖各自计算落点 → 播放下落动画
        → 落地压缩回弹 + 扬尘 → 全部落稳 → 再次检测满行
        → 有满行则 Combo+1 并循环 → 无满行才生成下一个方块
```

`gravity.js` 里 `apply()` 的写法保证了这一点：它从不做数组整体位移，而是逐列维护一个 `target` 指针，把每块砖搬到它自己的落点，并把视觉偏移 `dy` 设为负值，再由 `update()` 逐帧用重力加速度补回来。因此不同列的下落距离天然不同，坍塌后经常自动堆出新的满行。

已用无头测试验证：单行消除后，三块分别位于第 14、17、18 行的悬空砖，下落距离分别为 5 格、2 格、1 格。

---

## 六、计分

| 消除 | 基础分 |
|---|---|
| 单行 | 100 |
| 双行 | 300 |
| 三行 | 500 |
| 四行 | 800 |

连锁倍率：第 1 次 ×1，第 2 次 ×1.5，第 3 次 ×2，第 4 次及以上 ×3。软降 +1 分/格，硬降 +2 分/格。

Combo 文字依次为 `CLEAR` → `COMBO 2` → `COMBO 3` → `AMAZING COMBO`，连锁越高震动、粒子、震动马达强度越强。

每 2000 分升一级（上限 20 级），下落间隔从 850ms 收紧到 75ms。最高分存 `localStorage` 的 `bf_high`。

---

## 七、目录结构

```
brick-fall/
├── package.json                     Capacitor 依赖与脚本
├── capacitor.config.json            应用 ID、名称、webDir
├── preview-single-file.html         合并版，双击即玩，仅供预览
├── .gitignore                       排除 node_modules 与 android/
├── .github/workflows/
│   ├── android-debug.yml            推送即打 Debug APK
│   └── android-release.yml          打 tag 打签名 Release APK
└── www/                             Capacitor 的 webDir，全部前端资源
    ├── index.html
    ├── styles.css
    ├── assets/                      预留：后续放音频与图片
    └── js/
        ├── main.js                  入口：DPR 适配、画布缩放、启动
        ├── constants.js             布局尺寸、配色、方块形状、SRS 墙踢表
        ├── utils.js                 RNG、颜色运算、圆角矩形、localStorage
        ├── textures.js              程序化 3D 石砖贴图工厂
        ├── renderer.js              砖块绘制、虚影、棋盘与石质边框
        ├── board.js                 棋盘数据与单元格工厂
        ├── pieces.js                7-Bag 生成与矩阵旋转
        ├── collision.js             碰撞检测、硬降距离、SRS 墙踢
        ├── gravity.js               独立落点计算与逐帧下落动画
        ├── score.js                 计分、连锁倍率、等级速度曲线
        ├── clear.js                 消除流程编排与连锁循环
        ├── effects.js               粒子/闪光/飘字/Combo/震屏，对象池
        ├── audio.js                 Web Audio 合成音效 + 震动马达
        ├── hud.js                   面板、按钮、统计数值绘制
        ├── input.js                 触摸手势、虚拟按键、键盘统一收敛
        └── game.js                  状态机、布局、绘制调度、主循环
```

修改布局改 `constants.js` 顶部；修改手感改 `constants.js` 里的 `DAS`/`ARR`/`LOCK_DELAY`/`GRAV_ACC`；修改视觉改 `textures.js`。

---

## 八、已实现

- 7-Bag 随机、SRS 旋转与完整墙踢表、锁定延迟（最多 15 次重置）
- 触屏手势 + 虚拟按键 + 键盘三套输入，长按连发
- 满行发光 → 碎裂 → 每块砖独立重力下落 → 自动连锁
- 碎片、灰尘、火星、横向闪光带、屏幕震动、连锁慢动作、分数飘字、Combo 弹出
- 程序化 3D 石砖与石质边框、水泥墙背景
- 主菜单 / 暂停 / 结束三套界面
- Web Audio 合成音效 + 手机震动反馈，可开关
- 最高分持久化、等级与速度递增
- 高 DPR 适配、安全区适配、竖屏锁定、低帧率自动降级粒子

## 九、已知问题与限制

- 未做 Hold 暂存、T-Spin 判定、Back-to-Back 奖励
- 音效为程序化合成的占位音，非正式音频素材；`www/assets/audio/` 已预留目录
- 应用图标与启动图使用 Capacitor 默认资源，需要自定义可加 `@capacitor/assets`
- 竖屏锁定通过 CI 里 sed 修改 `AndroidManifest.xml` 实现，如果 Capacitor 改了模板格式，这一步会静默跳过（不影响构建），届时手动在 manifest 里加 `android:screenOrientation="portrait"`
- 连锁层数很多时粒子量大，低端机会掉帧；已内置自动降级（连续 90 帧平均超过 24ms 则减少碎片数），也可直接调小 `clear.js` 里的 `density`
- iOS 未测试；Capacitor 支持 `npx cap add ios`，但需要 macOS 与 Xcode
