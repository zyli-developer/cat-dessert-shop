# -*- coding: utf-8 -*-
"""把四份软著文档中所有「可据代码核实」的待补内容补全。
不动：申请人姓名、开发完成日期、身份证、界面截图（必须由用户提供）。"""
import os
from docx import Document
from docx.shared import RGBColor, Pt

D = r"D:\workspace\tiktok\mini-game\docs\软著"
BLACK = RGBColor(0, 0, 0)

def find(doc, sub):
    for p in doc.paragraphs:
        if sub in p.text:
            return p
    return None

def set_text(p, text, color=BLACK, bold=None, size=None):
    """重写段落文字，保留首个 run 的字体设置；其余 run 删除。"""
    if not p.runs:
        r = p.add_run(text)
    else:
        p.runs[0].text = text
        for extra in list(p.runs[1:]):
            extra._element.getparent().remove(extra._element)
        r = p.runs[0]
    if color is not None:
        r.font.color.rgb = color
    if bold is not None:
        r.font.bold = bold
    if size is not None:
        r.font.size = Pt(size)
    return r

def cell_set(cell, text):
    p = cell.paragraphs[0]
    set_text(p, text)

# ========== 文件 2 · 操作说明书 ==========
f2 = os.path.join(D, "2-操作说明书模板.docx")
d2 = Document(f2)

# §1.2 软件概述
p = find(d2, "本软件是一款运行于抖音小游戏平台")
set_text(p, "本软件是一款运行于抖音小游戏平台的休闲益智类合成游戏软件，采用 Cocos Creator "
    "引擎与 TypeScript 语言开发。用户在猫咪甜品店场景中，通过触摸操作将不同等级的甜品投放到"
    "容器内，两个相同等级的甜品碰撞后自动合成为更高一级的甜品。游戏场景顶部排布猫咪顾客，每"
    "位顾客提出所需甜品的等级与数量，玩家通过合成对应等级的甜品来满足顾客订单；满足本关全部"
    "顾客订单即通关并进入下一关，当甜品堆积超出容器顶部警戒线时本局游戏失败。软件提供计分结"
    "算、排行榜、每日礼包、音效设置、本地存档等功能。")

# §3.2 开始游戏
p = find(d2, "进入游戏场景。游戏场景包含")
set_text(p, "用户点击主界面的“开始游戏”按钮进入游戏场景。游戏场景包含：顶部的当前分数显示与"
    "暂停按钮、场景上方排布的猫咪顾客及其订单气泡、待投放的甜品、中部的甜品容器以及容器顶部的"
    "警戒线。每位顾客的气泡显示其需要的甜品图标与完成进度（如“2/3”）。")

# §3.4 标题 + 正文（通关/失败结算）
h = find(d2, "3.4 游戏结束判定")
set_text(h, "3.4 通关与失败结算")
body = find(d2, "容器顶部设有警戒线")
set_text(body, "本关达成通关或失败时，软件弹出相应的结算弹窗。当玩家满足本关全部猫咪顾客的订"
    "单时，判定通关，弹出胜利结算弹窗，依据本关得分给出一至三星评定，并显示本关得分、获得的猫"
    "币奖励与本关好友排名；弹窗提供“下一关”（最后一关为“返回首页”）、“返回”与“炫耀战绩”"
    "（分享）按钮，玩家还可点击“看广告，奖励翻倍”观看激励视频后将本关猫币奖励翻倍。")
note = find(d2, "插图 3-6")
# 在 note 前插入失败结算段落，字体沿用 body 首个 run
ref = body.runs[0].font
fail = note.insert_paragraph_before("")
fr = fail.add_run("当容器内堆积的甜品超出容器顶部警戒线并持续一定时间后，判定本局失败，弹出失败"
    "结算弹窗，显示本关完成订单进度与本局得分，并提供“返回首页”与“再试一次”按钮；玩家可点击"
    "“看广告，清空上半区复活”观看激励视频后清除容器上半部分的甜品并继续本局游戏。")
fr.font.color.rgb = BLACK
if ref.size: fr.font.size = ref.size
if ref.name:
    fr.font.name = ref.name
    from docx.oxml.ns import qn
    rpr = fr._element.get_or_add_rPr()
    rf = rpr.makeelement(qn('w:rFonts'), {})
    rf.set(qn('w:eastAsia'), "宋体"); rpr.append(rf)
set_text(note, "【插图 3-6：结算弹窗截图】图 3-6 结算弹窗（通关结算 / 失败结算）")

# §3.6 顾客系统（替换占位）
p = find(d2, "未能读取其具体逻辑")
set_text(p, "本软件的核心目标系统为顾客订单系统。每进入一关，游戏场景顶部最多同时出现三位猫咪顾"
    "客，每位顾客通过头顶气泡展示其订单需求，即所需甜品的等级（种类）与数量。玩家在容器中合成出"
    "某一等级的甜品时，若当前存在需要该等级甜品的顾客，则自动为其满足一份订单，气泡上的完成数量"
    "相应增加。当一位顾客的全部订单被满足后，该顾客显示满意表情并离场，随后队列中的下一位顾客补"
    "位进场。当本关全部顾客的订单均被满足时，本关通关并弹出胜利结算弹窗（见 3.4 节）。各关卡的顾"
    "客数量与订单需求由关卡配置数据预先设定，并随关卡推进逐步增加难度。")

d2.save(f2)
print("OK file2 操作说明书")

# ========== 文件 1 · 申请表填写指南 ==========
f1 = os.path.join(D, "1-软件著作权登记申请表填写指南.docx")
d1 = Document(f1)

# §三 主要功能和技术特点（加入顾客订单玩法）
p = find(d1, "本软件是一款运行于抖音小游戏平台")
set_text(p, "本软件是一款运行于抖音小游戏平台的休闲益智类合成游戏软件，采用 Cocos Creator 引擎"
    "与 TypeScript 语言开发，竖屏 720×1280 分辨率适配。主要功能包括：游戏资源加载与场景管理"
    "（加载、主界面、游戏、排行榜、设置五个场景）；核心合成玩法——用户通过触摸操作控制甜品的投"
    "放位置，将甜品投入容器，两个相同等级的甜品碰撞后合成更高一级甜品；顾客订单玩法——游戏场景"
    "顶部出现猫咪顾客并提出所需甜品的等级与数量，玩家通过合成对应甜品满足顾客订单，满足本关全部"
    "顾客订单即判定通关并进入下一关，若甜品堆积超出容器顶部警戒线则本局失败；计分与结算系统，支"
    "持胜利、失败结算弹窗；排行榜功能，通过网络接口提交并查询玩家成绩；每日礼包、暂停、设置（音"
    "乐音效开关）等辅助功能；游戏进度与设置数据的本地存储。技术特点：采用场景—组件化架构，游戏逻"
    "辑（合成判定、溢出检测、计分、顾客订单匹配）与界面表现分离；甜品等级与属性、关卡顾客需求采用"
    "配置化数据管理，便于扩展；接入抖音小游戏平台接口实现安全区适配与平台能力调用；针对移动端进"
    "行了资源加载与渲染性能优化。")

# 表格字段补全
for tbl in d1.tables:
    for row in tbl.rows:
        key = row.cells[0].text.strip()
        if key == "软件开发环境/开发工具":
            cell_set(row.cells[1], "Cocos Creator 3.8.8、Visual Studio Code、Node.js v20.19.6")
        elif key == "源程序量":
            cell_set(row.cells[1], "7626 行（assets/scenes/scripts 目录下 35 个自有 .ts 源文件，"
                "不含抖音平台 API 类型声明文件 tt.d.ts）")
        elif key == "开发该软件的操作系统":
            cell_set(row.cells[1], "Windows 11")

d1.save(f1)
print("OK file1 申请表填写指南")

# ========== 文件 3 · 源代码鉴别材料（指南，加状态说明）==========
f3 = os.path.join(D, "3-源代码鉴别材料模板.docx")
d3 = Document(f3)
first = d3.paragraphs[0]
note = first.insert_paragraph_before("")
r = note.add_run("✅ 成稿已生成：本目录 3-源代码鉴别材料-成稿.docx（35 个自有 .ts 文件，按下表顺序"
    "拼接，前 30 页 + 后 30 页，共 60 页，9 磅等宽字体）。⚠ 源程序量请填 7626 行：Windows "
    "PowerShell 5.1 的 Get-Content | Measure-Object -Line 对 LF（Unix）换行的文件会少算，请勿采用；"
    "按字节级换行统计，35 个文件实际共 7626 行。")
r.font.bold = True
r.font.color.rgb = BLACK
d3.save(f3)
print("OK file3 源代码鉴别材料指南")

# ========== 文件 4 · 身份证明与提交清单 ==========
f4 = os.path.join(D, "4-身份证明与提交材料清单.docx")
d4 = Document(f4)

# 状态总览表更新
for tbl in d4.tables:
    for row in tbl.rows:
        k = row.cells[0].text.strip()
        if k.startswith("1 ") and "申请表" in k:
            cell_set(row.cells[1], "已按项目填充（源程序量 7626、开发工具版本已补）")
            cell_set(row.cells[2], "补：申请人姓名、开发完成日期、确认软件全称并查重")
        elif k.startswith("2 ") and "操作说明书" in k:
            cell_set(row.cells[1], "正文已成稿（§3.6 顾客系统、通关/失败结算已据代码补全）")
            cell_set(row.cells[2], "补：9 张界面截图")
        elif k.startswith("3 ") and "源代码" in k:
            cell_set(row.cells[1], "✅ 成稿已生成")
            cell_set(row.cells[2], "见 3-源代码鉴别材料-成稿.docx（35 文件 / 7626 行 / 前30+后30 页）")

# 风险提示：点单玩法已在 V1.0，改指向家园系统
p = find(d4, "顾客点单玩法正式加入")
if p:
    set_text(p, "游戏后续上线如有大版本改动（如家园/装修养成系统正式加入），建议以 V2.0 重新登记。"
        "（注：当前 V1.0 已包含猫咪顾客订单玩法，见操作说明书 3.6 节，无需另行说明。）")

# 路线图：行数统计步骤标注已完成
p = find(d4, "统计源代码行数")
if p:
    set_text(p, "统计源代码行数（命令见文件 3），拼好源代码材料，填入申请表“源程序量”。"
        "（✅ 已完成：源程序量 7626 行，成稿见 3-源代码鉴别材料-成稿.docx）")

d4.save(f4)
print("OK file4 提交清单")
print("ALL DONE")
