"""
render_pdf.py — turn the tall Figma PDF into one image per slide.

    python tools/render_pdf.py "C:/Users/devan/Downloads/A4 - 20.pdf"

Run it from the v2 folder. It:
  1. renders the (single, tall) PDF page in 842-pt slices, one per A4-landscape slide
  2. saves them as slides/s01.webp, s02.webp, ...
  3. prints a SLIDE MAP: which slides are solid orange (project screens) or empty,
     so you can check the STOPS config in main.js still matches.

Needs:  pip install pymupdf pillow
"""
import sys, os
import pymupdf
from PIL import Image

SLIDE_W, SLIDE_H = 1190, 842   # PDF points (one A4-landscape slide)
SCALE   = 2.5                  # render resolution: 2.5 → ~2975 px wide (sharp on retina)
QUALITY = 92                   # WebP quality (92 = visually lossless)
ACCENT  = (235, 70, 4)         # #EB4604 — used to spot the orange project screens

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "..", "slides")


def is_orange_row(img, y):
    """True if pixel row y is (almost) all accent orange."""
    row = img.crop((0, y, img.width, y + 1)).resize((200, 1)).getdata()
    hits = sum(1 for (r, g, b) in row
               if abs(r - ACCENT[0]) < 35 and abs(g - ACCENT[1]) < 45 and b < 70)
    return hits / 200 > 0.9


def main(pdf_path):
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):                 # clear old slides
        if f.endswith(".webp"):
            os.remove(os.path.join(out_dir, f))

    page = pymupdf.open(pdf_path)[0]
    width, height = page.rect.width, page.rect.height
    count = round(height / SLIDE_H)
    print(f"Page {width:.0f} × {height:.0f} pt → {count} slides of {SLIDE_H} pt\n")

    prev_orange = False
    for i in range(count):
        clip = pymupdf.Rect(0, i * SLIDE_H, width, min((i + 1) * SLIDE_H, height))
        pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=clip, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        # The orange project screens in Figma overrun a few points into the next
        # slide. The website skips orange slides (the wipe replaces them), so paint
        # that overrun with the colour of the first clean row underneath.
        if prev_orange:
            n = 0
            while n < img.height // 10 and is_orange_row(img, n):
                n += 1
            if n:
                n += 3          # plus the soft anti-aliased edge rows
                clean = img.crop((0, n, img.width, n + 1)).resize((img.width, n))
                img.paste(clean, (0, 0))

        name = f"s{i + 1:02d}.webp"
        img.save(os.path.join(out_dir, name), quality=QUALITY, method=6)

        # --- classify the slide for the map ---
        small = img.resize((119, 84))
        px = list(small.getdata())
        orange = sum(1 for (r, g, b) in px
                     if abs(r - ACCENT[0]) < 30 and abs(g - ACCENT[1]) < 40 and b < 60) / len(px)
        lum = [(r + g + b) / 3 for (r, g, b) in px]
        mean = sum(lum) / len(lum)
        spread = (sum((l - mean) ** 2 for l in lum) / len(lum)) ** 0.5
        kind = "ORANGE" if orange > 0.8 else "empty" if spread < 3 else ""
        prev_orange = kind == "ORANGE"
        size_kb = os.path.getsize(os.path.join(out_dir, name)) // 1024
        print(f"  {name}  {size_kb:5d} KB  orange {orange:4.0%}  {kind}")

    print(f"\nSaved to {os.path.normpath(out_dir)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/devan/Downloads/A4 - 20.pdf")
