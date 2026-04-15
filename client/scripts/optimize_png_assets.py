# -*- coding: utf-8 -*-
"""批量缩小/压缩 textures 下异常偏大的 PNG，用于抖音小游戏包体瘦身。
   在仓库根目录执行: python client/scripts/optimize_png_assets.py
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

# client/assets 目录
ASSETS = Path(__file__).resolve().parent.parent / "assets"
TEXTURES = ASSETS / "textures"


def fit_max_width(im: Image.Image, max_w: int) -> Image.Image:
    w, h = im.size
    if w <= max_w:
        return im
    nh = max(1, int(round(h * max_w / w)))
    return im.resize((max_w, nh), Image.Resampling.LANCZOS)


def fit_max_edge(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    edge = max(w, h)
    if edge <= max_edge:
        return im
    scale = max_edge / edge
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def save_png_optimized(path: Path, im: Image.Image) -> None:
    # 保留 RGBA / RGB / P
    if im.mode == "P":
        im.save(path, optimize=True, compress_level=9)
    else:
        im.save(path, optimize=True, compress_level=9)


def main() -> None:
    bg_dir = TEXTURES / "bg"
    ui_dir = TEXTURES / "ui"

    # 全屏背景（与 720×1280 设计一致）：最大宽度 720，显著减小包体
    for name in ("home_bg.png", "loading_bg.png"):
        p = bg_dir / name
        if not p.is_file():
            continue
        before = p.stat().st_size
        im = Image.open(p)
        im = fit_max_width(im, 720)
        save_png_optimized(p, im)
        after = p.stat().st_size
        print(f"[bg] {name}: {before // 1024} KB -> {after // 1024} KB")

    # 其余背景：最大宽度 1440（约 @2x）
    for name in ("background.png", "bg_game.png", "bg_home.png", "bg_loading.png"):
        p = bg_dir / name
        if not p.is_file():
            continue
        before = p.stat().st_size
        im = Image.open(p)
        im = fit_max_width(im, 1440)
        save_png_optimized(p, im)
        after = p.stat().st_size
        print(f"[bg] {name}: {before // 1024} KB -> {after // 1024} KB")

    # 导航按钮误导出为 2048 纹理，缩小到最长边 512（@2x 下 UI 仍清晰）
    for name in ("btn_prev.png", "btn_next.png"):
        p = ui_dir / name
        if not p.is_file():
            continue
        before = p.stat().st_size
        im = Image.open(p)
        im = fit_max_edge(im, 512)
        save_png_optimized(p, im)
        after = p.stat().st_size
        print(f"[ui] {name}: {before // 1024} KB -> {after // 1024} KB")

    p = ui_dir / "btn_rank.png"
    if p.is_file():
        before = p.stat().st_size
        im = Image.open(p)
        im = fit_max_edge(im, 512)
        save_png_optimized(p, im)
        after = p.stat().st_size
        print(f"[ui] btn_rank.png: {before // 1024} KB -> {after // 1024} KB")

    p = ui_dir / "buttons-sheet.png"
    if p.is_file():
        before = p.stat().st_size
        im = Image.open(p)
        im = fit_max_width(im, 1536)
        save_png_optimized(p, im)
        after = p.stat().st_size
        print(f"[ui] buttons-sheet.png: {before // 1024} KB -> {after // 1024} KB")

    print("Done.")


if __name__ == "__main__":
    main()
