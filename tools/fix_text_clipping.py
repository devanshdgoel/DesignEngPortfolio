"""Repair text that figma_export.py clipped.

figma_export.py rebuilds each slide from its layers, rendering every layer
cropped to its own box ("use_absolute_bounds"). Text whose glyphs reach past
its text box (big headings, descenders, tight line-height) loses its top or
bottom. Figma's render of the whole frame (in tools/.figma-cache) is correct,
so this takes the slide from that render instead, except for:
  - the HIDE layers (the left-edge 1-4 ticks), kept hidden by copying that
    patch from the rebuilt slide;
  - slides with lifted layers (NN-bg.webp): only the clipped text is patched
    in, where the rebuilt slide differs from Figma's render.

Run after tools/figma_export.py:   python tools/fix_text_clipping.py
Needs: pip install pillow numpy. No Figma token needed (reads the cache).
"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter

here = os.path.dirname(os.path.abspath(__file__))
slides = os.path.join(here, "..", "slides")
cache = os.path.join(here, ".figma-cache")
QUALITY = 90

TICKS_X = 72          # px: the left-edge ticks sit within this many px of the left edge
DIFF = 40             # per-channel difference that counts as "different"


def load_manifest():
    text = open(os.path.join(slides, "manifest.js"), encoding="utf-8").read()
    return json.loads(text[text.index("{"): text.rindex("}") + 1])


def frame_render(fid):
    # The most recently written cache version that has this frame.
    versions = sorted((os.path.join(cache, v) for v in os.listdir(cache)), key=os.path.getmtime, reverse=True)
    for v in versions:
        p = os.path.join(v, fid.replace(":", "-") + "_2.5_abs.png")
        if os.path.exists(p):
            return Image.open(p).convert("RGB")
    return None


def save(img, path):
    img.save(path, quality=QUALITY, method=6)


def main():
    man = load_manifest()
    for s in man["slides"]:
        path = os.path.join(slides, os.path.basename(s["src"]))
        cur_img = Image.open(path).convert("RGB")
        ref_img = frame_render(s["id"])
        if ref_img is None:
            print(f"  {s['n']:02d}  no cached render, skipped")
            continue
        size = cur_img.size
        # The rebuilt slide is positioned from the frame's top-left: crop, don't scale.
        ref_img = ref_img.crop((0, 0) + size)
        cur, ref = np.asarray(cur_img), np.asarray(ref_img)
        diff = np.abs(cur.astype(int) - ref.astype(int)).max(2) > DIFF

        # Left-edge ticks (hidden): keep the rebuilt slide's pixels there.
        keep = np.zeros(diff.shape, bool)
        ys, xs = np.nonzero(diff[:, :TICKS_X])
        if len(ys):
            keep[max(0, ys.min() - 8): ys.max() + 9, :TICKS_X] = True

        out = np.where(keep[..., None], cur, ref)
        save(Image.fromarray(out.astype("uint8")), path)

        msg = f"  {s['n']:02d}  {s['name']:22s} fixed ({diff.mean() * 100:.2f}% of pixels changed)"
        if s.get("bg"):
            # Only the clipped text goes into the background (lifted layers stay out).
            bpath = os.path.join(slides, os.path.basename(s["bg"]))
            bg = np.asarray(Image.open(bpath).convert("RGB"))
            m = Image.fromarray((diff & ~keep).astype("uint8") * 255).filter(ImageFilter.MaxFilter(5))
            m = np.asarray(m) > 0
            # Don't patch around lifted layers (they aren't in the background; a lifted
            # label's overflow must not show before the label animates in).
            for name, L in s.get("layers", {}).items():
                x, y, w, h = [round(v * 2.5) for v in L["rect"]]
                if w * h > 0.5 * size[0] * size[1]:
                    # Full-slide layers (renders): skip wherever the layer itself has pixels.
                    a = Image.open(os.path.join(slides, os.path.basename(L["src"]))).getchannel("A")
                    a = a.resize((w, h)).filter(ImageFilter.MaxFilter(9))
                    full = Image.new("L", size, 0)
                    full.paste(a, (x, y))
                    m &= np.asarray(full) < 8
                    continue
                pad = max(12, h // 2)
                m[max(0, y - pad): max(0, y + h + pad), max(0, x - pad): max(0, x + w + pad)] = False
            save(Image.fromarray(np.where(m[..., None], ref, bg).astype("uint8")), bpath)
            msg += " + background"
        print(msg)


if __name__ == "__main__":
    main()
