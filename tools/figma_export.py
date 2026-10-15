"""
figma_export.py — pull the slides straight from Figma (no PDF needed).

    set FIGMA_TOKEN=figd_...            (Windows cmd;  PowerShell: $env:FIGMA_TOKEN="figd_...")
    python tools/figma_export.py

Run it from the v2 folder. It:
  1. reads every frame on the Figma page (PAGE below), in top-to-bottom order
  2. rebuilds each one from its layers into slides/NN.webp, leaving out HIDE
     (orange project screens are skipped: the site's wipe replaces them)
  3. for the frames listed in LIFT, also exports the animated layers on their own
     (slides/NN-<layer>.webp) and a background without them (slides/NN-bg.webp)
  4. writes slides/manifest.js — frame names, sizes and where every lifted layer
     sits, in Figma points. main.js reads it (no server needed: it's a <script>).

Needs:  pip install pillow numpy      and a Figma personal access token (read-only).
"""
import http.client, io, json, math, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

FILE_KEY = "zelLSFSon3x68PM8BIzUQq"
PAGE     = "421:10"
SCALE    = 2.5        # render resolution: 1302 pt → 3255 px wide (sharp on retina)
QUALITY  = 90
SKIP     = re.compile(r"orange", re.I)     # frames left out by name (the wipe replaces them)
ACCENT   = (235, 70, 4)                    # ...and any frame that renders as (almost) solid orange
HIDE     = {"Group 87"}                    # layers left out of every slide (the left-edge 1–4 ticks)

# Layers lifted out of a frame so main.js can animate them.
#   frame name prefix → { layer name: [node ids] }   (several ids are merged into one image)
#   "@labels" exports every remaining TEXT/VECTOR (except `keep`) as its own layer.
LIFT = {
    "4. Stride 1":  {"cane":   ["421:55"]},
    "5. Stride 2":  {"wheel":  ["421:81", "421:82"] + [f"421:{n}" for n in range(94, 109)]},
    "7. Stride 4":  {"bottom": ["421:441"], "top": ["421:442"],
                     "@labels": {"keep": ["Components", "Group 87"]}},
    "12. Solus 2":  {"render": ["421:527"]},
}

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "..", "slides")
TOKEN = os.environ.get("FIGMA_TOKEN") or (sys.argv[1] if len(sys.argv) > 1 else None)


def api(path):
    req = urllib.request.Request("https://api.figma.com/v1/" + path, headers={"X-Figma-Token": TOKEN})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(2 ** attempt * 3)
                continue
            raise


CACHE = os.path.join(here, ".figma-cache")      # renders are kept here per file version, so re-runs are fast
VERSION = "latest"


def download(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return r.read()
        except (http.client.IncompleteRead, urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 4:
                raise
            time.sleep(2 + attempt * 3)


def render(ids, abs_bounds=False):
    """Render nodes to PNG. Returns {id: PIL image}."""
    folder = os.path.join(CACHE, VERSION)
    os.makedirs(folder, exist_ok=True)
    path = lambda i: os.path.join(folder, f"{i.replace(':', '-')}_{SCALE}{'_abs' if abs_bounds else ''}.png")
    todo = [i for i in ids if not os.path.exists(path(i))]
    for k in range(0, len(todo), 40):
        chunk = todo[k:k + 40]
        q = urllib.parse.urlencode({"ids": ",".join(chunk), "format": "png", "scale": SCALE,
                                    "use_absolute_bounds": str(abs_bounds).lower()})
        urls = api(f"images/{FILE_KEY}?{q}")["images"]

        def get(item):
            i, url = item
            data = download(url)
            with open(path(i), "wb") as fh:
                fh.write(data)
        with ThreadPoolExecutor(8) as pool:
            list(pool.map(get, [(i, u) for i, u in urls.items() if u]))
    return {i: Image.open(path(i)).convert("RGBA") for i in ids if os.path.exists(path(i))}


def box(n):
    b = n["absoluteBoundingBox"]
    return b["x"], b["y"], b["width"], b["height"]


def rbox(n):
    """Render bounds: what a PNG export of the node covers (includes strokes and
    effects, so zero-height lines still have a size)."""
    b = n.get("absoluteRenderBounds") or n["absoluteBoundingBox"]
    return b["x"], b["y"], b["width"], b["height"]


def save(img, name):
    img.save(os.path.join(out_dir, name), quality=QUALITY, alpha_quality=95, method=6)


def image_rect(node, fx, fy):
    """Where the node's full image would sit (pt, frame-relative), undoing a crop transform.
    Used to line up the Blender sequences with the stills placed in Figma."""
    x, y, w, h = box(node)
    x, y = x - fx, y - fy
    fill = next((f for f in node.get("fills", []) if f["type"] == "IMAGE"), None)
    t = fill and fill.get("imageTransform")
    if not t:
        return [x, y, w, h]
    (a, _, c), (_, d, f) = t          # node shows image u ∈ [c, c+a], v ∈ [f, f+d]
    W, H = w / a, h / d
    return [x - c * W, y - f * H, W, H]


def wheel_pivot(nodes, fx, fy):
    """Centre of the tick arc: least-squares intersection of the tick lines' axes."""
    A, b = np.zeros((2, 2)), np.zeros(2)
    for n in nodes:
        if n["type"] != "LINE":
            continue
        (m00, m01, tx), (m10, m11, ty) = n["relativeTransform"]
        d = np.array([m00, m10])                      # the line runs along its local x axis
        p = np.array([tx, ty])
        nrm = np.array([-d[1], d[0]])
        A += np.outer(nrm, nrm); b += nrm * nrm.dot(p)
    cx, cy = np.linalg.solve(A, b)
    # relativeTransform is relative to the parent frame already
    return [float(cx), float(cy)]


def main():
    if not TOKEN:
        sys.exit("Set FIGMA_TOKEN (or pass the token as the first argument).")
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.endswith(".webp"):
            os.remove(os.path.join(out_dir, f))

    global VERSION
    res = api(f"files/{FILE_KEY}/nodes?ids={PAGE}&geometry=paths")
    VERSION = str(res.get("version", "latest"))
    page = res["nodes"][PAGE]["document"]
    frames = [f for f in page["children"] if f["type"] == "FRAME" and not SKIP.search(f["name"])]
    frames.sort(key=lambda f: box(f)[1])                 # top-to-bottom = scroll order

    W0, H0 = 1302, 842                                   # standard slide size (pt)
    size = (round(W0 * SCALE), round(H0 * SCALE))
    manifest = {"slideW": W0, "slideH": H0, "slides": []}
    k = 0
    for f in frames:
        lift = next((v for p, v in LIFT.items() if f["name"].strip().startswith(p)), {})
        img, extra = compose(f, lift, size)
        px = np.asarray(img.resize((60, 40)), dtype=int).reshape(-1, 3)
        if (np.abs(px - ACCENT).sum(1) < 90).mean() > 0.8:
            print(f"  skip  {f['name'].strip()}  (orange screen)")
            continue
        k += 1
        name = f"{k:02d}"
        save(img, name + ".webp")
        entry = {"n": k, "name": f["name"].strip(), "id": f["id"], "src": f"slides/{name}.webp"}
        if lift:
            entry.update(save_layers(f, lift, name, size, extra))
        manifest["slides"].append(entry)
        print(f"  {name}  {f['name'].strip():22s}" + ("  layers: " + ", ".join(entry["layers"]) if lift else ""))

    with open(os.path.join(out_dir, "manifest.js"), "w", encoding="utf-8") as fh:
        fh.write("// Written by tools/figma_export.py — don't edit by hand.\n")
        fh.write("window.FIGMA = " + json.dumps(manifest, indent=1, ensure_ascii=False) + ";\n")
    print(f"\nSaved {k} slides to {os.path.normpath(out_dir)}")


def compose(frame, lift, size):
    """Rebuild the frame from its layers (so HIDE / lifted layers can be left out).
    Returns the slide image and what save_layers needs."""
    fx, fy, _, _ = box(frame)
    kids = [c for c in frame["children"] if c.get("visible", True) is not False]
    groups = {k: v for k, v in lift.items() if not k.startswith("@")}
    lifted = {i for ids in groups.values() for i in ids}
    if "@labels" in lift:
        keep = set(lift["@labels"]["keep"]) | HIDE
        for c in kids:
            if c["id"] not in lifted and c["name"] not in keep and c["type"] in ("TEXT", "VECTOR", "LINE"):
                groups[f"label-{c['id'].split(':')[1]}"] = [c["id"]]
                lifted.add(c["id"])

    # Exact node bounds place layers most precisely; nodes Figma can't export that
    # way (zero-height lines) are rendered at their render bounds instead.
    imgs = render([c["id"] for c in kids] + [frame["id"]], abs_bounds=True)
    loose = [c["id"] for c in kids if c["id"] not in imgs]
    imgs.update(render(loose))
    where = {c["id"]: (rbox(c) if c["id"] in loose else box(c)) for c in kids}
    fill = next((p for p in frame.get("fills", []) if p["type"] == "SOLID" and p.get("visible", True)), None)
    rgb = tuple(round(fill["color"][c] * 255) for c in "rgb") if fill else (16, 13, 13)
    full, bg, check = (Image.new("RGBA", size, rgb + (255,)) for _ in range(3))
    for c in kids:
        x, y, _, _ = where[c["id"]]
        im = imgs.get(c["id"])
        if im is None:
            continue
        at = (round((x - fx) * SCALE), round((y - fy) * SCALE))
        _paste_clipped(check, im, *at)
        if c["name"] in HIDE:
            continue
        _paste_clipped(full, im, *at)
        if c["id"] not in lifted:
            _paste_clipped(bg, im, *at)
    ref = imgs[frame["id"]].convert("RGB").resize(size)
    diff = np.abs(np.asarray(check.convert("RGB"), dtype=int) - np.asarray(ref, dtype=int)).mean()
    if diff > 4:
        print(f"      ! {frame['name'].strip()}: rebuilt slide differs from Figma's render by {diff:.1f} — using Figma's")
        full = ref.convert("RGBA")
    return full.convert("RGB"), {"bg": bg, "groups": groups, "imgs": imgs, "kids": kids, "where": where}


def save_layers(frame, lift, name, size, extra):
    fx, fy, _, _ = box(frame)
    S = SCALE
    save(extra["bg"].convert("RGB"), f"{name}-bg.webp")
    byid = {c["id"]: c for c in extra["kids"]}
    layers = {}
    for lname, ids in extra["groups"].items():
        nodes = [byid[i] for i in ids]
        bs = [extra["where"][n["id"]] for n in nodes]
        x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs)
        x1 = max(b[0] + b[2] for b in bs); y1 = max(b[1] + b[3] for b in bs)
        canvas = Image.new("RGBA", (max(1, math.ceil((x1 - x0) * S)), max(1, math.ceil((y1 - y0) * S))), (0, 0, 0, 0))
        for n, (x, y, _, _) in zip(nodes, bs):
            _paste_clipped(canvas, extra["imgs"][n["id"]], round((x - x0) * S), round((y - y0) * S))
        file = f"{name}-{lname}.webp"
        save(canvas, file)
        L = {"src": f"slides/{file}", "rect": [x0 - fx, y0 - fy, x1 - x0, y1 - y0], "type": nodes[0]["type"]}
        if len(nodes) == 1 and any(p["type"] == "IMAGE" for p in nodes[0].get("fills", [])):
            L["imageRect"] = image_rect(nodes[0], fx, fy)
        if lname == "wheel":
            L["pivot"] = wheel_pivot(nodes, fx, fy)
        layers[lname] = L
    return {"bg": f"slides/{name}-bg.webp", "layers": layers}


def _paste_clipped(canvas, im, x, y):
    """alpha_composite that allows negative offsets (Figma frames clip their children)."""
    sx, sy = max(0, -x), max(0, -y)
    if sx >= im.width or sy >= im.height:
        return
    canvas.alpha_composite(im.crop((sx, sy, im.width, im.height)), (max(0, x), max(0, y)))


if __name__ == "__main__":
    main()
