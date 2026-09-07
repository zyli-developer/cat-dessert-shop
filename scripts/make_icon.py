#!/usr/bin/env python
"""
make_icon.py — 把 Gemini 生成的「纯色背景 + 卡通主体」图，抠出主体并合成为
抖音小游戏合规图标（512x512、全出血方角、<=200KB、PNG+JPG）。

工作流：
  1. Gemini 生成：主体（猫+甜品，带白色 die-cut 描边）放在【纯色背景】上，
     无圆角框、无渐变、无投影。
  2. 本脚本：边缘连通色键抠背景 -> 自动裁切 -> 居中贴到代码生成的暖色渐变背景。

用法：
  python scripts/make_icon.py <输入图> [-o 输出前缀] [--tol 70] [--scale 0.84]
                                       [--no-sparkle] [--bg cream-peach]
例：
  python scripts/make_icon.py C:/Users/Lenovo/Downloads/Gemini_xxx.png

输出：<前缀>.png（256 色，<=200KB）与 <前缀>.jpg（q92）。
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw


def load_rgb(path):
    im = Image.open(path)
    if im.mode == "RGBA":
        # 若本身带有效透明通道（已抠图），直接用它
        a = np.asarray(im.split()[-1])
        if (a < 250).mean() > 0.02:
            return im.convert("RGBA"), True
    return im.convert("RGB"), False


def grow_flood(cand, seed):
    """在 cand(bool) 内，从 seed(bool) 做 4 邻接连通扩张到稳定。"""
    s = seed & cand
    while True:
        g = s.copy()
        g[1:, :] |= s[:-1, :]; g[:-1, :] |= s[1:, :]
        g[:, 1:] |= s[:, :-1]; g[:, :-1] |= s[:, 1:]
        g &= cand
        if g.sum() == s.sum():
            return s
        s = g


def extract_alpha(rgb, tol):
    """边缘连通色键：只移除与画布边缘相连、颜色接近背景的像素。"""
    a = np.asarray(rgb).astype(np.float32)
    H, W, _ = a.shape
    # 背景色 = 四角 40x40 中位数
    corners = np.concatenate([
        a[:40, :40].reshape(-1, 3), a[:40, -40:].reshape(-1, 3),
        a[-40:, :40].reshape(-1, 3), a[-40:, -40:].reshape(-1, 3),
    ], 0)
    bg = np.median(corners, 0)
    dist = np.sqrt(((a - bg) ** 2).sum(2))
    cand = dist < tol                      # 颜色接近背景的候选
    edge = np.zeros((H, W), bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    bgmask = grow_flood(cand, edge)        # 仅边缘连通的背景，主体内部同色不误删
    alpha = np.where(bgmask, 0, 255).astype(np.uint8)
    # 内缩 1px 再羽化，消除背景色边缘残留
    am = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3))
    am = am.filter(ImageFilter.GaussianBlur(0.8))
    return np.asarray(am)


def keep_main_component(alpha):
    """只保留最大的连通主体（猫），丢弃漂浮的小碎片（如背景里的星星残留）。"""
    cand = alpha > 16
    H, W = cand.shape
    cy, cx = H // 2, W // 2
    seed = np.zeros_like(cand)
    seed[cy-4:cy+4, cx-4:cx+4] = cand[cy-4:cy+4, cx-4:cx+4]
    if not seed.any():                     # 中心恰好空 -> 退而用最稠密列
        col = cand.sum(0).argmax(); seed[:, col] = cand[:, col]
    main = grow_flood(cand, seed)
    out = alpha.copy(); out[~main] = 0
    dropped = int((cand & ~main).sum())
    if dropped:
        print(f"[i] 丢弃漂浮碎片 {dropped} px（背景星星/噪点）")
    return out


def trim(rgb, alpha):
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return rgb, alpha
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]


def brand_bg(size, kind, sparkle):
    """代码生成的纯净全出血暖色渐变背景（无圆角、无白角）。"""
    palettes = {
        "cream-peach": (np.array([255, 247, 236]), np.array([255, 220, 192])),
        "pink":        (np.array([255, 243, 240]), np.array([255, 214, 214])),
        "mint":        (np.array([240, 250, 244]), np.array([206, 236, 222])),
    }
    c0, c1 = palettes.get(kind, palettes["cream-peach"])
    y, x = np.mgrid[0:size, 0:size]
    t = ((x + y) / (2.0 * (size - 1)))[..., None]
    g = (c0 * (1 - t) + c1 * t).astype(np.uint8)
    img = Image.fromarray(g, "RGB").convert("RGBA")
    if sparkle:
        _draw_sparkles(img, size)
    return img.convert("RGB")


def _star4(draw, cx, cy, r, color):
    """四角闪光星（尖角内凹），白色微透。"""
    ri = r * 0.16
    pts = [(cx, cy-r), (cx+ri, cy-ri), (cx+r, cy), (cx+ri, cy+ri),
           (cx, cy+r), (cx-ri, cy+ri), (cx-r, cy), (cx-ri, cy-ri)]
    draw.polygon(pts, fill=color)


def _draw_sparkles(img, size):
    """在上方/四角（猫盖不到处）撒几颗大小不一的星星 + 小圆点，柔和叠加。"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 512.0
    stars = [(0.13, 0.16, 13, 235), (0.87, 0.13, 16, 235), (0.93, 0.42, 9, 210),
             (0.07, 0.40, 8, 200), (0.78, 0.30, 6, 185), (0.22, 0.27, 6, 185)]
    for fx, fy, r, a in stars:
        _star4(d, fx*size, fy*size, r*s, (255, 255, 255, a))
    for fx, fy, r, a in [(0.30, 0.12, 4, 170), (0.70, 0.20, 3, 150), (0.96, 0.62, 3, 150)]:
        rr = r*s
        d.ellipse([fx*size-rr, fy*size-rr, fx*size+rr, fy*size+rr], fill=(255, 255, 255, a))
    layer = layer.filter(ImageFilter.GaussianBlur(0.4))
    img.alpha_composite(layer)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("-o", "--out", default="logo/cat_bakery_icon_512")
    ap.add_argument("--tol", type=float, default=70, help="背景色键容差(纯色背景可调小,带浅渐变/投影调大)")
    ap.add_argument("--scale", type=float, default=0.84, help="主体占图标边长比例(留安全边)")
    ap.add_argument("--bg", default="cream-peach", choices=["cream-peach", "pink", "mint"])
    ap.add_argument("--no-sparkle", action="store_true")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--maxkb", type=float, default=200, help="体积上限(KB)。PNG优先无损全彩,超限才降为256色")
    ap.add_argument("--anchor", default="bottom", choices=["bottom", "center"],
                    help="半身像用 bottom(身子贴底更自然)，整只独立形象用 center")
    args = ap.parse_args()

    im, has_alpha = load_rgb(args.input)
    if max(im.size) > 1400:                 # 降到工作分辨率，加速色键/连通(对 512 输出足够清晰)
        k = 1400 / max(im.size)
        im = im.resize((round(im.size[0]*k), round(im.size[1]*k)), Image.LANCZOS)
    if has_alpha:
        rgb = np.asarray(im.convert("RGB")); alpha = np.asarray(im.split()[-1])
        alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6)))
        print("[i] 输入自带透明通道，直接使用")
    else:
        rgb = np.asarray(im)
        alpha = extract_alpha(im, args.tol)
        alpha = keep_main_component(alpha)
        cov = (alpha > 16).mean()
        print(f"[i] 色键抠图完成，主体占比 {cov:.0%}")
        if cov < 0.15 or cov > 0.97:
            print(f"[!] 主体占比异常({cov:.0%})——背景可能不是纯色/容差不合适，"
                  f"试着调整 --tol（当前 {args.tol}）", file=sys.stderr)

    rgb, alpha = trim(rgb, alpha)
    sub = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")

    # 缩放主体到目标比例，居中
    S = args.size
    target = int(S * args.scale)
    w, h = sub.size
    k = target / max(w, h)
    sub = sub.resize((max(1, round(w*k)), max(1, round(h*k))), Image.LANCZOS)
    canvas = brand_bg(S, args.bg, not args.no_sparkle).convert("RGBA")
    ox = (S - sub.width)//2
    oy = (S - sub.height - int(S*0.04)) if args.anchor == "bottom" else (S - sub.height)//2
    canvas.alpha_composite(sub, (ox, oy))
    final = canvas.convert("RGB")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    jpg = args.out + ".jpg"; png = args.out + ".png"
    final.save(jpg, "JPEG", quality=95, optimize=True)
    final.save(png, "PNG", optimize=True)                 # 优先无损全彩
    if os.path.getsize(png) / 1024 > args.maxkb:          # 超预算才降为 256 色
        final.quantize(colors=256, method=Image.MEDIANCUT,
                       dither=Image.Dither.NONE).save(png, optimize=True)
        print("[i] PNG 超体积预算，已降为 256 色")
    for f in (png, jpg):
        kb = os.path.getsize(f)/1024
        flag = "OK" if kb <= args.maxkb else f"OVER-{args.maxkb:.0f}KB!"
        print(f"[done] {f}  {S}x{S}  {kb:.1f}KB  {flag}")


if __name__ == "__main__":
    main()
