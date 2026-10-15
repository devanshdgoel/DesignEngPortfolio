# Portfolio v2

Your Figma layout as a scroll-through website: one slide at a time, filling the
screen, with a pause on each slide, orange wipes between projects, and a few
scroll-driven animations (render sequences, an exploding product, a turning wheel).

**Open it:** double-click `index.html`. No server is needed (GSAP loads from a CDN, so you need internet).

## Change things (all at the top of `main.js`)
- **Pacing:** `SETTINGS.holdVH` is the scroll where nothing moves; `travelVH` is the scroll to change page. One wheel notch is enough to change page (`commitVH`); `snapDuration` is how long that change takes to play (higher = slower, easier to follow).
- **Transitions:** each entry in `SLIDES` can have `transition: "slide" | "wipe" | "fade"`, `settle: true` and `glitch: true`.
- **Glitch:** slices of the slide jump sideways with thin orange lines across the full screen, as project covers land (`glitch: true`). `SETTINGS.glitch` turns it off; `idleGlitch: true` adds occasional random glitches.
- **Circuit sparks:** `SETTINGS.pcb` — a hidden, randomly generated circuit board; small sparks run along its traces and light up the board around them. `every` (how often), `maxSparks`, `radius` (how much board lights up), `speed`, `density`. `flash` (end-flash length), `hopChance`/`maxHops` (how often a spark carries on along a connected trace), `burstChance`. `on: false` turns it off.
- **Snap:** `SETTINGS.snap` finishes a half-done page change when you stop scrolling; `commitVH` is how far (vh of scroll) into a change it always completes. Inside the Stride 1 render sequence it doesn't snap: you scrub it.
- **Contents → nav:** `CONTENTS` in `main.js` defines the clickable tiles and the fly-into-nav animation (`morph: false` shows the nav from the start).
- **Fit:** `SETTINGS.fit` — `"cover"` fills the screen (a little is trimmed off the edges when the screen isn't the slide's shape), `"contain"` shows the whole slide with gaps beside it.
- **Scroll animations:** set per slide in `SLIDES` (`main.js`):
  - Stride 1 → 2 (`transition: "scrub"`): the Cover3 render plays as you scroll, from the cane on the cover, fades out at frame 347 (`fadeAt`), then Stride 2 fades in. Length: `SETTINGS.scrubVH`.
  - Stride 2 (`animate: "wheel"`): the tick wheel swings up into place around its centre.
  - Stride 4 (`transition: "explode"`): Explode1 + Explode2 play side by side, then the labels draw in. Length: `SETTINGS.explodeVH`.
  - Solus 2 (`animate: "drift"`): the sole render drifts up into place with parallax.
- **Pattern overlay:** `assets/overlay.png` (already 5% opaque), stretched full-screen and screen-blended above everything. `--overlay-opacity` in `styles.css` fades it further.
- **Left-edge 1–4 ticks:** the "Group 87" layer is left out by the export (`HIDE` in `tools/figma_export.py`).

## Updating the design from Figma
1. Make a Figma personal access token (Settings → Security → Personal access tokens, read-only "file content" scope).
2. From this folder: `set FIGMA_TOKEN=figd_...` (PowerShell: `$env:FIGMA_TOKEN="figd_..."`), then `python tools/figma_export.py` (needs `pip install pillow numpy`).
3. It re-creates `slides/` and `slides/manifest.js` from the frames on the "Portfolio Web 2" page, top to bottom, leaving out orange screens. Renders are cached in `tools/.figma-cache/` per file version, so re-runs are quick.
4. If slides were added or removed, update the `n` numbers in `SLIDES` in `main.js` to match the printed list.
5. Layers that animate are "lifted" out of their slide by `LIFT` in `tools/figma_export.py` (by Figma layer id). If you rebuild one of those layers in Figma, its id changes: update `LIFT`.

The old PDF route (`tools/render_pdf.py`, `tools/remove_indicator.py`) still works for 1190 × 842 slides; the previous slides are kept in `slides_v1/`.

## Render sequences
`python tools/build_sequences.py` turns the Blender PNG renders (`PortfolioWebsiteOld/Stride/Cover3`, `Explode1`, `Explode2`) into web frames in `sequences/` and writes `sequences/sequences.js`. Frame ranges, step (every 2nd frame) and size are at the top of the script. Each sequence is placed over the matching still in Figma, so the frames line up with the slide.

## Layout
Mobile (< 768 px) and "reduce motion" users get a plain stacked scroll, with orange label bars between projects.

## Image quality
The slides are rendered sharply (2.5×), but they can't have more detail than the images placed in Figma.
A retina laptop needs about 2 image pixels per Figma point: an image shown 600 pt wide should be ~1200+ px wide.
Fix soft slides in Figma by replacing those image fills with higher-resolution originals (renders at 2–3×, full-size photos),
then re-export the PDF and re-run the renderer.
