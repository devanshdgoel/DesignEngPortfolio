"""
remove_indicator.py — paint out the left-edge "1-4 project" ticks
(one orange + three grey lines) that are baked into the slide images.

    python tools/remove_indicator.py

Run it from the v2 folder, after render_pdf.py. Originals are copied to
slides_original/ the first time. Each tick is replaced by blending the pixel
rows just above and below it, so it disappears into the background.
Lines that run further right than the ticks (real design lines, e.g. on s06)
are left alone.
"""
import os, glob, shutil
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
slides = os.path.join(here, "..", "slides")
backup = os.path.join(here, "..", "slides_original")

Y_RANGE = (0.42, 0.60)  # where the ticks sit, as a fraction of slide height
MAX_X = 75              # ticks end before this x (px at 2.5x render scale)
PAD = 3                 # extra rows / columns to cover anti-aliased edges


def tick_rows(a):
    """Row groups (y0, y1, x_end) in the left band that look like short ticks."""
    h = a.shape[0]
    y_lo, y_hi = int(h * Y_RANGE[0]), int(h * Y_RANGE[1])
    ref = a[:, 110:111]                                   # local background
    diff = np.abs(a[:, :200] - ref).sum(2) > 90
    rows = [y for y in range(y_lo, y_hi) if diff[y, :MAX_X].sum() > 25]
    groups = []
    for y in rows:
        if groups and y <= groups[-1][1] + 2:
            groups[-1][1] = y
        else:
            groups.append([y, y])
    out = []
    for y0, y1 in groups:
        xs = np.where(diff[y0:y1 + 1].any(0))[0]
        if len(xs) and xs.max() < MAX_X and y1 - y0 < 12:   # short and thin → a tick
            out.append((y0, y1, int(xs.max())))
    return out


def main():
    if not os.path.isdir(backup):
        shutil.copytree(slides, backup)
        print(f"Backed up originals to {os.path.normpath(backup)}")

    for path in sorted(glob.glob(os.path.join(slides, "*.webp"))):
        name = os.path.basename(path)
        a = np.asarray(Image.open(path).convert("RGB")).astype(float)
        ticks = tick_rows(a)
        if len(ticks) < 2:                                # not an indicator (e.g. the cover photo)
            continue
        for y0, y1, x_end in ticks:
            top, bot = y0 - PAD, y1 + PAD
            x1 = x_end + PAD + 1
            above, below = a[top - 1, :x1], a[bot + 1, :x1]
            for y in range(top, bot + 1):
                k = (y - top + 1) / (bot - top + 2)
                a[y, :x1] = above * (1 - k) + below * k
        Image.fromarray(a.round().astype(np.uint8)).save(
            os.path.join(slides, name), "WEBP", quality=92, method=6)
        print(f"{name}: removed {len(ticks)} ticks")


if __name__ == "__main__":
    main()
