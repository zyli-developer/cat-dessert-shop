# 障碍甜品 T1「焦糊曲奇」美术规格书

> 交付对象：美术 / AI 生图。本文档自包含，无需了解项目其他内容。
> 产出：1 张 PNG。交付后由开发替换 `client/assets/resources/textures/desserts/dessert_blocker.png`，代码零改动。
> 姊妹档位见 `blocker-ice-spec.md`（T2 冰封蛋糕，更硬、后期出现）。

---

## 一、这个东西是什么（游戏功能说明）

游戏是一款「合成甜品店」：玩家往容器里掉落甜品，两个相同甜品碰到会合成更高一级，做出甜品满足猫咪顾客的订单。

**焦糊曲奇是其中唯一的「废件」甜品**——烤糊了的失败品：

| 属性 | 说明 |
|---|---|
| 作用 | 纯捣乱：**不和任何甜品合成**（包括两个焦糊曲奇互相也不合）、不计分、不被任何订单需要 |
| 危害 | 占据容器空间，堆在里面挡路；堆太高会触发溢出判负 |
| 怎么清除 | 只有一个办法：花 15 金币用「锤子」道具敲掉 |
| 出现方式 | 第 3 关起随机混在掉落队列里（概率 6%→15% 随关卡递增），玩家会在「NEXT 预览窗」提前看到它要来 |

**情绪定位**：玩家看到它应该「嫌弃 + 觉得好笑」，而不是害怕。它是个倒霉的烤糊小废物，不是反派。

## 二、视觉设计要求

### 1. 主题
一块**烤糊的曲奇饼干**（也可发挥为烤糊的小饼干/糊掉的小点心，但必须一眼看出是「烤坏的甜品」）。

### 2. 必须遵守的风格（与现有 8 个甜品同框出现）
- **手绘治愈烘焙风**：圆润、可爱、厚实，类似贴纸质感；
- **厚描边**：暖棕色 `#5A4636` 粗轮廓线（所有现有甜品统一如此）；
- **整体轮廓接近圆形**：游戏内物理碰撞体是正圆，视觉外形应贴合圆形（允许小耳朵/小缺口等装饰突出）；
- 底部可有小高光/阴影面，但**不要外部投影**（引擎内自带）。

### 3. 与正常甜品的区分（核心诉求）
正常甜品全是暖亮色（奶油黄、草莓粉、焦糖棕亮调）。焦糊曲奇必须一眼识别为「坏东西」：
- **主色调：焦黑/炭褐**（如 `#4A3528`～`#2E2018` 区间），可保留少量没烤糊的曲奇黄边缘做对比；
- **加表情**：推荐 X X 眼（晕了）或 哭丧/嫌弃 小表情 + 头顶 2~3 缕小青烟（˜˜），增加辨识度和幽默感；
- 可加 1~2 道裂纹或烤焦斑点。

### 4. 尺寸与清晰度
- **交付：≥ 240×240 正方形、透明背景 PNG**（开发会缩到工程规格）；
- 注意：游戏内最小显示约 60px 直径（NEXT 预览窗），**细节别太碎**，表情五官要在缩到 60px 时仍清晰可辨。

## 三、参考

- 风格对齐参考：`client/assets/resources/textures/desserts/` 下的 `dessert_lv1_cookie.png`（正常曲奇，烤糊前的样子，最直接的对照物）～ `dessert_lv8_cream_cake.png` 共 8 张；
- 当前占位图（待替换的丑版）：`dessert_blocker.png`——是用正常曲奇程序压暗生成的临时图，没有表情、没有焦糊细节、糊成一团，替换它即可。

## 四、AI 生图提示词（可直接用）

> A burnt cookie character sticker, kawaii hand-drawn bakery style, charcoal dark brown burnt surface with a few cracks and scorch spots, small dizzy X X eyes and a sad pout, two tiny smoke wisps rising from top, thick warm-brown (#5A4636) outline, round silhouette, flat pastel shading with soft highlight, transparent background, centered, game item icon, 240x240

## 五、交付与验收

1. 文件：`dessert_blocker.png`，透明底正方形；
2. 验收点：① 缩到 60px 仍可辨认表情与焦糊感；② 和 8 个正常甜品摆一起时一眼能挑出来；③ 轮廓基本为圆形；
3. 给到开发后替换 `client/assets/resources/textures/desserts/dessert_blocker.png` 即生效（meta/代码均无需改动）。

## 六、裂纹机制（玩法解法，已实现）

为了让焦糊曲奇不只是「收费站」（只能花金币锤），新增了一条**技巧解法**：

- **触发**：在焦糊曲奇旁边合成出 **≥ Lv4（铜锣烧）** 的甜品时，会「震击」它（`BLOCKER_CRACK_TRIGGER_LEVEL`）。
- **过程**：第 1 次震击 → 出现裂纹（叠加 `dessert_blocker_crack` 贴图 + 受击挤压）；第 2 次震击 → **震碎清除**（`BLOCKER_HITS_TO_BREAK`），迸出焦糊碎屑，并奖励 **+30 分**（`BLOCKER_SHATTER_SCORE`，化废为宝的正反馈）。
- **意义**：锤子/广告依然是兜底，但会玩的人能用大合成免费清除并加分——把惩罚设计改造成了奖励技巧的小谜题。

**裂纹叠加层贴图**（已由脚本生成，非美术交付项，列此备查）：
- 文件：`client/assets/resources/textures/desserts/dessert_blocker_crack.png`（120×120 透明底，与本体同尺寸同中心，1:1 叠加）；
- 生成脚本：`node scripts/gen_blocker_crack.mjs`（内嵌 SVG，奶油亮线 + 深色底纹的裂缝网络，露出未烤糊的面）；
- 若美术想替换为手绘裂纹：保持 120×120、透明底、裂纹集中在中心半径 ≤44 内（勿越过白色贴纸边框）即可直接覆盖，meta/代码无需改动。

调参入口都在 `client/assets/scenes/scripts/data/DessertConfig.ts`（触发等级、几击碎、相邻判定余量、震碎奖励分）。
