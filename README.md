# Portfolio v2

Your Figma layout as a scroll-through website: one slide at a time, with a pause
on each slide and orange wipes between projects.

**Open it:** double-click `index.html`. No server is needed (GSAP loads from a CDN, so you need internet).

## Change things (all at the top of `main.js`)
- **Pacing:** `SETTINGS.holdVH` is the scroll where nothing moves; `travelVH` is the scroll to change page. One wheel notch is enough to change page (`commitAt`); `snapDuration` is how long that change takes to play (higher = slower, easier to follow).
- **Transitions:** each entry in `SLIDES` can have `transition: "slide" | "wipe" | "fade"`, `settle: true` and `glitch: true`.
- **Glitch:** slices of the slide jump sideways with thin orange lines across the full screen, as project covers land (`glitch: true`). `SETTINGS.glitch` turns it off; `idleGlitch: true` adds occasional random glitches.
- **Circuit sparks:** `SETTINGS.pcb` — a hidden, randomly generated circuit board; small sparks run along its traces and light up the board around them. `every` (how often), `maxSparks`, `radius` (how much board lights up), `speed`, `density`. `flash` (end-flash length), `hopChance`/`maxHops` (how often a spark carries on along a connected trace), `burstChance`. `on: false` turns it off.
- **Snap:** `SETTINGS.snap` finishes a half-done page change when you stop scrolling; `commitAt` (0.12) is how far into a change it always completes.
- **Contents → nav:** `CONTENTS` in `main.js` defines the clickable tiles and the fly-into-nav animation (`morph: false` shows the nav from the start).
- **Side patterns:** `styles.css`, SIDES section: add a `background-image` to `.side`.
- **Pattern overlay:** `assets/overlay.png` (already 5% opaque), stretched full-screen and screen-blended above everything. `--overlay-opacity` in `styles.css` fades it further.
- **Left-edge 1–4 ticks:** painted out of the slides by `python tools/remove_indicator.py` (originals in `slides_original/`). Re-run it after `render_pdf.py`, or delete the ticks in Figma.

## Updating the design from Figma
1. Export the tall frame as a PDF.
2. From this folder, run `python tools/render_pdf.py "path/to/export.pdf"` (needs `pip install pymupdf pillow`).
3. It re-creates `slides/` and prints a slide map. If slides were added or removed, update `SLIDES` in `main.js` to match (orange slides are left out; the wipe replaces them).

## Layout
Mobile (< 768 px) and "reduce motion" users get a plain stacked scroll, with orange label bars between projects.

## Image quality
The slides are rendered sharply (2.5×), but they can't have more detail than the images placed in Figma.
A retina laptop needs about 2 image pixels per Figma point: an image shown 600 pt wide should be ~1200+ px wide.
Fix soft slides in Figma by replacing those image fills with higher-resolution originals (renders at 2–3×, full-size photos),
then re-export the PDF and re-run the renderer.
