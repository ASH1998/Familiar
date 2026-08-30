#!/usr/bin/env python3
"""
Extract web-usable sprite data from the Unity asset folders.

The PNGs in assets/SwordSearch-Assets/ and assets/Assets/ are ordinary PNGs — nothing
about them is Unity-specific. What *is* Unity-specific, and worth recovering, are the
sidecar files:

  *.png.meta   hand-authored sprite slicing: name + rect + pivot + 9-slice border
  *.anim       animation clips: which sprites, in what order, at what frame rate

Both are plain YAML. This script parses them without Unity and emits:

  atlas.json   {png -> {w, h, sprites: [{name, x, y, w, h, pivot, border}]}}
  clips.json   {clip -> {fps, texture, frames: [{t, sprite}]}}

Sprite rects are converted from Unity's bottom-left origin to top-left, so the numbers
drop straight into CSS background-position / canvas drawImage.

Usage:
    python3 tools/unity-extract.py                 # scan, write to build/
    python3 tools/unity-extract.py --copy-png      # also copy PNGs into build/art/
    python3 tools/unity-extract.py --out somewhere
"""

import argparse
import json
import pathlib
import re
import shutil
import struct
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
ROOTS = [
    REPO / "assets" / "SwordSearch-Assets",
    REPO / "assets" / "Assets",
]

# --- sprite block inside a .png.meta -----------------------------------------
# Blocks are uniform enough to regex; a YAML lib would work too but Unity's
# %TAG-flavoured YAML needs coaxing and this is a one-shot tool.
SPRITE_RE = re.compile(
    r"- serializedVersion: 2\s*\n"
    r"\s+name: (?P<name>.*?)\n"
    r"\s+rect:\s*\n"
    r"\s+serializedVersion: 2\s*\n"
    r"\s+x: (?P<x>-?\d+)\s*\n"
    r"\s+y: (?P<y>-?\d+)\s*\n"
    r"\s+width: (?P<w>\d+)\s*\n"
    r"\s+height: (?P<h>\d+)\s*\n"
    r"\s+alignment: \d+\s*\n"
    r"\s+pivot: \{x: (?P<px>[-\d.]+), y: (?P<py>[-\d.]+)\}\s*\n"
    r"\s+border: \{x: (?P<bx>[-\d.]+), y: (?P<by>[-\d.]+), "
    r"z: (?P<bz>[-\d.]+), w: (?P<bw>[-\d.]+)\}"
)
INTERNAL_ID_RE = re.compile(r"^\s+internalID: (-?\d+)\s*$", re.M)
GUID_RE = re.compile(r"^guid: ([0-9a-f]{32})\s*$", re.M)

# --- .anim ---------------------------------------------------------------------
CLIP_NAME_RE = re.compile(r"^\s+m_Name: (.*?)\s*$", re.M)
SAMPLE_RATE_RE = re.compile(r"^\s+m_SampleRate: ([\d.]+)\s*$", re.M)
KEY_RE = re.compile(
    r"- time: (?P<t>[\d.eE+-]+)\s*\n"
    r"\s+value: \{fileID: (?P<fid>-?\d+), guid: (?P<guid>[0-9a-f]{32}), type: \d+\}"
)


def png_size(path):
    """Width/height straight out of the IHDR chunk. No image library needed."""
    with open(path, "rb") as fh:
        head = fh.read(24)
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def parse_meta(meta_path):
    text = meta_path.read_text(encoding="utf-8", errors="replace")
    guid_m = GUID_RE.search(text)
    if not guid_m:
        return None

    png_path = meta_path.with_suffix("")  # strip .meta -> foo.png
    if not png_path.exists():
        return None
    size = png_size(png_path)
    if not size:
        return None
    tex_w, tex_h = size

    # internalIDs appear once per sprite block, in the same order as the blocks,
    # so zip them positionally.
    blocks = list(SPRITE_RE.finditer(text))
    ids = INTERNAL_ID_RE.findall(text)

    sprites = []
    for idx, m in enumerate(blocks):
        x, y = int(m["x"]), int(m["y"])
        w, h = int(m["w"]), int(m["h"])
        sprites.append(
            {
                "name": m["name"],
                "id": int(ids[idx]) if idx < len(ids) else None,
                "x": x,
                # Unity rects are bottom-left origin; flip to top-left for the web.
                "y": tex_h - (y + h),
                "w": w,
                "h": h,
                "pivot": [float(m["px"]), float(m["py"])],
                "border": [float(m["bx"]), float(m["by"]), float(m["bz"]), float(m["bw"])],
            }
        )

    return {
        "guid": guid_m.group(1),
        "png": str(png_path.relative_to(REPO)),
        "w": tex_w,
        "h": tex_h,
        "sprites": sprites,
    }


def parse_anim(anim_path, by_guid):
    text = anim_path.read_text(encoding="utf-8", errors="replace")
    name_m = CLIP_NAME_RE.search(text)
    rate_m = SAMPLE_RATE_RE.search(text)
    keys = list(KEY_RE.finditer(text))
    if not name_m or not keys:
        return None

    frames, textures = [], set()
    for k in keys:
        tex = by_guid.get(k["guid"])
        sprite_name = None
        if tex:
            textures.add(tex["png"])
            fid = int(k["fid"])
            for s in tex["sprites"]:
                if s["id"] == fid:
                    sprite_name = s["name"]
                    break
        frames.append({"t": float(k["t"]), "sprite": sprite_name, "id": int(k["fid"])})

    # Drop Unity's trailing duplicate key (it exists only to give the clip a length).
    if len(frames) > 1 and frames[-1]["id"] == frames[-2]["id"]:
        frames.pop()

    return {
        "clip": name_m.group(1),
        "fps": float(rate_m.group(1)) if rate_m else 12.0,
        "textures": sorted(textures),
        "unresolved": sum(1 for f in frames if f["sprite"] is None),
        "frames": frames,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "build"))
    ap.add_argument("--copy-png", action="store_true", help="also copy PNGs into <out>/art/")
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    atlas, by_guid = {}, {}
    meta_count = 0
    for root in ROOTS:
        if not root.exists():
            print(f"  skip (missing): {root}", file=sys.stderr)
            continue
        for meta in root.rglob("*.png.meta"):
            meta_count += 1
            rec = parse_meta(meta)
            if not rec:
                continue
            atlas[rec["png"]] = rec
            by_guid[rec["guid"]] = rec

    clips = {}
    for root in ROOTS:
        if not root.exists():
            continue
        for anim in root.rglob("*.anim"):
            rec = parse_anim(anim, by_guid)
            if rec:
                clips[str(anim.relative_to(REPO))] = rec

    (out / "atlas.json").write_text(json.dumps(atlas, indent=1))
    (out / "clips.json").write_text(json.dumps(clips, indent=1))

    sliced = {k: v for k, v in atlas.items() if len(v["sprites"]) > 1}
    total_sprites = sum(len(v["sprites"]) for v in atlas.values())
    unresolved = sum(c["unresolved"] for c in clips.values())

    print(f".png.meta scanned    {meta_count}")
    print(f"textures indexed     {len(atlas)}")
    print(f"  multi-sprite       {len(sliced)}  (hand-sliced sheets)")
    print(f"named sprite rects   {total_sprites}")
    print(f"animation clips      {len(clips)}")
    print(f"  unresolved frames  {unresolved}")
    print(f"\nwrote {out/'atlas.json'}\n      {out/'clips.json'}")

    if args.copy_png:
        art = out / "art"
        n = 0
        for root in ROOTS:
            if not root.exists():
                continue
            for png in root.rglob("*.png"):
                dest = art / png.relative_to(root.parent)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(png, dest)
                n += 1
        print(f"copied {n} PNGs -> {art}")


if __name__ == "__main__":
    main()
