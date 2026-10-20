"use strict";
/* ═══════════════════════════════════════════════════════════════════════
 *  PORTFOLIO v2 — main.js
 *
 *  The Figma layout, exported to one image per slide (slides/*.webp,
 *  by tools/figma_export.py), shown one slide at a time, filling the screen. Scrolling works like this for every slide:
 *
 *      ── HOLD ──────────────── TRAVEL ──── HOLD ──────────────── TRAVEL ──
 *      (you scroll, nothing     (the page    (next slide sits
 *       moves: the slide sits)   moves fast)   still again)
 *
 *  HOLD and TRAVEL lengths are in vh of scrolling (SETTINGS below).
 *  Travel is shorter than a full screen, so pages change faster than
 *  you scroll. When you stop mid-travel, it snaps to the nearest slide.
 *
 *  PARTS:  1. SETTINGS + PROJECTS   2. SLIDES (order + transitions)
 *          3. BUILD (strip, layers, render sequences, timeline, nav)
 *          4. GLITCH   5. CIRCUIT SPARKS   6. FLOW MODE
 * ═══════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════
 *  1. SETTINGS + PROJECTS
 * ═══════════════════════════════════════════════════════════════════════ */
const SETTINGS = {
  fit:       "contain",  // "contain": the whole slide is visible below the top bar, inside `margin` (nothing cut off)
                         // "cover": slides fill the area below the bar (up to maxTrim is trimmed off the edges)
  maxTrim:   [0.06, 0.08],   // "cover" only: most trimmed per side [left/right, top/bottom]
  margin:    [0.02, 0.04],   // space around the slide, as a share of the area below the top bar [left/right, top/bottom]
                             // (background photos still fill the whole screen: see buildBackdrops)

  // ── Pacing ──
  holdVH:    16,     // scroll on each slide where nothing moves (was 60)
  travelVH:  60,     // scroll to change to the next slide (the "beat": moves up and fades out, the next moves up and fades in)
  beatShift: 14,     // how far (% of the slide's height) a slide moves up as it fades out / in — 0 = pure fade
  wipeVH:    65,     // scroll for an orange project wipe
  fadeVH:    48,     // scroll for a fade-through transition
  scrubVH:   170,    // scroll for a render sequence played by scrolling (Stride 1 → 2)
  explodeVH: 260,    // scroll for the explode (Stride 3 → 4) — higher = slower
  scrubShrink: 0.8,  // the Stride cover render scales down to this as it turns, so it stays on screen
  snap:      false,  // finish a page change automatically when scrolling stops ("sticky" scrolling)
  commitVH:  1.5,    // scroll (vh) into a change after which it always completes (less than one wheel notch)
  landInVH:  6,      // after an auto-finish, land this far inside the new slide's hold
  snapDuration: [0.9, 1.4],    // seconds an auto-finished change takes (min, max) — higher = slower, easier to follow
  scrub:     0.2,    // smoothing (seconds): the page eases after the scrollbar instead of jumping with it (higher = laggier)
  smoothScroll: true,  // Lenis: the wheel glides instead of jumping a notch at a time (desktop only)
  smoothLerp:   0.09,  // how much it glides: lower = smoother/floatier, higher = more direct (0–1)
  calmMs:       180,   // ms after the last scroll before "scrolling" ends: the sparks fade back in

  // ── Glitch (part 4) ──
  glitch:          true,     // glitch bursts on slides marked glitch: true
  glitchFrames:    10,       // length of a burst (frames at ~30fps)
  idleGlitch:      false,    // occasional random glitch while sitting on a slide
  idleGlitchEvery: [9, 18],  // seconds between idle glitches (min, max)

  // ── Circuit sparks (part 5) ──
  pcb: {
    on:        true,
    grid:      12,           // px between trace lanes
    density:   0.55,         // how many traces (0–1)
    every:     [0.5, 3.2],   // seconds between new sparks (min, max; now and then a longer quiet spell)
    maxSparks: 4,            // sparks on screen at once
    radius:    85,           // px: how much board each spark lights up (each spark varies ±30%)
    speed:     [130, 480],   // px per second a spark travels (it also surges and drags)
    flash:     [0.3, 0.9],   // seconds the flash at the end of a run lasts (min, max)
    hopChance: 0.6,          // chance a spark jumps onto a connected trace instead of ending
    maxHops:   4,            // most jumps in one run
    burstChance: 0.2,        // chance a spark comes with 1–2 neighbours
  },

  mobileBreakpoint: 768,     // below this width: plain stacked scroll (flow mode)
  preload:          2,       // how many upcoming slides to load ahead
};

// Names used by the nav and the orange wipe label ("02 / SOLUS").
const PROJECTS = {
  intro:     { label: "",   name: "Intro" },
  stride:    { label: "01", name: "Stride" },
  solus:     { label: "02", name: "SOLUS" },
  flexicook: { label: "03", name: "FlexiCook" },
  calyx:     { label: "04", name: "Calyx" },
  outro:     { label: "",   name: "Contact" },
};


/* ═══════════════════════════════════════════════════════════════════════
 *  2. SLIDES — in scroll order
 *
 *  n           the slide number in slides/manifest.js (NN.webp). The orange
 *              screens in Figma are left out by the export: "wipe" replaces them.
 *  transition  how we ARRIVE at this slide:
 *                "beat" (default)   the slide fades out drifting up, the next fades in
 *                "slide"            the page moves up
 *                "wipe"             orange project screen with the label
 *                "fade"             fades out, then the next fades in
 *                "scrub"            a render sequence plays as you scroll, starting
 *                                   from a layer of the previous slide, then fades
 *                                   into this one  (scrub: { sequence, over, fadeAt })
 *                "explode"          the page moves up, then render sequences play on
 *                                   top of this slide's layers and its labels draw in
 *                                   (explode: [{ sequence, over, fit }, ...]; fit = [scale, x, y]
 *                                   when the still was rendered with a different camera: the
 *                                   sequence pulls back to that framing as it plays)
 *  animate     a layer animation as the slide arrives: "wheel" | "drift"
 *  settle      true → tiny zoom-out as the slide lands (used on covers)
 *  glitch      true → short glitch burst as the slide lands
 *  hold        optional: this slide's own hold length (vh)
 *  scale       optional: show the slide smaller than the others (e.g. 0.88), for more border
 *
 *  Layer and sequence names come from LIFT in tools/figma_export.py and
 *  SEQUENCES in tools/build_sequences.py.
 * ═══════════════════════════════════════════════════════════════════════ */
const SLIDES = [
  // ── Intro ──
  { n: 1,  project: "intro", glitch: true },                           // Portfolio cover
  { n: 2,  project: "intro" },                                         // About me
  { n: 3,  project: "intro" },                                         // Contents

  // ── 01 Stride ──
  { n: 4,  project: "stride", transition: "wipe", settle: true, glitch: true },          // Stride cover
  { n: 5,  project: "stride", transition: "scrub",                                       // Mechanical development
           scrub: { sequence: "cover3", over: "cane", fadeAt: 347, shrink: SETTINGS.scrubShrink,
                    fadeInVH: 60 },                                    // Mechanical development fades in slowly
           animate: "wheel" },
  { n: 6,  project: "stride" },                                        // Prototyping / Electrical
  { n: 7,  project: "stride", transition: "explode",                   // Components
           explode: [{ sequence: "explode2", over: "top" },                  // the still is frame 0245
                     { sequence: "explode1", over: "bottom", fit: [0.77, 0.115, 0.119], until: 150 }] },   // the still is a wider shot; stops at frame 0150 (matches the still)
  { n: 8,  project: "stride" },                                        // CMF and packaging
  { n: 9,  project: "stride", transition: "fade" },                    // User validation (full-bleed photo)

  // ── 02 SOLUS ──
  { n: 10, project: "solus", transition: "wipe", settle: true, glitch: true },
  { n: 11, project: "solus", animate: "drift", hold: 55 },             // Structures (longer hold: you scroll a while before it fades)
  { n: 12, project: "solus", transition: "scrub",                      // Concept and prototyping
           // Structures: the text fades, the sole render (frame 0001 is the still) plays as you
           // scroll; its last frames are empty, then this slide fades in.
           scrub: { sequence: "solus", area: [0, 0, 1302, 842], replaces: "render", fadeAt: 50,
                    vh: 105, lead: 0.14, fadeInVH: 45 } },
  { n: 13, project: "solus" },                                         // Generative design
  { n: 14, project: "solus" },                                         // Design language

  // ── 03 FlexiCook ──
  { n: 15, project: "flexicook", transition: "wipe", settle: true, glitch: true },
  { n: 16, project: "flexicook" },                                     // User research
  { n: 17, project: "flexicook" },                                     // Design and prototyping
  { n: 18, project: "flexicook" },                                     // Final design

  // ── 04 Calyx ──
  { n: 19, project: "calyx", transition: "wipe", settle: true, glitch: true, hold: 45,
           bg: "slides/19-bg.webp" },                                  // the text only: the render is the canvas (frame 0)
  { n: 20, project: "calyx", transition: "scrub",                      // Concept development
           // Cover: the text fades, the device render plays as you scroll and leaves the
           // frame (its last frames are empty), then this slide fades in.
           scrub: { sequence: "calyx", area: [-45, 0, 1302, 842], replaces: "still", fadeAt: 78,
                    fadeOut: 0.2, vh: 230, lead: 0.12, fadeInVH: 60 } },   // (fades as it reaches the render's edge, ~frame 61)
  { n: 21, project: "calyx" },                                         // Product analysis
  { n: 22, project: "calyx" },                                         // Prototyping
  { n: 23, project: "calyx", scale: 0.88 },                            // Device body (shown a little smaller: more border)

  // ── Outro ──
  { n: 24, project: "outro", transition: "fade", hold: 40 },           // Thank you
];


/*  CONTENTS PAGE → NAV
 *  The four tiles on the Contents slide are clickable, and as you scroll
 *  past Contents they fly up into the nav bar, which appears from then on.
 *  rect = the tile's box on the slide in Figma points [x0, y0, x1, y1].
 *  Set morph: false to skip the animation and show the nav from the start. */
const CONTENTS = {
  slide: 2,                 // index in SLIDES (0-based) of the Contents slide
  morph: true,
  tiles: [
    { project: "stride",    rect: [100, 286, 328, 597] },
    { project: "solus",     rect: [383, 286, 611, 597] },
    { project: "flexicook", rect: [665, 286, 892, 597] },
    { project: "calyx",     rect: [946, 286, 1174, 597] },
  ],
};


/* ═══════════════════════════════════════════════════════════════════════
 *  3. BUILD — you shouldn't need to edit below here
 * ═══════════════════════════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

const FIGMA = window.FIGMA;                        // slides/manifest.js
const SEQ   = window.SEQUENCES || {};               // sequences/sequences.js
const BACKDROPS = window.BACKDROPS || {};           // slides/backdrops.js
const SLIDE_W = FIGMA.slideW, SLIDE_H = FIGMA.slideH;   // Figma slide size (pt)
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOBILE  = window.innerWidth < SETTINGS.mobileBreakpoint;
const FLOW    = REDUCED || MOBILE;

const root  = document.documentElement;
const frame = document.getElementById("frame");
const strip = document.getElementById("strip");
const panel = document.getElementById("transition");
const label = document.getElementById("transition-label");
const nav   = document.getElementById("project-nav");
const spacer = document.getElementById("scroll-root");
const N = SLIDES.length;

let current = 0;                 // index of the slide on screen
let st = null;                   // the ScrollTrigger (stage mode)
let stops = [];                  // { start, end, mid } of each hold, in timeline units (vh)
let free = [];                   // [from, to] stretches where a scroll-played sequence stays where you stop
let total = 0;                   // total timeline length (vh)

const vh = () => window.innerHeight / 100;
const projectText = (key) => {
  const p = PROJECTS[key] || {};
  return [p.label, p.name].filter(Boolean).join(" / ");
};

// Each slide's entry in the Figma manifest.
SLIDES.forEach((s) => {
  s.fig = FIGMA.slides[s.n - 1];
  if (!s.fig) throw new Error(`[v2] Slide ${s.n} isn't in slides/manifest.js — re-run tools/figma_export.py?`);
  s.src = s.fig.src;
  if (!FLOW) s.backdrop = BACKDROPS[s.n];   // full-screen background photo (see buildBackdrops)
});

// One <img> per slide. They load a few at a time (see loadAround).
// Slides with animated layers show their background here; the layers go on top.
// Slides with a full-screen backdrop show only what sits on the photo.
const imgs = SLIDES.map((s) => {
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.dataset.src = s.backdrop?.fg || (!FLOW && (s.bg || s.fig.bg)) || s.src;
  if (s.backdrop) img.classList.add("fg");
  if (s.scale && !FLOW) {
    // Shown a little smaller inside its window (more border); the rest is slide background.
    const p = (1 - s.scale) / 2;
    Object.assign(img.style, { objectFit: "contain", boxSizing: "border-box",
                               padding: `calc(var(--frame-h) * ${p}) ${p * 100}%` });
  }
  return img;
});

const players = {};              // render sequences by name (see makeSequence)

function loadAround(i) {
  for (let k = i - 1; k <= i + SETTINGS.preload; k++) {
    const s = SLIDES[k];
    if (!s) continue;
    [imgs[k], ...Object.values(s.layerEls || {}), s.backdrop?.img].filter(Boolean).forEach((img) => {
      if (img.dataset.src && !img.getAttribute("src")) img.src = img.dataset.src;
    });
  }
  // Render sequences are heavier: start loading them two slides ahead.
  Object.values(players).forEach((p) => { if (p.slide >= i - 1 && p.slide <= i + 2) p.load(); });
}

/* ── Fit the slide window to the screen ──
 *  "cover" fills the screen, trimming whatever doesn't fit evenly from both
 *  sides (up to SETTINGS.maxTrim); "contain" shows the whole slide.          */
let frameH = 0;                  // slide height on screen (px)
function fitFrame() {
  const bar = document.getElementById("topbar").offsetHeight;
  const [mx, my] = SETTINGS.margin;
  const W = window.innerWidth * (1 - 2 * mx), H = (window.innerHeight - bar) * (1 - 2 * my);
  const contain = Math.min(W / SLIDE_W, H / SLIDE_H);
  const [tx, ty] = SETTINGS.maxTrim;
  const s = SETTINGS.fit === "contain" ? contain
    : Math.max(contain, Math.min(Math.max(W / SLIDE_W, H / SLIDE_H),
                                 W / (SLIDE_W * (1 - 2 * tx)), H / (SLIDE_H * (1 - 2 * ty))));
  root.style.setProperty("--frame-w", SLIDE_W * s + "px");
  root.style.setProperty("--frame-h", SLIDE_H * s + "px");
  frameH = SLIDE_H * s;
  layoutBackdrops(bar);
  sizeGlitchCanvas();
}

/* ── Full-screen background photos ──
 *  The slide sits inside borders below the top bar, but its background photo
 *  (slides/backdrops.js, by tools/make_backdrops.py) fills the whole screen.
 *  The photo is drawn at the slide's own scale and position, so it lines up
 *  with what's on it, and runs on past the slide's edges as far as the photo
 *  goes; if that isn't far enough, it's enlarged around the slide's centre.
 *  It fades and moves with its slide (#backdrops follows the frame).          */
const backdropsEl = document.getElementById("backdrops");

function buildBackdrops(tl, arrive) {
  const typeOf = (k) => (TRANSITIONS[SLIDES[k].transition] ? SLIDES[k].transition : "beat");
  // How long the page scrolls for a transition (0 = it fades/wipes instead: switch while hidden).
  const moves = (k) => (typeOf(k) === "slide" ? arrive[k].d : 0);
  SLIDES.forEach((s, i) => {
    const b = s.backdrop;
    if (!b) return;
    b.wrap = document.createElement("div");
    b.wrap.className = "backdrop";
    b.img = new Image();
    b.img.alt = "";
    b.img.decoding = "async";
    b.img.dataset.src = b.src;
    b.wrap.appendChild(b.img);
    backdropsEl.appendChild(b.wrap);

    gsap.set(b.wrap, { autoAlpha: i === 0 ? 1 : 0, yPercent: 0 });
    if (i > 0) {                                   // arriving
      const a = arrive[i], d = moves(i);
      if (d) tl.fromTo(b.wrap, { autoAlpha: 1, yPercent: 100 }, { yPercent: 0, ease: "power2.inOut", duration: d, immediateRender: false }, a.t);
      else   tl.fromTo(b.wrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, a.reveal);
    }
    const out = arrive[i + 1];                     // leaving
    if (out) {
      const d = moves(i + 1);
      if (d) tl.fromTo(b.wrap, { yPercent: 0 }, { yPercent: -100, ease: "power2.inOut", duration: d, immediateRender: false }, out.t);
      else   tl.to(b.wrap, { autoAlpha: 0, duration: 0.01 }, out.reveal);
    }
  });
  layoutBackdrops(document.getElementById("topbar").offsetHeight);
}

function layoutBackdrops(bar) {
  const W = window.innerWidth, H = window.innerHeight;
  const s = frameH / SLIDE_H;                       // screen px per Figma point
  const cx = W / 2, cy = bar + (H - bar) / 2;       // the slide's centre on screen
  const px = SLIDE_W / 2, py = SLIDE_H / 2;         // ...and in the slide
  SLIDES.forEach((sl) => {
    const b = sl.backdrop;
    if (!b?.img) return;
    const [bx, by, bw, bh] = b.rect;
    const k = s * Math.max(1, cx / (s * (px - bx)), (W - cx) / (s * (bx + bw - px)),
                              cy / (s * (py - by)), (H - cy) / (s * (by + bh - py)));
    Object.assign(b.img.style, {
      left: cx - (px - bx) * k + "px", top: cy - (py - by) * k + "px",
      width: bw * k + "px", height: bh * k + "px",
    });
  });
}

/* ── Put an element on slide i, at [x, y, w, h] in Figma points ──
 *  It lives in the strip, so it moves with its slide.                        */
function placeOnSlide(el, i, [x, y, w, h]) {
  Object.assign(el.style, {
    left:   (x / SLIDE_W) * 100 + "%",
    width:  (w / SLIDE_W) * 100 + "%",
    top:    `calc(var(--frame-h) * ${i + y / SLIDE_H})`,
    height: `calc(var(--frame-h) * ${h / SLIDE_H})`,
  });
}

/* ── Animated layers: one <img> per layer lifted out in Figma ── */
function buildLayers() {
  SLIDES.forEach((s, i) => {
    const layers = s.fig.layers;
    if (!layers) return;
    s.layerEls = {};
    Object.entries(layers).forEach(([name, L]) => {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.className = "layer";
      img.dataset.src = L.src;
      placeOnSlide(img, i, L.rect);
      strip.appendChild(img);
      s.layerEls[name] = img;
    });
  });
}

/* ── Render sequences ──
 *  A canvas that shows one frame of a Blender render sequence at a time,
 *  placed exactly where the matching still sits in Figma (`over` = that
 *  layer), so its first or last frame lines up with the still.               */
function makeSequence(name, i, over, area) {
  const meta = SEQ[name];
  const L = area ? { rect: area } : SLIDES[i].fig.layers?.[over];     // area: frames the size of the slide
  if (!meta || !L) { console.warn(`[v2] Sequence "${name}" or layer "${over}" missing.`); return null; }
  const clip = L.rect, rect = L.imageRect || L.rect;

  const box = document.createElement("div");
  box.className = "seq";
  placeOnSlide(box, i, clip);
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    left:   ((rect[0] - clip[0]) / clip[2]) * 100 + "%",
    top:    ((rect[1] - clip[1]) / clip[3]) * 100 + "%",
    width:  (rect[2] / clip[2]) * 100 + "%",
    height: (rect[3] / clip[3]) * 100 + "%",
  });
  box.appendChild(canvas);
  strip.appendChild(box);

  // The canvas is the whole render, at the frames' resolution (frames may be cropped).
  const [cx, cy, cw, ch] = meta.crop;
  canvas.width  = Math.round(meta.size[0] / cw);
  canvas.height = Math.round(meta.size[1] / ch);
  const ctx = canvas.getContext("2d");
  const frames = [];
  let want = 0, shown = -1;
  const ready = (k) => frames[k] && frames[k].complete && frames[k].naturalWidth;

  const p = {
    el: box, n: meta.frames, slide: i,
    load() {
      if (frames.length) return;
      // First and last frames first (they're what you see at rest), then the rest in order.
      const order = [0, meta.frames - 1, ...Array.from({ length: meta.frames - 2 }, (_, k) => k + 1)];
      order.forEach((k) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => { if (shown < 0 || Math.abs(k - want) < Math.abs(shown - want)) p.draw(want); };
        im.src = meta.dir + String(k).padStart(4, "0") + ".webp";
        frames[k] = im;
      });
    },
    draw(f) {
      want = Math.max(0, Math.min(meta.frames - 1, Math.round(f)));
      // The nearest frame that has loaded (while the sequence is still streaming in).
      let k = -1;
      for (let d = 0; d < meta.frames && k < 0; d++) {
        if (ready(want - d)) k = want - d; else if (ready(want + d)) k = want + d;
      }
      if (k < 0 || k === shown) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[k], cx * canvas.width, cy * canvas.height, cw * canvas.width, ch * canvas.height);
      shown = k;
    },
    // Where a Blender frame number falls in the sequence, 0–1.
    at(sourceFrame) {
      const [first, last] = meta.sourceFrames;
      return Math.max(0, Math.min(1, (sourceFrame - first) / (last - first)));
    },
  };
  players[name] = p;
  return p;
}

/* ── Transitions: each adds tweens for "arrive at slide i", starting at time t ──
 *  Strip position: slide i is at yPercent = -(i / N) * 100 of the strip.
 *  Each returns { d, reveal, free }: its length, when the new slide first
 *  shows (for `animate`), and optionally a stretch that isn't snapped.      */
const TRANSITIONS = {

  // A beat — between scrolling and a slideshow: the slide moves up like a page
  // and fades out as it goes; the next one comes up from below, fading in as
  // it rises into place. Each screen reads as its own step.
  beat(tl, i, t) {
    const d = SETTINGS.travelVH;
    const S = SETTINGS.beatShift;                              // % of the slide's height
    const SB = (S * frameH) / window.innerHeight;              // the same distance for full-screen backdrops
    const OUT = 0.48, IN = 0.5;                                // out: 0 → OUT, swap, in: IN → 1 (shares of d)
    // Out: moving from the start, fading a moment later.
    tl.fromTo(frame, { yPercent: 0 }, { yPercent: -S, ease: "sine.in", duration: d * OUT, immediateRender: false }, t);
    tl.fromTo(backdropsEl, { yPercent: 0 }, { yPercent: -SB, ease: "sine.in", duration: d * OUT, immediateRender: false }, t);
    tl.to([frame, backdropsEl], { autoAlpha: 0, ease: "power1.in", duration: d * (OUT - 0.12) }, t + d * 0.12);
    tl.set(strip, { yPercent: -(i / N) * 100 }, t + d * (OUT + IN) / 2);
    // In: rising into place, visible early.
    tl.fromTo(frame, { yPercent: S }, { yPercent: 0, ease: "power2.out", duration: d * (1 - IN), immediateRender: false }, t + d * IN);
    tl.fromTo(backdropsEl, { yPercent: SB }, { yPercent: 0, ease: "power2.out", duration: d * (1 - IN), immediateRender: false }, t + d * IN);
    tl.fromTo([frame, backdropsEl], { autoAlpha: 0 }, { autoAlpha: 1, ease: "power1.out", duration: d * 0.35, immediateRender: false }, t + d * IN);
    if (SLIDES[i].settle)
      tl.fromTo(frame, { scale: 1.04 }, { scale: 1, ease: "power2.out", duration: d * (1 - IN), immediateRender: false }, t + d * IN);
    return { d, reveal: t + d * (OUT + IN) / 2 };
  },

  // The page moves up to the next slide.
  slide(tl, i, t) {
    const d = SETTINGS.travelVH;
    tl.to(strip, { yPercent: -(i / N) * 100, ease: "power2.inOut", duration: d }, t);
    if (SLIDES[i].settle) {
      tl.to(frame, { scale: 1.03, ease: "sine.in", duration: d / 2 }, t);
      tl.to(frame, { scale: 1, ease: "power2.out", duration: d / 2 }, t + d / 2);
    }
    return { d, reveal: t };
  },

  // Orange screen wipes up with the project label; the slide changes underneath
  // while it's fully covered, then it wipes off the top.
  wipe(tl, i, t) {
    const d = SETTINGS.wipeVH;
    const text = projectText(SLIDES[i].project);
    const setLabel = () => { label.textContent = text; };
    tl.call(setLabel, null, t);                 // scrolling forward
    tl.call(setLabel, null, t + d);             // scrolling back into it
    tl.fromTo(panel, { clipPath: "inset(100% 0% 0% 0%)" },
                     { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.inOut", duration: d * 0.45, immediateRender: false }, t);
    tl.fromTo(label, { yPercent: 120, autoAlpha: 0 },
                     { yPercent: 0, autoAlpha: 1, ease: "power2.out", duration: d * 0.25, immediateRender: false }, t + d * 0.2);
    tl.set(strip, { yPercent: -(i / N) * 100 }, t + d * 0.5);          // swap while covered
    if (SLIDES[i].settle) {
      tl.set(frame, { scale: 1.06 }, t + d * 0.5);
      tl.to(frame, { scale: 1, ease: "power2.out", duration: d * 0.5 }, t + d * 0.5);
    }
    tl.to(label, { yPercent: -120, autoAlpha: 0, ease: "power2.in", duration: d * 0.2 }, t + d * 0.55);
    tl.to(panel, { clipPath: "inset(0% 0% 100% 0%)", ease: "power2.inOut", duration: d * 0.45 }, t + d * 0.55);
    return { d, reveal: t + d * 0.5 };
  },

  // Current slide fades to the background, then the next one fades in.
  fade(tl, i, t) {
    const d = SETTINGS.fadeVH;
    tl.to([frame, backdropsEl], { autoAlpha: 0, ease: "power1.in", duration: d * 0.45 }, t);
    tl.set(strip, { yPercent: -(i / N) * 100 }, t + d * 0.5);
    tl.to([frame, backdropsEl], { autoAlpha: 1, ease: "power1.out", duration: d * 0.45 }, t + d * 0.55);
    return { d, reveal: t + d * 0.5 };
  },

  // A render sequence plays as you scroll, starting from a still on the previous
  // slide (Stride cover: the cane). The rest of that slide clears first, the
  // sequence fades out around `fadeAt` (a Blender frame number), then this
  // slide fades in. You're in control: stopping leaves it where it is.
  //   scrub: { sequence, fadeAt,     the sequence, and the Blender frame it's gone by
  //            over | area,          where it sits: on a layer of the previous slide (whose still it
  //                                  takes over from), or area [x, y, w, h] = frames the size of the slide
  //            replaces,             (with area) a layer of the previous slide that frame 0 stands in for
  //                                  (or any name, when the slide's `bg` image leaves the render out)
  //            vh, lead, fadeInVH,   scroll for the sequence, share of it the text takes to clear first,
  //                                  and scroll for this slide's fade-in afterwards
  //            fadeOut,              share of the sequence it fades out over, ending at fadeAt (0.12)
  //            shrink }              scale the render down to this as it plays (to stay on screen)
  scrub(tl, i, t) {
    const o = SLIDES[i].scrub, prev = i - 1;
    const p = makeSequence(o.sequence, prev, o.over, o.area);
    if (!p) return TRANSITIONS.fade(tl, i, t);
    const before = SLIDES[prev];
    const P = o.vh ?? SETTINGS.scrubVH * 0.86;          // scroll while the sequence plays
    const start = t + P * (o.lead ?? 0);                 // the text clears first
    const gone = start + P * p.at(o.fadeAt);             // the sequence is gone by `fadeAt`…
    const fadeStart = gone - P * (o.fadeOut ?? 0.12);    // …fading over the frames before it
    const F = o.fadeInVH ?? SETTINGS.scrubVH * 0.15;     // then this slide fades in
    const d = gone - t + F;
    const state = { f: 0 };
    gsap.set(p.el, { transformOrigin: "50% 50%" });

    if (o.over) {
      // The canvas takes over from the still on the previous slide.
      const still = before.layerEls[o.over];
      gsap.set(p.el, { autoAlpha: 0 });
      tl.set(p.el, { autoAlpha: 1 }, t);
      tl.set(still, { autoAlpha: 0 }, t);
    } else if (o.replaces) {
      // Frame 0 *is* the still: the canvas shows on the slide from the start, in place of
      // that layer (or of the render left out of the slide's `bg` image).
      const still = before.layerEls?.[o.replaces];
      if (still) gsap.set(still, { autoAlpha: 0, display: "none" });
      before.stillEl = p.el;
      before.stillRect = o.area;
    }
    tl.to(imgs[prev], { autoAlpha: 0, ease: "power1.in", duration: Math.max(P * 0.1, start - t) }, t);   // the text clears
    tl.to(state, { f: p.n - 1, ease: "none", duration: P, onUpdate: () => p.draw(state.f) }, start);
    if (o.shrink) tl.fromTo(p.el, { scale: 1 }, { scale: o.shrink, ease: "power1.inOut", duration: P * 0.29, immediateRender: false }, start);
    tl.to(p.el, { autoAlpha: 0, ease: "power1.in", duration: gone - fadeStart }, fadeStart);
    tl.set(strip, { yPercent: -(i / N) * 100 }, gone);
    tl.set([frame, backdropsEl], { autoAlpha: 0 }, gone);
    tl.to([frame, backdropsEl], { autoAlpha: 1, ease: "sine.inOut", duration: F }, gone);
    return { d, reveal: gone, free: [t, fadeStart] };
  },

  // The slide fades in (a beat) with the product still assembled; then its render
  // sequences play side by side, exploding it, hand over to the sharp stills
  // from Figma, and the labels draw in. Its length is SETTINGS.explodeVH.
  explode(tl, i, t) {
    const s = SLIDES[i];
    const IN = TRANSITIONS.beat(tl, i, t).d * 0.9;      // the fade-in, then (overlapping its end) the explode
    const d = IN + SETTINGS.explodeVH;
    const PLAY = [IN / d, IN / d + (SETTINGS.explodeVH / d) * 0.68];   // when the sequences play (share of d)
    const play = d * (PLAY[1] - PLAY[0]);
    const LABELS = PLAY[1] - 0.04;                      // labels start just after the hand-off to the stills
    const labelSpan = 1 - LABELS - 0.18;                // (the last label finishes as the explode ends)

    const centres = [];
    s.explode.forEach(({ sequence, over, fit, until }) => {
      const p = makeSequence(sequence, i, over);
      const still = s.layerEls[over];
      if (!p) return;
      if (fit) {
        // Pull back from the sequence's own camera to the still's framing as it explodes.
        const canvas = p.el.firstChild;
        gsap.set(canvas, { transformOrigin: "0 0" });
        tl.fromTo(canvas, { scale: 1, xPercent: 0, yPercent: 0 },
                          { scale: fit[0], xPercent: fit[1] * 100, yPercent: fit[2] * 100, ease: "power2.inOut", duration: play, immediateRender: false }, t + d * PLAY[0]);
      }
      const r = s.fig.layers[over].rect;
      centres.push(r[0] + r[2] / 2);
      const state = { f: 0 };
      gsap.set(still, { autoAlpha: 0 });
      const last = until ? p.at(until) * (p.n - 1) : p.n - 1;      // `until`: stop at this Blender frame
      tl.to(state, { f: last, ease: "power1.inOut", duration: play, onUpdate: () => p.draw(state.f) }, t + d * PLAY[0]);
      // A small kick as it bursts open.
      tl.fromTo(p.el, { scale: 0.93 }, { scale: 1, ease: "expo.out", duration: play, immediateRender: false }, t + d * PLAY[0]);
      tl.to(p.el, { autoAlpha: 0, ease: "none", duration: d * 0.08 }, t + d * (PLAY[1] - 0.02));
      tl.to(still, { autoAlpha: 1, ease: "none", duration: d * 0.08 }, t + d * (PLAY[1] - 0.02));
    });

    // Labels: leader lines grow out from the product, then the words appear,
    // nearest the product first.
    const mid = (r) => r[0] + r[2] / 2;
    const near = (r) => centres.reduce((a, c) => (Math.abs(c - mid(r)) < Math.abs(a - mid(r)) ? c : a), centres[0] ?? SLIDE_W / 2);
    Object.entries(s.fig.layers)
      .filter(([name]) => name.startsWith("label-"))
      .map(([name, L]) => ({ el: s.layerEls[name], L, gap: Math.abs(mid(L.rect) - near(L.rect)) }))
      .sort((a, b) => a.gap - b.gap || a.L.rect[1] - b.L.rect[1])
      .forEach(({ el, L }, k, all) => {
        const at = t + d * (LABELS + labelSpan * (k / Math.max(1, all.length - 1)));   // after the hand-off to the stills
        const leftOfProduct = mid(L.rect) < near(L.rect);
        if (L.type === "TEXT") {
          gsap.set(el, { autoAlpha: 0 });
          tl.fromTo(el, { autoAlpha: 0, x: leftOfProduct ? 10 : -10 },
                        { autoAlpha: 1, x: 0, ease: "power2.out", duration: d * 0.12, immediateRender: false }, at + d * 0.04);
        } else {
          const hidden = leftOfProduct ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)";   // grows out from the product
          gsap.set(el, { clipPath: hidden });
          tl.fromTo(el, { clipPath: hidden },
                        { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.out", duration: d * 0.1, immediateRender: false }, at);
        }
      });
    return { d, reveal: t + IN / 2 };
  },
};

/* ── Layer animations as a slide arrives (and leaves) ──
 *  from = when the slide first shows, to = a little way into its hold,
 *  leave = { t, d } of the transition out of it (if any).                    */
const ANIMATIONS = {

  // Stride 2: the tick wheel in the corner swings up into place around its
  // centre, and keeps turning as the slide leaves.
  wheel(tl, s, from, to, leave) {
    const el = s.layerEls?.wheel, L = s.fig.layers?.wheel;
    if (!el) return;
    const [x, y, w, h] = L.rect, [px, py] = L.pivot || [x + w, y + h];
    gsap.set(el, { transformOrigin: `${((px - x) / w) * 100}% ${((py - y) / h) * 100}%`, rotation: -100 });
    tl.fromTo(el, { rotation: -100 }, { rotation: 0, ease: "power3.out", duration: to - from, immediateRender: false }, from);
    if (leave) tl.to(el, { rotation: 45, ease: "power1.in", duration: leave.d * 0.6 }, leave.t);
  },

  // Solus 2: the sole render drifts up into place from the lower right, faster
  // than the page (parallax), and keeps rising as the slide leaves.
  //  (If a scroll-played sequence's first frame stands in for the render — Solus
  //  Structures — that canvas drifts instead; it then stays put as the sequence plays.)
  drift(tl, s, from, to, leave) {
    const L = s.fig.layers?.render;
    const el = s.stillEl || s.layerEls?.render;
    if (!el || !L) return;
    // Offsets are measured on the render's box; convert them to the element's own box.
    const [rx, ry, rw, rh] = L.rect, [ex, ey, ew, eh] = s.stillRect || L.rect;
    const kx = rw / ew, ky = rh / eh;
    const start = { xPercent: 14 * kx, yPercent: 32 * ky, rotation: -7, scale: 1.12 };
    gsap.set(el, { transformOrigin: `${((rx + 0.6 * rw - ex) / ew) * 100}% ${((ry + 0.6 * rh - ey) / eh) * 100}%`, ...start });
    tl.fromTo(el, start, { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, ease: "power3.out", duration: to - from, immediateRender: false }, from);
    if (leave && !s.stillEl) tl.to(el, { yPercent: -28 * ky, xPercent: -4 * kx, rotation: 3, ease: "power1.in", duration: leave.d * 0.8 }, leave.t);
  },
};

function buildStage() {
  imgs.forEach((img) => strip.appendChild(img));
  strip.style.height = `calc(var(--frame-h) * ${N})`;
  buildLayers();
  fitFrame();
  window.addEventListener("resize", fitFrame);

  // One timeline for the whole site, measured in vh of scroll.
  const tl = gsap.timeline({ defaults: { overwrite: false } });
  const arrive = [];       // arrive[i] = { t, d, reveal }: the transition INTO slide i
  let t = 0;
  SLIDES.forEach((s, i) => {
    if (i > 0) {
      const type = TRANSITIONS[s.transition] ? s.transition : "beat";
      if (s.transition && !TRANSITIONS[s.transition])
        console.warn(`[v2] Unknown transition "${s.transition}" on slide ${i + 1} — using "beat".`);
      const { d, reveal, free: f } = TRANSITIONS[type](tl, i, t);
      arrive[i] = { t, d, reveal };
      if (f) free.push(f);
      // Glitch as the slide lands (only when scrolling forwards).
      if (s.glitch) tl.call(() => { if (st && st.direction > 0) glitchBurst(i); }, null, t + d * (type === "wipe" ? 0.62 : 0.9));
      t += d;
    }
    const hold = s.hold ?? SETTINGS.holdVH;
    stops.push({ start: t, end: t + hold, mid: t + hold / 2 });
    t += hold;
  });
  total = t;

  // Layer animations, now that every transition's timing is known.
  SLIDES.forEach((s, i) => {
    if (!s.animate) return;
    const anim = ANIMATIONS[s.animate];
    if (!anim) { console.warn(`[v2] Unknown animate "${s.animate}" on slide ${i + 1}.`); return; }
    const from = arrive[i] ? arrive[i].reveal : 0;
    const to = stops[i].start + Math.min((stops[i].end - stops[i].start) * 0.7, 12);   // done just as you land
    anim(tl, s, from, Math.max(to, from + 1), arrive[i + 1]);
  });

  buildContents(tl, arrive);
  buildBackdrops(tl, arrive);
  tl.set({}, {}, total);   // make the timeline exactly `total` long

  // The page is tall enough to scroll through the whole timeline.
  spacer.style.height = `calc(${total}vh + 100vh)`;

  st = ScrollTrigger.create({
    animation: tl,
    start: 0,
    end: () => total * vh(),
    scrub: SETTINGS.scrub,
    snap: SETTINGS.snap ? {
      snapTo: () => snapTarget(st.progress, st.direction),
      duration: { min: SETTINGS.snapDuration[0], max: SETTINGS.snapDuration[1] },
      delay: 0.08,
      ease: "power2.inOut",
    } : false,
    onUpdate: onScroll,
  });

  loadAround(0);
  onScroll(st);
  if (SLIDES[0].glitch) imgs[0].addEventListener("load", () => setTimeout(() => glitchBurst(0), 350), { once: true });
  if (SETTINGS.idleGlitch) scheduleIdleGlitch();
  if (SETTINGS.pcb.on) buildPCB();
}

/* ── Contents page: clickable tiles + the fly-into-the-nav morph ── */
function buildContents(tl, arrive) {
  const ci = CONTENTS.slide;
  const firstSlideOf = (project) => SLIDES.findIndex((s) => s.project === project);

  // 1. Clickable tiles. They live in the strip, so they move with the slide.
  CONTENTS.tiles.forEach(({ project, rect: [x0, y0, x1, y1] }) => {
    const hs = document.createElement("button");
    hs.className = "contents-hotspot";
    hs.setAttribute("aria-label", (PROJECTS[project] || {}).name || project);
    Object.assign(hs.style, {
      left:   (x0 / SLIDE_W) * 100 + "%",
      width:  ((x1 - x0) / SLIDE_W) * 100 + "%",
      top:    `calc(var(--frame-h) * ${ci + y0 / SLIDE_H})`,
      height: `calc(var(--frame-h) * ${(y1 - y0) / SLIDE_H})`,
    });
    hs.addEventListener("click", () => goToSlide(firstSlideOf(project)));
    strip.appendChild(hs);
  });

  // 2. The morph: as you leave Contents, each tile lifts off the slide and
  //    glides along a gentle curve into its nav button. On the way its picture
  //    fades out and the button text fades in, its corners round into a pill,
  //    and in the last stretch it cross-fades with the real nav bar.
  //    Everything is driven by one scrubbed value, so scrolling back reverses it.
  const leave = arrive[ci + 1];
  if (!CONTENTS.morph || !leave) return;

  const layer = document.getElementById("morph");

  const tiles = CONTENTS.tiles.map((tile) => {
    const p = PROJECTS[tile.project] || {};
    const el = document.createElement("div");
    el.className = "morph-tile";
    el.innerHTML = `<div class="morph-img"></div><span class="morph-label">` +
      (p.label ? `<span class="nav-num">${p.label}</span>` : "") + `<span>${p.name || tile.project}</span></span>`;
    el.firstChild.style.backgroundImage = `url("${SLIDES[ci].src}")`;
    layer.appendChild(el);

    // A patch of slide background over the original tile, so it doesn't
    // stay behind as a duplicate while its copy flies away.
    const PAD = 4;                                   // pt: also covers the tile's orange border
    const [x0, y0, x1, y1] = [tile.rect[0] - PAD, tile.rect[1] - PAD, tile.rect[2] + PAD, tile.rect[3] + PAD];
    const hole = document.createElement("div");
    hole.className = "contents-hole";
    Object.assign(hole.style, {
      left:   (x0 / SLIDE_W) * 100 + "%",
      width:  ((x1 - x0) / SLIDE_W) * 100 + "%",
      top:    `calc(var(--frame-h) * ${ci + y0 / SLIDE_H})`,
      height: `calc(var(--frame-h) * ${(y1 - y0) / SLIDE_H})`,
    });
    strip.insertBefore(hole, strip.querySelector(".contents-hotspot"));
    return { el, img: el.firstChild, label: el.lastChild, hole, tile };
  });

  const state = { p: 0 };       // 0 = tiles on the slide, 1 = tiles inside the nav
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ramp = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };  // smoothstep
  const easeX = gsap.parseEase("power2.inOut");
  const easeY = gsap.parseEase("power3.inOut");   // y leads slightly less → a soft arc, not a straight line
  const easeS = gsap.parseEase("power3.inOut");
  const STAGGER = 0.07;         // each tile leaves a little after the previous one

  // Positions are measured live, so the morph stays right after a resize.
  function render() {
    const p = state.p;
    const fr = frame.getBoundingClientRect();
    const u = fr.width / SLIDE_W;                              // screen px per Figma point
    const navIn = ramp(0.82, 1, p);                            // the real nav takes over at the end
    gsap.set(nav, { autoAlpha: navIn });            // (the name stays in the bar throughout)
    layer.style.visibility = p > 0 && p < 1 ? "visible" : "hidden";

    tiles.forEach(({ el, img, label, hole, tile }, k) => {
      const [x0, y0, x1, y1] = tile.rect;
      const from = { x: fr.left + x0 * u, y: fr.top + y0 * u, w: (x1 - x0) * u, h: (y1 - y0) * u };
      const btn = nav.querySelector(`[data-project="${tile.project}"]`);
      if (!btn) return;
      const to = btn.getBoundingClientRect();
      const q = clamp01((p - k * STAGGER) / (1 - (tiles.length - 1) * STAGGER));
      const qs = easeS(q);
      const w = lerp(from.w, to.width, qs), h = lerp(from.h, to.height, qs);
      // The picture keeps its proportions (cropped like "cover"), never squashed.
      const s = Math.max(w / from.w, h / from.h);
      Object.assign(el.style, {
        transform: `translate3d(${lerp(from.x, to.left, easeX(q))}px, ${lerp(from.y, to.top, easeY(q))}px, 0)`,
        width:  w + "px",
        height: h + "px",
        borderRadius: lerp(2, to.height / 2, ramp(0.2, 0.8, q)) + "px",
        opacity: 1 - navIn,
      });
      Object.assign(img.style, {
        width:  from.w + "px",
        height: from.h + "px",
        backgroundSize: `${fr.width}px ${fr.height}px`,
        backgroundPosition: `${-x0 * u}px ${-y0 * u}px`,
        transform: `translate(-50%, -50%) scale(${s})`,
        opacity: 1 - ramp(0.3, 0.75, q),
      });
      label.style.opacity = ramp(0.55, 0.9, q);
      hole.style.opacity = clamp01(q * 12);
    });
  }

  tl.to(state, { p: 1, ease: "none", duration: leave.d * 0.55, onUpdate: render }, leave.t);
  render();
  window.addEventListener("resize", render);
}

/* ── Where to settle when scrolling stops (returns progress 0–1) ──
 *  • Stopped on a slide (inside its hold), or partway through a render
 *    sequence you're scrubbing?  Stay exactly where you are.
 *  • Stopped between two slides?  Finish the change in the direction you
 *    were scrolling, once you're SETTINGS.commitVH into it. So a
 *    half swipe carries on to the next page instead of bouncing back.
 *  (GSAP's default snap projects momentum, which can skip whole slides.) */
function snapTarget(progress, direction) {
  const time = progress * total;
  if (free.some(([a, b]) => time > a && time < b)) return progress;   // inside a scroll-played sequence: stay put
  const k = stops.findIndex((s, i) => i + 1 < stops.length && time > s.end && time < stops[i + 1].start);
  if (k < 0) return progress;                                  // on a slide: don't move

  const from = stops[k], to = stops[k + 1];
  // After a scroll-played sequence, "back" means the end of the sequence, not the slide before it.
  const scrubbed = free.find(([a, b]) => a >= from.end && b <= to.start);
  const back = scrubbed ? scrubbed[1] : from.end;
  const into = direction >= 0 ? time - back : to.start - time;        // vh into the change, in your direction
  const forward = direction >= 0 ? into > SETTINGS.commitVH : into < SETTINGS.commitVH;
  const inset = (s) => Math.min(SETTINGS.landInVH, (s.end - s.start) / 2);
  return (forward ? to.start + inset(to) : scrubbed ? back : from.end - inset(from)) / total;
}

/* ── On every scroll: which slide are we on? progress bar, nav, preloading ── */
function onScroll(self) {
  const time = self.progress * total;
  let i = 0;
  // A slide counts as "current" from halfway through the transition into it.
  while (i + 1 < N && time >= (stops[i].end + stops[i + 1].start) / 2) i++;
  if (i !== current) { current = i; loadAround(i); }
  setActiveNav(SLIDES[i].project);
  document.getElementById("progress-bar").style.width = self.progress * 100 + "%";
  document.getElementById("scroll-hint").classList.toggle("is-hidden", self.scroll() > 40);
}

/* ── Nav: "01 STRIDE" … "CONTACT" (the intro is reached via the name, top left) ── */
function buildNav() {
  const seen = new Set(["intro"]);
  SLIDES.forEach((s, i) => {
    if (seen.has(s.project)) return;
    seen.add(s.project);
    const p = PROJECTS[s.project] || {};
    const btn = document.createElement("button");
    btn.className = "nav-btn";
    btn.dataset.project = s.project;
    btn.innerHTML = (p.label ? `<span class="nav-num">${p.label}</span>` : "") + `<span>${p.name || s.project}</span>`;
    btn.addEventListener("click", () => goToSlide(i));
    nav.appendChild(btn);
  });
  document.getElementById("brand").addEventListener("click", () => goToSlide(0));
}
function setActiveNav(project) {
  nav.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.project === project));
}
function goToSlide(i) {
  const top = FLOW ? spacer.querySelectorAll("img")[i].offsetTop
                   : stops[i].mid * vh();
  if (lenis) lenis.scrollTo(top, { duration: 1.6 });
  else window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
}


/* ═══════════════════════════════════════════════════════════════════════
 *  4. GLITCH — ported from the v1 background (bgDrawGlitch):
 *  a few horizontal slices of the slide jump sideways, each marked by a
 *  thin accent line that runs across the full screen, for a handful of
 *  frames. Plays as project covers land (slides with glitch: true).
 * ═══════════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById("glitch");
const g = canvas.getContext("2d");
let DPR = 1;
let glitchLeft = 0, glitchSlide = 0, glitchOn = false;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function sizeGlitchCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);          // DPR capped at 2
  canvas.width  = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function glitchBurst(i) {
  if (!SETTINGS.glitch || FLOW) return;
  if (scrolling) { pendingGlitch = i; return; }     // keep scrolling smooth: it plays when you stop
  glitchSlide = i;
  glitchLeft = SETTINGS.glitchFrames;
  if (!glitchOn) { glitchOn = true; requestAnimationFrame(drawGlitch); }
}

let lastGlitchDraw = 0;
function drawGlitch(now) {
  if (now - lastGlitchDraw < 30) { requestAnimationFrame(drawGlitch); return; }   // ~30fps flicker
  lastGlitchDraw = now;
  g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (glitchLeft-- <= 0) { glitchOn = false; return; }

  const img = imgs[glitchSlide];
  const r = frame.getBoundingClientRect();
  if (img.naturalWidth) {
    const slices = 2 + Math.floor(Math.random() * 3);
    const k = r.height / 900;                                 // scale slice size with the frame
    for (let s = 0; s < slices; s++) {
      const y  = r.top + Math.random() * r.height;
      const h  = (2 + Math.random() * 14) * k;
      const dx = (Math.random() - 0.5) * 40 * k;
      const sy = ((y - r.top) / r.height) * img.naturalHeight;
      const sh = (h / r.height) * img.naturalHeight;
      g.drawImage(img, 0, sy, img.naturalWidth, sh, r.left + dx, y, r.width, h);
      g.fillStyle = "rgba(235, 70, 4, 0.5)";
      g.fillRect(0, y, window.innerWidth, 1);                 // the line runs edge to edge
    }
  }
  requestAnimationFrame(drawGlitch);
}

// Optional: an occasional glitch while you sit on a slide (SETTINGS.idleGlitch).
function scheduleIdleGlitch() {
  const [a, b] = SETTINGS.idleGlitchEvery;
  setTimeout(() => {
    if (st && Math.abs(st.getVelocity()) < 5) glitchBurst(current);
    scheduleIdleGlitch();
  }, rand(a, b) * 1000);
}


/* ═══════════════════════════════════════════════════════════════════════
 *  5. CIRCUIT SPARKS — the whole screen is treated as a large circuit
 *  board that you can't see. Now and then a tiny spark runs along one of
 *  its traces, and its glow lights up the board just around it, so you
 *  glimpse the neighbouring traces, pads and chips as it passes.
 *
 *  The board is generated randomly (on load and on resize) and drawn once
 *  to an off-screen canvas. Each frame, only small circles of it around
 *  the sparks are copied to the visible #pcb canvas, which is
 *  screen-blended over the slides. Settings: SETTINGS.pcb.
 * ═══════════════════════════════════════════════════════════════════════ */
const pcbCanvas = document.getElementById("pcb");
const pc = pcbCanvas.getContext("2d");
const board = document.createElement("canvas"), bc = board.getContext("2d");      // the hidden board
const lamp  = document.createElement("canvas"), lc = lamp.getContext("2d");       // one spark's lit circle
let traces = [];                      // [{ pts: [[x, y], ...], cum: [0, len1, ...], len }]
let sparks = [];
let pcbRunning = false;
let lastPcb = 0;

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function generateBoard() {
  const P = SETTINGS.pcb, G = P.grid;
  const W = window.innerWidth, H = window.innerHeight;
  const cols = Math.ceil(W / G), rows = Math.ceil(H / G);
  const used = new Uint8Array(cols * rows);
  const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !used[r * cols + c];
  const take = (c, r) => { used[r * cols + c] = 1; };
  traces = [];
  const chips = [], pads = [];

  // A trace walks the grid in straight runs with 45° bends until it's blocked.
  function walk(c, r, dir, maxRuns) {
    if (!free(c, r)) return null;
    const pts = [[c, r]];
    take(c, r);
    for (let run = 0; run < maxRuns; run++) {
      const diagonal = dir % 2 === 1;
      const len = diagonal ? 1 + Math.floor(rand(0, 4)) : 2 + Math.floor(rand(0, 12));
      let moved = 0;
      for (let s = 0; s < len; s++) {
        const [dc, dr] = DIRS[dir];
        // Diagonal steps must not cut across a neighbouring trace.
        if (!free(c + dc, r + dr) || (dc && dr && (!free(c + dc, r) || !free(c, r + dr)))) break;
        c += dc; r += dr; take(c, r); moved++;
      }
      if (moved) pts.push([c, r]);
      if (moved < len) break;
      dir = (dir + (Math.random() < 0.5 ? 1 : 7)) % 8;               // bend 45°
    }
    if (pts.length < 2) return null;
    const px = pts.map(([pc_, pr]) => [pc_ * G + G / 2, pr * G + G / 2]);
    const cum = [0];
    for (let k = 1; k < px.length; k++) cum.push(cum[k - 1] + Math.hypot(px[k][0] - px[k - 1][0], px[k][1] - px[k - 1][1]));
    const t = { pts: px, cum, len: cum[cum.length - 1] };
    if (t.len < G * 3) return null;
    traces.push(t);
    pads.push(px[px.length - 1]);
    if (Math.random() < 0.5) pads.push(px[0]);
    return t;
  }

  // Chips: rectangles with a row of pins top and bottom, each pin starting a trace.
  const chipCount = Math.round((W * H) / 160000);
  for (let k = 0; k < chipCount; k++) {
    const cw = 4 + Math.floor(rand(0, 7)), ch = 3 + Math.floor(rand(0, 4));
    const c0 = Math.floor(rand(2, cols - cw - 2)), r0 = Math.floor(rand(3, rows - ch - 3));
    let clear = true;
    for (let r = r0 - 2; r < r0 + ch + 2 && clear; r++)
      for (let c = c0 - 1; c < c0 + cw + 1; c++) if (!free(c, r)) { clear = false; break; }
    if (!clear) continue;
    for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) take(c, r);
    chips.push({ x: c0 * G, y: r0 * G, w: cw * G, h: ch * G, pins: cw });
    for (let c = c0; c < c0 + cw; c++) {
      if (Math.random() < 0.8) walk(c, r0 - 1, 6, 4);                // up from the top pins
      if (Math.random() < 0.8) walk(c, r0 + ch, 2, 4);               // down from the bottom pins
    }
  }

  // Free traces, some laid as parallel buses of 2–4 lines.
  const want = Math.round((cols * rows) / 40 * P.density);
  for (let k = 0, tries = 0; k < want && tries < want * 6; tries++) {
    const c = Math.floor(rand(0, cols)), r = Math.floor(rand(0, rows));
    if (!free(c, r)) continue;
    const dir = Math.floor(rand(0, 4)) * 2;                          // buses start straight
    const lanes = Math.random() < 0.3 ? 2 + Math.floor(rand(0, 3)) : 1;
    const [sc, sr] = DIRS[(dir + 2) % 8];                            // sideways step between lanes
    const runs = 2 + Math.floor(rand(0, 4));
    for (let l = 0; l < lanes; l++) if (walk(c + sc * l * 2, r + sr * l * 2, dir, runs)) k++;
  }

  // Draw the whole board once, off-screen, at full brightness;
  // a spark's glow decides how much of it shows.
  board.width = Math.floor(W * DPR); board.height = Math.floor(H * DPR);
  bc.setTransform(DPR, 0, 0, DPR, 0, 0);
  bc.lineCap = "round"; bc.lineJoin = "round";
  bc.strokeStyle = bc.fillStyle = "rgb(214, 128, 82)";               // copper
  bc.lineWidth = 1.3;
  for (const t of traces) {
    bc.beginPath();
    t.pts.forEach(([x, y], k) => (k ? bc.lineTo(x, y) : bc.moveTo(x, y)));
    bc.stroke();
  }
  bc.lineWidth = 1.2;
  for (const [x, y] of pads) { bc.beginPath(); bc.arc(x, y, 2.6, 0, Math.PI * 2); bc.stroke(); }
  for (const ch of chips) {
    bc.strokeRect(ch.x + 2.5, ch.y + 2.5, ch.w - 5, ch.h - 5);
    bc.beginPath(); bc.arc(ch.x + 7, ch.y + 7, 1.5, 0, Math.PI * 2); bc.fill();     // pin-1 dot
    for (let p = 0; p < ch.pins; p++) {
      const x = ch.x + p * G + G / 2 - 1.5;
      bc.fillRect(x, ch.y - 2, 3, 4);
      bc.fillRect(x, ch.y + ch.h - 2, 3, 4);
    }
  }
}

function pointAt(t, d) {
  d = Math.max(0, Math.min(t.len, d));
  let k = 1;
  while (k < t.cum.length - 1 && t.cum[k] < d) k++;
  const a = t.pts[k - 1], b = t.pts[k];
  const f = (d - t.cum[k - 1]) / (t.cum[k] - t.cum[k - 1] || 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/* Every spark is a little different: its own speed (which also surges and
 * drags as it runs), brightness, glow size and end flash. When it reaches the
 * end of a trace it may hop onto a trace that starts nearby and keep going,
 * so some runs are long. Now and then it stutters (dims for a moment). */
function newSpark(t, x, y) {
  const P = SETTINGS.pcb;
  // Start at the trace end nearest to (x, y) if given, else at a random end.
  let reverse = Math.random() < 0.5;
  if (x !== undefined) {
    const [ax, ay] = t.pts[0], [bx, by] = t.pts[t.pts.length - 1];
    reverse = Math.hypot(bx - x, by - y) < Math.hypot(ax - x, ay - y);
  }
  return {
    t, d: 0, reverse, flash: 0,
    speed:  rand(P.speed[0], P.speed[1]),
    bright: rand(0.6, 1.15),
    radius: P.radius * rand(0.7, 1.35),
    flashFor: rand(P.flash[0], P.flash[1]),
    hops: 0,
    phase: rand(0, 100),
    stutter: 0,
  };
}

// A trace that starts or ends within ~2 grid cells of (x, y), other than `not`.
function traceNear(x, y, not) {
  const reach = SETTINGS.pcb.grid * 2.2;
  const near = traces.filter((t) => t !== not && t.len > 40 &&
    (Math.hypot(t.pts[0][0] - x, t.pts[0][1] - y) < reach ||
     Math.hypot(t.pts[t.pts.length - 1][0] - x, t.pts[t.pts.length - 1][1] - y) < reach));
  return near.length ? pick(near) : null;
}

function spawnSpark() {
  const P = SETTINGS.pcb;
  const pool = traces.filter((t) => t.len > 70);
  if (!pool.length || sparks.length >= P.maxSparks || document.hidden || scrolling) return;
  const first = newSpark(pick(pool));
  sparks.push(first);
  // Sometimes a burst: a second or third spark on a trace close to the first.
  if (Math.random() < P.burstChance) {
    const [x, y] = first.t.pts[0];
    for (let k = 0; k < 1 + Math.floor(rand(0, 2)) && sparks.length < P.maxSparks; k++) {
      const t = traces.filter((o) => o !== first.t && o.len > 50 && Math.hypot(o.pts[0][0] - x, o.pts[0][1] - y) < 220);
      if (t.length) { const s = newSpark(pick(t)); s.d = -rand(20, 120); sparks.push(s); }    // starts a beat later
    }
  }
  if (!pcbRunning) { pcbRunning = true; lastPcb = performance.now(); requestAnimationFrame(drawPCB); }
}

function scheduleSpark() {
  const [a, b] = SETTINGS.pcb.every;
  // Uneven gaps: mostly short-ish, now and then a long quiet spell.
  const wait = Math.random() < 0.15 ? rand(b, b * 2) : rand(a, b);
  setTimeout(() => { spawnSpark(); scheduleSpark(); }, wait * 1000);
}

function drawPCB(now) {
  const dt = Math.min(0.05, (now - lastPcb) / 1000);
  lastPcb = now;
  const P = SETTINGS.pcb;
  pc.setTransform(DPR, 0, 0, DPR, 0, 0);
  pc.clearRect(0, 0, window.innerWidth, window.innerHeight);

  sparks = sparks.filter((s) => {
    // Speed surges and drags along the way.
    const surge = 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(now / 1000 * 3.1 + s.phase) * Math.sin(now / 1000 * 1.7 + s.phase * 2));
    if (s.d < s.t.len) s.d += s.speed * surge * dt;
    else if (!s.flash && s.hops < P.maxHops && Math.random() < P.hopChance) {
      // Hop onto a connected trace and keep running.
      const [ex, ey] = pointAt(s.t, s.reverse ? 0 : s.t.len);
      const next = traceNear(ex, ey, s.t);
      if (next) { Object.assign(s, { t: next, d: 0, hops: s.hops + 1, reverse: newSpark(next, ex, ey).reverse }); }
      else s.flash += dt;
    } else s.flash += dt;                                          // the end: flash at the pad, then fade
    if (s.flash > s.flashFor) return false;
    if (s.d <= 0) return true;                                     // a burst spark waiting its turn

    const at = (d) => pointAt(s.t, s.reverse ? s.t.len - d : d);
    const [x, y] = at(s.d);
    const R = s.radius;
    if (s.stutter > 0) s.stutter -= dt;
    else if (Math.random() < 0.012) s.stutter = rand(0.04, 0.14);  // a brief dropout now and then
    const fade = Math.min(1, s.d / 30) * (1 - s.flash / s.flashFor) * (s.stutter > 0 ? 0.25 : 1) * s.bright;
    const flick = 0.7 + Math.random() * 0.3;                       // electric flicker

    // 1. Light up the board around the spark: a soft circle of the hidden board.
    //    The end flash lights a slightly bigger area.
    const lr = R * (1 + 0.35 * Math.min(1, s.flash * 6));
    const ls = Math.ceil(lr * 2 * DPR);
    if (lamp.width < ls) lamp.width = lamp.height = ls;
    lc.globalCompositeOperation = "source-over";
    lc.clearRect(0, 0, lamp.width, lamp.height);
    const grad = lc.createRadialGradient(ls / 2, ls / 2, 0, ls / 2, ls / 2, ls / 2);
    grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.55 * fade * flick)})`);
    grad.addColorStop(0.45, `rgba(255,255,255,${Math.min(1, 0.18 * fade * flick)})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    lc.fillStyle = grad;
    lc.fillRect(0, 0, ls, ls);
    lc.globalCompositeOperation = "source-in";
    lc.drawImage(board, (x - lr) * DPR, (y - lr) * DPR, ls, ls, 0, 0, ls, ls);
    pc.globalCompositeOperation = "lighter";
    pc.drawImage(lamp, 0, 0, ls, ls, x - lr, y - lr, lr * 2, lr * 2);

    // 2. The current behind the spark: a bright tail along its trace.
    const tail = 34 + s.speed * 0.06;
    pc.lineWidth = 1.6;
    for (let k = 0; k < 8; k++) {
      const d1 = s.d - tail * k / 8;
      if (d1 <= 0) break;
      const [x0, y0] = at(Math.max(0, s.d - tail * (k + 1) / 8)), [x1, y1] = at(Math.min(s.t.len, d1));
      pc.strokeStyle = `rgba(255, 170, 110, ${Math.min(1, (1 - k / 8) * 0.8 * fade)})`;
      pc.beginPath(); pc.moveTo(x0, y0); pc.lineTo(x1, y1); pc.stroke();
    }

    // 3. The spark: a tiny white-hot core with an orange glow, and a few crackles.
    const glowR = (s.flash ? 9 + Math.min(1, s.flash * 5) * 12 : 7) * flick;
    const glow = pc.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, `rgba(255, 245, 230, ${Math.min(1, fade)})`);
    glow.addColorStop(0.25, `rgba(255, 150, 80, ${Math.min(1, 0.8 * fade)})`);
    glow.addColorStop(1, "rgba(235, 70, 4, 0)");
    pc.fillStyle = glow;
    pc.beginPath(); pc.arc(x, y, glowR, 0, Math.PI * 2); pc.fill();
    if (Math.random() < (s.flash ? 0.8 : 0.5)) {
      pc.strokeStyle = `rgba(255, 220, 190, ${Math.min(1, 0.7 * fade)})`;
      pc.lineWidth = 0.8;
      for (let c = 0; c < (s.flash ? 3 : 2); c++) {
        const a = rand(0, Math.PI * 2), l = rand(3, s.flash ? 11 : 7);
        pc.beginPath(); pc.moveTo(x, y);
        pc.lineTo(x + Math.cos(a) * l * 0.5 + rand(-1.5, 1.5), y + Math.sin(a) * l * 0.5 + rand(-1.5, 1.5));
        pc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        pc.stroke();
      }
    }
    pc.globalCompositeOperation = "source-over";
    return true;
  });

  if (sparks.length) requestAnimationFrame(drawPCB);
  else { pcbRunning = false; pc.clearRect(0, 0, window.innerWidth, window.innerHeight); }
}

function sizePCB() {
  pcbCanvas.width  = Math.floor(window.innerWidth * DPR);
  pcbCanvas.height = Math.floor(window.innerHeight * DPR);
  sparks = [];
  generateBoard();
}

function buildPCB() {
  sizePCB();
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(sizePCB, 200); });
  scheduleSpark();
}


/* ═══════════════════════════════════════════════════════════════════════
 *  SMOOTH SCROLL + "while scrolling"
 *  Lenis eases the wheel, so the page glides instead of stepping a notch at a time
 *  (touch scrolling stays native). While you scroll, the sparks fade out and no new
 *  ones start, and a cover's glitch waits until you stop: the browser only has
 *  the slides to draw, so scrolling stays smooth.
 * ═══════════════════════════════════════════════════════════════════════ */
let lenis = null, scrolling = false, pendingGlitch = -1, calmTimer;

function startSmoothScroll() {
  if (SETTINGS.smoothScroll && !REDUCED && window.Lenis) {
    lenis = new Lenis({ lerp: SETTINGS.smoothLerp, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.addEventListener("scroll", () => {
    if (!scrolling) { scrolling = true; document.body.classList.add("is-scrolling"); }
    clearTimeout(calmTimer);
    calmTimer = setTimeout(() => {
      scrolling = false;
      document.body.classList.remove("is-scrolling");
      if (pendingGlitch === current) glitchBurst(pendingGlitch);
      pendingGlitch = -1;
    }, SETTINGS.calmMs);
  }, { passive: true });
}


/* ═══════════════════════════════════════════════════════════════════════
 *  6. FLOW MODE — mobile + reduced motion
 *  Slides stacked full-width in the page, orange bars between projects.
 * ═══════════════════════════════════════════════════════════════════════ */
function buildFlow() {
  document.body.classList.add("flow");
  SLIDES.forEach((s, i) => {
    if (s.transition === "wipe") {
      const bar = document.createElement("div");
      bar.className = "flow-divider";
      bar.textContent = projectText(s.project);
      spacer.appendChild(bar);
    }
    const img = imgs[i];
    img.loading = "lazy";
    img.src = s.src;
    spacer.appendChild(img);
    ScrollTrigger.create({
      trigger: img, start: "top center", end: "bottom center",
      onToggle: (self) => { if (self.isActive) setActiveNav(s.project); },
    });
  });
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => { document.getElementById("progress-bar").style.width = self.progress * 100 + "%"; },
  });
  setActiveNav(SLIDES[0].project);
}


/* ═══════════════════════════════════════════════════════════════════════
 *  START
 * ═══════════════════════════════════════════════════════════════════════ */
buildNav();
if (FLOW) buildFlow();
else      { startSmoothScroll(); buildStage(); }

// Crossing the mobile breakpoint switches layouts — simplest is a reload.
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if ((window.innerWidth < SETTINGS.mobileBreakpoint) !== MOBILE) location.reload();
  }, 250);
});
