"""
build_sequences.py — turn the Blender PNG renders into web-sized frames.

    python tools/build_sequences.py

Run it from the v2 folder. For each sequence in SEQUENCES below it:
  1. finds the area that is ever non-transparent across all frames (the product)
  2. crops every frame to that area and scales it down (SCALE)
  3. saves sequences/<name>/0000.webp, 0001.webp, ... (with transparency)
  4. writes sequences/sequences.js: frame count, and where the crop sits inside
     the full 16:9 render — main.js uses it to place the frames.

Needs:  pip install pillow numpy
"""
import os, json, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image, ImageFilter

SRC = r"C:/Users/devan/Desktop/Design/PortfolioWebsiteOld/Stride"
here = os.path.dirname(os.path.abspath(__file__))
SEQUENCES = {
    # name:      (folder,     first, last, step[, scale])   folder: inside SRC, or a full path
    "cover3":   ("Cover3",    160,   350,  2),   # Stride cover → base close-up (fades out ~347)
    "explode1": ("Explode1",  40,    190,  2),   # bottom of the product exploding (ends on the Figma still)
    "explode2": ("Explode2",  205,   245,  1),   # top of the product exploding (Figma still = frame 0245;
                                                 #   before 205 the camera is still on the base)
    # Solus Structures: full-slide frames (1302 x 842, the slide's own size), so no downscaling.
    # The PNGs stay out of git (.gitignore): only sequences/solus/ is published.
    "solus":    (os.path.join(here, "..", "sequences", "solus_structures"), 1, 50, 1, 1.0),
    # Calyx cover → Concept development: full-slide frames too (frame 0000 is the cover still).
    "calyx":    (os.path.join(here, "..", "sequences", "calyx_cover"), 0, 85, 1, 1.0),
}
SCALE   = 0.5      # 3840 → 1920 px wide render
QUALITY = 78       # WebP quality
ALPHA_FLOOR = 14   # alpha below this is dropped: the renders carry a faint haze that is
                   # invisible on the dark slides but stops the frames from being cropped
PAD     = 8        # px (source) around the product's bounding box
FEATHER = {"calyx": 40}   # px: these renders have a soft floor shadow, so instead of the hard
                          # ALPHA_FLOOR cut, alpha ramps in softly and fades out towards the
                          # frame's edges (no straight lines where the shadow is cut off)

out_root = os.path.join(here, "..", "sequences")


def frame_path(folder, n):
    return os.path.join(SRC, folder, f"{n:04d}.png")


def alpha_box(path):
    a = np.asarray(Image.open(path).getchannel("A"))
    ys, xs = np.nonzero(a >= ALPHA_FLOOR)
    if not len(xs):
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def convert(args):
    src, dst, box, size, feather = args
    im = Image.open(src).crop(box)
    a = np.asarray(im.getchannel("A")).copy()
    if feather:
        # The shadow is noisy: smooth it (the product itself, a > 100, stays sharp), and
        # make its colour plain black, so it compresses well.
        solid = np.asarray(Image.fromarray(((a > 100) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
        soft = np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(4))).astype(float)
        f = np.where(solid, a, soft)                  # (keeps the product's anti-aliased edge)
        f *= np.clip((f - 6) / 14, 0, 1)
        rgb = np.asarray(im.convert("RGB")).copy()
        rgb[~solid] = 0
        im = Image.fromarray(rgb)
        h, w = a.shape
        ramp = lambda n: np.clip(np.minimum(np.arange(n), np.arange(n)[::-1]) / feather, 0, 1)
        a = (f * ramp(h)[:, None] * ramp(w)[None, :]).round().astype(np.uint8)
    else:
        a[a < ALPHA_FLOOR] = 0
    im.putalpha(Image.fromarray(a))
    im = im.resize(size, Image.LANCZOS)
    im.save(dst, quality=QUALITY, alpha_quality=80, method=5)
    return os.path.getsize(dst)


def build(name, folder, first, last, step, pool, scale=SCALE):
    frames = list(range(first, last + 1, step))
    paths = [frame_path(folder, n) for n in frames]
    boxes = [b for b in pool.map(alpha_box, paths, chunksize=8) if b]
    W, H = Image.open(paths[0]).size
    x0 = max(0, min(b[0] for b in boxes) - PAD)
    y0 = max(0, min(b[1] for b in boxes) - PAD)
    x1 = min(W, max(b[2] for b in boxes) + PAD)
    y1 = min(H, max(b[3] for b in boxes) + PAD)
    size = (round((x1 - x0) * scale), round((y1 - y0) * scale))

    out = os.path.join(out_root, name)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith(".webp"):
            os.remove(os.path.join(out, f))
    jobs = [(p, os.path.join(out, f"{k:04d}.webp"), (x0, y0, x1, y1), size, FEATHER.get(name)) for k, p in enumerate(paths)]
    total = sum(pool.map(convert, jobs, chunksize=4))

    return {
        "frames": len(frames),
        "sourceFrames": [first, last, step],
        "render": [W, H],                       # full render size (px)
        "crop": [x0 / W, y0 / H, (x1 - x0) / W, (y1 - y0) / H],   # x, y, w, h as fractions of the render
        "size": size,                           # px of each saved frame
        "dir": f"sequences/{name}/",
    }, total


if __name__ == "__main__":
    only = sys.argv[1:]
    index = os.path.join(out_root, "sequences.js")
    metas = {}
    if os.path.exists(index):                             # keep the ones not rebuilt this time
        txt = open(index, encoding="utf-8").read()
        metas = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    with ProcessPoolExecutor(max_workers=4) as pool:      # 4K RGBA frames are ~33 MB each in memory
        for name, spec in SEQUENCES.items():
            if not only or name in only:
                metas[name], total = build(name, *spec[:4], pool, *spec[4:])
                m = metas[name]
                print(f"  {name:9s} {m['frames']:4d} frames  {m['size'][0]}x{m['size'][1]}  {total / 1e6:6.1f} MB")
    with open(index, "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/build_sequences.py — don't edit by hand.\n")
        fh.write("window.SEQUENCES = " + json.dumps(metas, indent=1) + ";\n")
    print(f"\nSaved to {os.path.normpath(out_root)}")
