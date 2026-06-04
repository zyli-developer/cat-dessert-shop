#!/usr/bin/env python3
"""
subset_font.py — shrink the bundled Chinese TTF to only the glyphs the game
statically displays, to fit the Douyin 4 MB main-package limit.

The full ZCOOLKuaiLe TTF carries the whole CJK glyph set (~1.5 MB). The game
only ever *statically* renders a few dozen Chinese characters (UI labels,
dessert names, level configs). Dynamic player nicknames (rank list) are handled
separately by forcing those labels to the system font, so they are NOT a
concern here.

Charset sources (so we never subset away a character that is actually drawn):
  - String LITERALS in .ts (quotes only; code comments are intentionally
    excluded so their Chinese doesn't bloat the subset).
  - All JSON string values in .scene / .prefab / .json (Label _string, dessert
    names, level configs, etc.).
  - A curated safety net of common UI characters.
  - Always: ASCII printables + digits.

Run:
    python scripts/subset_font.py            # write subset in place (backs up .orig)
    python scripts/subset_font.py --dry-run  # just report the charset + sizes
"""
import os
import re
import sys
import string

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "client/assets/resources/fonts/ZCOOLKuaiLe-Regular.ttf")
SCAN_DIRS = [
    os.path.join(ROOT, "client/assets/scenes"),
    os.path.join(ROOT, "client/assets/resources"),
    os.path.join(ROOT, "client/assets/prefabs"),
]
DRY = "--dry-run" in sys.argv

# Quoted string literals in TS/JS: '...', "...", `...`
TS_STRING = re.compile(r"'([^'\\]*(?:\\.[^'\\]*)*)'|\"([^\"\\]*(?:\\.[^\"\\]*)*)\"|`([^`\\]*(?:\\.[^`\\]*)*)`")
# JSON string values: "...": "value"  -> grab any double-quoted run
JSON_STRING = re.compile(r"\"([^\"\\]*(?:\\.[^\"\\]*)*)\"")

# Safety net: common UI words that might be assembled at runtime from variables.
SAFETY = (
    "猫咪甜品店登录离线模式开始游戏看广告加到侧边栏第关我的排名名玩家未解锁"
    "暂停继续重试返回主页胜利失败结算分数金币星级关卡音乐音效设置确定取消"
    "正在加载资源配置完成请稍候网络错误重新连接成功恭喜通过获得奖励"
    "★☆°，。、！？：；（）【】—…"
)


def is_cjk_or_symbol(ch: str) -> bool:
    o = ord(ch)
    return o >= 0x00A0  # everything above Latin-1 control range (CJK, symbols, punctuation)


def collect_chars() -> set:
    chars = set()
    chars.update(string.printable)  # ASCII letters, digits, punctuation, whitespace
    chars.update(SAFETY)

    for base in SCAN_DIRS:
        for dirpath, _, files in os.walk(base):
            for fn in files:
                ext = os.path.splitext(fn)[1].lower()
                if ext not in (".ts", ".scene", ".prefab", ".json"):
                    continue
                path = os.path.join(dirpath, fn)
                try:
                    text = open(path, encoding="utf-8").read()
                except Exception:
                    continue
                if ext == ".ts":
                    for m in TS_STRING.finditer(text):
                        s = next(g for g in m.groups() if g is not None)
                        chars.update(c for c in s if is_cjk_or_symbol(c))
                else:
                    for m in JSON_STRING.finditer(text):
                        chars.update(c for c in m.group(1) if is_cjk_or_symbol(c))
    return chars


def main():
    chars = collect_chars()
    cjk = sorted(c for c in chars if ord(c) >= 0x2E80)
    print(f"charset: {len(chars)} total, {len(cjk)} CJK/symbol glyphs")
    print("CJK sample:", "".join(cjk[:80]))

    before = os.path.getsize(FONT)
    if DRY:
        print(f"\n[DRY RUN] font {before/1024:.0f}K — no changes written")
        return

    from fontTools import subset

    backup = FONT + ".orig"
    if not os.path.exists(backup):
        import shutil
        shutil.copy2(FONT, backup)
        print(f"backup saved: {os.path.relpath(backup, ROOT)}")

    text = "".join(sorted(chars))
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = []
    subsetter = subset.Subsetter(options=options)
    font = subset.load_font(backup, options)  # subset from the pristine original
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, FONT, options)

    after = os.path.getsize(FONT)
    print(f"\nsubset written: {before/1024:.0f}K -> {after/1024:.0f}K "
          f"({100*after/before:.0f}%, saved {(before-after)/1024:.0f}K)")
    print("Next: reimport the font in Cocos Creator, then rebuild.")


if __name__ == "__main__":
    main()
