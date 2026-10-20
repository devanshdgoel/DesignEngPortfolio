"""Full-screen backgrounds for slides whose background is a photo.

The slide is shown at its own size in the middle of the screen; its background
photo should fill the whole screen. For each slide in BACKDROPS this writes:
  slides/NN-backdrop.webp  the background on its own (photo + overlays), as large
                           as the Figma layers go (often beyond the slide's edges)
  slides/NN-fg.webp        the slide with the background removed (transparent),
                           i.e. the text and objects that sit on it
and slides/backdrops.js, which main.js reads.

The layer renders come from the Figma cache (tools/.figma-cache, written by
figma_export.py). Positions are in px at 2.5x, relative to the slide's top left
(found by matching each layer against Figma's render of the frame).
If the layers are moved in Figma, update the positions here.

Run after fix_text_clipping.py:  python tools/make_backdrops.py
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter

here = os.path.dirname(os.path.abspath(__file__))
slides = os.path.join(here, "..", "slides")
cache = os.path.join(here, ".figma-cache")
SCALE = 2.5
FILL = (16, 13, 13)                     # slide background colour

#  slide n → { "from": the slide image the foreground is cut from,
#              "layers": [(layer id, (x, y) px)], bottom first }
BACKDROPS = {
    1: {"from": "01.webp",    "layers": [("421:12", (-365, -525)), ("421:13", (0, 0))]},    # cover photo + dark gradient
    5: {"from": "05-bg.webp", "layers": [("421:70", (-104, -64))]},                          # Mechanical development photo (20%)
}


def render(lid):
    versions = sorted((os.path.join(cache, v) for v in os.listdir(cache)), key=os.path.getmtime, reverse=True)
    for v in versions:
        p = os.path.join(v, lid.replace(":", "-") + "_2.5_abs.png")
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    raise FileNotFoundError(f"{lid} isn't in the Figma cache — run figma_export.py first")


def stretch_to(im, x, y, box):
    """Pad a layer out to `box` (x0, y0, x1, y1) by repeating its edge pixels,
    so overlays (gradients) still cover the photo where it runs past them."""
    x0, y0, x1, y1 = box
    a = np.asarray(im)
    pad = ((max(0, y - y0), max(0, y1 - (y + im.height))), (max(0, x - x0), max(0, x1 - (x + im.width))), (0, 0))
    return Image.fromarray(np.pad(a, pad, mode="edge")), min(x, x0), min(y, y0)


def main():
    out = {}
    for n, cfg in BACKDROPS.items():
        src = Image.open(os.path.join(slides, cfg["from"])).convert("RGB")
        W, H = src.size
        layers = [(render(lid), xy) for lid, xy in cfg["layers"]]

        # 1. The background, as far as the bottom layer (the photo) reaches.
        photo, (px, py) = layers[0]
        box = (min(0, px), min(0, py), max(W, px + photo.width), max(H, py + photo.height))
        bw, bh = box[2] - box[0], box[3] - box[1]
        back = Image.new("RGBA", (bw, bh), FILL + (255,))
        for k, (im, (x, y)) in enumerate(layers):
            if k:                                            # overlays: stretched over the whole photo
                im, x, y = stretch_to(im, x, y, box)
            back.alpha_composite(im, (x - box[0], y - box[1]))
        back = back.convert("RGB")
        back.save(os.path.join(slides, f"{n:02d}-backdrop.webp"), quality=86, method=6)

        # 2. The foreground: wherever the slide differs from its background.
        base = np.asarray(back.crop((-box[0], -box[1], -box[0] + W, -box[1] + H)), int)
        d = np.abs(np.asarray(src, int) - base).max(2)
        alpha = np.clip((d - 22) / 22, 0, 1)        # (small differences are resampling noise in the photo)
        alpha[:, -3:] = alpha[:, -4:-3]              # the photo can stop a pixel short of the edge
        alpha = Image.fromarray((alpha * 255).astype("uint8")).filter(ImageFilter.MaxFilter(3))
        fg = src.convert("RGBA")
        fg.putalpha(alpha)
        fg.save(os.path.join(slides, f"{n:02d}-fg.webp"), quality=90, alpha_quality=90, method=6)

        out[n] = {"src": f"slides/{n:02d}-backdrop.webp", "fg": f"slides/{n:02d}-fg.webp",
                  "rect": [round(v / SCALE, 2) for v in (box[0], box[1], bw, bh)]}       # in slide points
        print(f"  {n:02d}  backdrop {bw}x{bh}px, foreground {(np.asarray(alpha) > 0).mean() * 100:.1f}% of the slide")

    with open(os.path.join(slides, "backdrops.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/make_backdrops.py — don't edit by hand.\n")
        fh.write("window.BACKDROPS = " + json.dumps(out, indent=1) + ";\n")


if __name__ == "__main__":
    main()
