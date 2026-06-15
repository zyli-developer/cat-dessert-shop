# 障碍甜品 T2「冰封蛋糕」美术规格书

> 交付对象：美术 / AI 生图。本文档自包含，无需了解项目其他内容。
> 产出：1 张 PNG。交付后由开发替换 `client/assets/resources/textures/desserts/dessert_blocker_ice.png`，代码零改动。
> 姊妹档位见 `blocker-dessert-spec.md`（T1 焦糊曲奇）。当前工程里已有一张**冷蓝占位图**，替换它即可。

---

## 一、这个东西是什么（游戏功能说明）

游戏是「合成甜品店」：玩家往容器里掉落甜品，两个相同甜品碰到合成更高一级，做出甜品满足猫咪顾客。

游戏里有两种「废件」障碍甜品，都**不和任何甜品合成、不计分、只占空间**，区别在于「有多难清除」：

| 档位 | 形象 | 破坏难度 | 出现时机 |
|---|---|---|---|
| T1 焦糊曲奇 | 烤糊的焦黑饼干 | 旁边凑出**中等**合成即可震碎 | 第 3 关起 |
| **T2 冰封蛋糕（本文档）** | **冻在冰里的甜品** | 旁边必须凑出**更大**的合成才能震碎 | **第 6 关起，越后期越多** |

**T2 是「更硬」的那一档**：玩家旁边做出大合成时会把冰震裂，两次大合成把它震碎清除（也能花金币用锤子敲）。所以它要让玩家一眼觉得「这块比焦糊曲奇更结实、更冷、更难搞」。

**情绪定位**：冻得发懵的倒霉甜品——「冷 + 呆 + 有点好笑」，不是反派。

## 二、视觉设计要求

### 1. 主题
一块**被冰封 / 结满霜冻住的甜品**（冰里冻着一个蛋糕/布丁/小点心，或整个冻成一坨冰晶甜点均可，但必须一眼看出是「冻住的甜品」）。

### 2. 必须遵守的风格（与现有 8 个正常甜品 + T1 焦糊曲奇同框出现）
- **手绘治愈烘焙风**：圆润、可爱、厚实，贴纸质感；
- **厚描边**：与其它甜品统一的粗轮廓线，但这一档用**冷色描边**（青灰 `#5E8AA0` 一类），区别于暖棕；
- **整体轮廓接近圆形**：物理碰撞体是正圆，视觉外形贴合圆形（允许冰棱/雪顶等装饰小幅突出）；
- 底部可有阴影面，但**不要外部投影**（引擎自带）。

### 3. 与其它甜品 / 与 T1 的区分（核心诉求）
正常甜品和 T1 都是**暖色**（奶油黄、草莓粉、焦糖棕、焦黑褐）。T2 必须是全场**唯一的冷色**，一眼挑出来且「比 T1 更硬」：
- **主色调：冰蓝 / 霜白**（如 `#CDEBF7`～`#A9D8EE`，高光到 `#FFFFFF`）；
- **冰封感**：包裹一层半透明冰壳 / 霜面，点缀几颗**冰晶棱角**和**顶部雪冠**，传达「坚硬、冻住」；
- **加表情**：推荐冻僵的 X X 晕眼或哆嗦小表情，增加辨识度和幽默感（可冻出一小口白气）；
- 可加 1~2 道已有的细冰裂纹（但**主裂纹由程序叠加**，见下）。

### 4. 尺寸与清晰度
- **交付：≥ 240×240 正方形、透明背景 PNG**（开发会缩到工程规格 120×120）；
- 游戏内最小显示约 64px 直径（NEXT 预览窗），**细节别太碎**，表情和冰封感缩到 64px 仍要清晰。

## 三、AI 生图提示词（可直接用）

> A frozen dessert character sticker encased in ice, kawaii hand-drawn bakery style, pale icy-blue and frost-white palette, a small cake frozen inside a block of ice with frost crystals and a little snow cap on top, dizzy frozen X X eyes and a shivering pout, cool blue-grey (#5E8AA0) thick outline, round silhouette, glossy semi-transparent ice shell with soft white highlights, transparent background, centered, game item icon, 240x240

## 四、交付与验收

1. 文件：`dessert_blocker_ice.png`，透明底正方形；
2. 验收点：① 缩到 64px 仍可辨认表情与冰封感；② 和正常甜品 + 焦糊曲奇摆一起时，是**唯一的冷蓝色**、一眼最「硬」；③ 轮廓基本为圆形；
3. 给到开发后替换 `client/assets/resources/textures/desserts/dessert_blocker_ice.png` 即生效（meta/代码均无需改动）。

## 五、裂纹叠加层（已由程序生成，非美术交付项，列此备查）

被大合成震击时，本体上会叠加一层**霜裂**贴图（冷白裂缝），与 T1 的暖色裂纹同机制、不同配色：
- 文件：`dessert_blocker_ice_crack.png`（120×120 透明底，与本体同尺寸同中心，1:1 叠加，`trimType: none`）；
- 生成脚本：`node scripts/gen_blocker_ice.mjs`（同时生成本体占位图与霜裂图）；
- 若想替换为手绘霜裂：保持 120×120、透明底、裂纹集中在中心半径 ≤44 内即可覆盖，meta/代码无需改动。

## 六、调参入口

破坏阈值、几击震碎、相邻判定余量、震碎奖励分、各关掉落概率，分别在：
- `client/assets/scenes/scripts/data/DessertConfig.ts` → `BLOCKERS` 注册表（T2 = `BLOCKER_LEVEL_T2` = -1，当前 `crackTriggerLevel: 6`、`hitsToBreak: 2`、`shatterScore: 60`）；
- `client/assets/resources/configs/levels.json` → 各关 `blockers: [{ level, chance }]`（T1 level 0 / T2 level -1）。
