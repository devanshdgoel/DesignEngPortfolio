"use strict";
/* ═══════════════════════════════════════════════════════════════════════
 *  PORTFOLIO v2 — main.js
 *
 *  The Figma layout, rendered to one image per slide (slides/*.webp),
 *  shown one slide at a time. Scrolling works like this for every slide:
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
 *          3. BUILD (strip, timeline, nav)   4. GLITCH   5. CIRCUIT SPARKS
 *          6. FLOW MODE
 * ═══════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════
 *  1. SETTINGS + PROJECTS
 * ═══════════════════════════════════════════════════════════════════════ */
const SETTINGS = {
  // ── Pacing ──
  holdVH:    12,     // scroll on each slide where nothing moves (was 60)
  travelVH:  45,     // scroll to move to the next slide
  wipeVH:    65,     // scroll for an orange project wipe
  fadeVH:    48,     // scroll for a fade-through transition
  snap:      true,   // finish a page change automatically when scrolling stops
  commitAt:  0.08,   // how far into a change (0–1) before it always completes (one wheel notch is enough)
  landInVH:  6,      // after an auto-finish, land this far inside the new slide's hold
  snapDuration: [0.9, 1.4],    // seconds an auto-finished change takes (min, max) — higher = slower, easier to follow
  scrub:     1,      // smoothing (seconds): the page eases after the scrollbar instead of jumping with it

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
 *  transition  how we ARRIVE at this slide:
 *                "slide" (default)  the page moves up
 *                "wipe"             orange project screen with the label
 *                "fade"             fades out, then the next fades in
 *  settle      true → tiny zoom-out as the slide lands (used on covers)
 *  glitch      true → short glitch burst as the slide lands
 *  hold        optional: this slide's own hold length (vh)
 *
 *  The orange screens in the PDF (s10, s16, s21) aren't listed: the "wipe"
 *  transition replaces them. s28–s30 are empty and left out.
 * ═══════════════════════════════════════════════════════════════════════ */
const SLIDES = [
  // ── Intro ──
  { src: "slides/s01.webp", project: "intro", glitch: true },          // Portfolio cover
  { src: "slides/s02.webp", project: "intro" },                        // About me
  { src: "slides/s03.webp", project: "intro" },                        // Contents

  // ── 01 Stride ──
  { src: "slides/s04.webp", project: "stride", transition: "wipe", settle: true, glitch: true },
  { src: "slides/s05.webp", project: "stride" },                       // Mechanical development
  { src: "slides/s06.webp", project: "stride" },                       // Prototyping / Electrical
  { src: "slides/s07.webp", project: "stride" },                       // Components
  { src: "slides/s08.webp", project: "stride" },                       // CMF and packaging
  { src: "slides/s09.webp", project: "stride", transition: "fade" },   // User validation (full-bleed photo)

  // ── 02 SOLUS ──
  { src: "slides/s11.webp", project: "solus", transition: "wipe", settle: true, glitch: true },
  { src: "slides/s12.webp", project: "solus" },                        // Structures
  { src: "slides/s13.webp", project: "solus" },                        // Concept and prototyping
  { src: "slides/s14.webp", project: "solus" },                        // Generative design
  { src: "slides/s15.webp", project: "solus" },                        // Design language

  // ── 03 FlexiCook ──
  { src: "slides/s17.webp", project: "flexicook", transition: "wipe", settle: true, glitch: true },
  { src: "slides/s18.webp", project: "flexicook" },                    // User research
  { src: "slides/s19.webp", project: "flexicook" },                    // Design and prototyping
  { src: "slides/s20.webp", project: "flexicook" },                    // Final design

  // ── 04 Calyx ──
  { src: "slides/s22.webp", project: "calyx", transition: "wipe", settle: true, glitch: true },
  { src: "slides/s23.webp", project: "calyx" },                        // Concept development
  { src: "slides/s24.webp", project: "calyx" },                        // Product analysis
  { src: "slides/s25.webp", project: "calyx" },                        // Prototyping
  { src: "slides/s26.webp", project: "calyx" },                        // Device body

  // ── Outro ──
  { src: "slides/s27.webp", project: "outro", transition: "fade", hold: 40 },   // Thank you
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
    { project: "solus",     rect: [355, 286, 583, 597] },
    { project: "flexicook", rect: [609, 286, 836, 597] },
    { project: "calyx",     rect: [862, 286, 1090, 597] },
  ],
};


/* ═══════════════════════════════════════════════════════════════════════
 *  3. BUILD — you shouldn't need to edit below here
 * ═══════════════════════════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

const SLIDE_W = 1190, SLIDE_H = 842;   // Figma slide size (pt)
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
let total = 0;                   // total timeline length (vh)

const vh = () => window.innerHeight / 100;
const projectText = (key) => {
  const p = PROJECTS[key] || {};
  return [p.label, p.name].filter(Boolean).join(" / ");
};

// One <img> per slide. They load a few at a time (see loadAround).
const imgs = SLIDES.map((s) => {
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.dataset.src = s.src;
  return img;
});

function loadAround(i) {
  for (let k = i - 1; k <= i + SETTINGS.preload; k++) {
    const img = imgs[k];
    if (img && !img.getAttribute("src")) img.src = img.dataset.src;
  }
}

/* ── Fit the slide window to the screen (like "contain") ── */
function fitFrame() {
  const s = Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H);
  root.style.setProperty("--frame-w", SLIDE_W * s + "px");
  root.style.setProperty("--frame-h", SLIDE_H * s + "px");
  sizeGlitchCanvas();
}

/* ── Transitions: each adds tweens for "arrive at slide i", starting at time t ──
 *  Strip position: slide i is at yPercent = -(i / N) * 100 of the strip.   */
const TRANSITIONS = {

  // The page moves up to the next slide.
  slide(tl, i, t) {
    const d = SETTINGS.travelVH;
    tl.to(strip, { yPercent: -(i / N) * 100, ease: "power2.inOut", duration: d }, t);
    if (SLIDES[i].settle) {
      tl.to(frame, { scale: 1.03, ease: "sine.in", duration: d / 2 }, t);
      tl.to(frame, { scale: 1, ease: "power2.out", duration: d / 2 }, t + d / 2);
    }
    return d;
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
    return d;
  },

  // Current slide fades to the background, then the next one fades in.
  fade(tl, i, t) {
    const d = SETTINGS.fadeVH;
    tl.to(frame, { autoAlpha: 0, ease: "power1.in", duration: d * 0.45 }, t);
    tl.set(strip, { yPercent: -(i / N) * 100 }, t + d * 0.5);
    tl.to(frame, { autoAlpha: 1, ease: "power1.out", duration: d * 0.45 }, t + d * 0.55);
    return d;
  },
};

function buildStage() {
  imgs.forEach((img) => strip.appendChild(img));
  strip.style.height = `calc(var(--frame-h) * ${N})`;
  fitFrame();
  window.addEventListener("resize", fitFrame);

  // One timeline for the whole site, measured in vh of scroll.
  const tl = gsap.timeline({ defaults: { overwrite: false } });
  const arrive = [];       // arrive[i] = { t, d }: when the transition INTO slide i starts, and how long it is
  let t = 0;
  SLIDES.forEach((s, i) => {
    if (i > 0) {
      const type = TRANSITIONS[s.transition] ? s.transition : "slide";
      if (s.transition && !TRANSITIONS[s.transition])
        console.warn(`[v2] Unknown transition "${s.transition}" on slide ${i + 1} — using "slide".`);
      const d = TRANSITIONS[type](tl, i, t);
      arrive[i] = { t, d };
      // Glitch as the slide lands (only when scrolling forwards).
      if (s.glitch) tl.call(() => { if (st && st.direction > 0) glitchBurst(i); }, null, t + d * (type === "wipe" ? 0.62 : 0.9));
      t += d;
    }
    const hold = s.hold ?? SETTINGS.holdVH;
    stops.push({ start: t, end: t + hold, mid: t + hold / 2 });
    t += hold;
  });
  total = t;
  buildContents(tl, arrive);
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
  const brand = document.getElementById("brand");
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
    gsap.set([nav, brand], { autoAlpha: navIn });
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
 *  • Stopped on a slide (inside its hold)?  Stay exactly where you are.
 *  • Stopped between two slides?  Finish the change in the direction you
 *    were scrolling, once you're past SETTINGS.commitAt of the way. So a
 *    half swipe carries on to the next page instead of bouncing back.
 *  (GSAP's default snap projects momentum, which can skip whole slides.) */
function snapTarget(progress, direction) {
  const time = progress * total;
  const k = stops.findIndex((s, i) => i + 1 < stops.length && time > s.end && time < stops[i + 1].start);
  if (k < 0) return progress;                                  // on a slide: don't move

  const from = stops[k], to = stops[k + 1];
  const frac = (time - from.end) / (to.start - from.end);      // 0 → 1 through the change
  const forward = direction >= 0 ? frac > SETTINGS.commitAt : frac > 1 - SETTINGS.commitAt;
  const inset = (s) => Math.min(SETTINGS.landInVH, (s.end - s.start) / 2);
  return (forward ? to.start + inset(to) : from.end - inset(from)) / total;
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
  window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
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
  if (!pool.length || sparks.length >= P.maxSparks || document.hidden) return;
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
else      buildStage();

// Crossing the mobile breakpoint switches layouts — simplest is a reload.
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if ((window.innerWidth < SETTINGS.mobileBreakpoint) !== MOBILE) location.reload();
  }, 250);
});
