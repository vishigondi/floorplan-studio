#!/usr/bin/env python3
"""Measure Skylark 150's floor block spans from the real WikiHouse geometry.

WHY THIS EXISTS.

`MAX_JOIST_SPAN_FT = 16` in lib/build-validator.ts was a bare constant with no
provenance, in a repo that otherwise refuses unsourced numbers. The obvious fix
looked easy: WikiHouse publish floor block span tables in their structural
engineering guide.

They do not apply to us. Those tables are headed "250 series" and "200 series",
and the Skylark v1.0 README says plainly: "Previous versions had standard
insulation thicknesses of 200mm and 250mm. This version is thinner, with wall
thicknesses of 150mm and 200mm." The published tables describe the PREVIOUS
generation. The guide carries no table for Skylark 150, which is the library we
bill from — so there is no published span figure for the blocks we actually
count, and adopting the 200/250 numbers would have been the same mistake as
guessing, wearing a citation.

So we measure, exactly as scripts/measure-skylark-pitch.py measures the roof
pitches: download the floor blocks from a PINNED commit and read their geometry.

METHOD. A floor block spans between the walls it lands on, and that span is the
block's long dimension. For each block we take the axis-aligned bounding box of
every Brep in the detailed assembly and report the longest extent, plus the
other two, so the reader can see the block's whole shape rather than one number
lifted out of context. E-* are the end/edge blocks and F-* the field blocks;
both are reported because they differ in width and we want the span claim to
rest on the pair, not on whichever was measured first.

The measurements are committed in lib/kit/skylark.ts. This script is not part of
the gate ladder (it needs network and downloads ~10s of MB), and no WikiHouse
file is vendored into this repo (CC BY-SA 4.0).

Usage: pip install rhino3dm && python3 scripts/measure-skylark-floor-span.py
"""
import json
import os
import sys
import tempfile
import urllib.request

try:
    import rhino3dm
except ImportError:
    sys.exit("pip install rhino3dm")

# Pinned so a re-run measures the same geometry this repo's constants came from.
# Same commit as the roof-pitch measurement.
COMMIT = "6581cc1de0f4daef81a6b5c5a2eaed3c537d1d8f"
BLOCKS = ["E-L", "E-S", "E-XXS", "F-L", "F-S", "F-XXS"]
URL = ("https://raw.githubusercontent.com/wikihouseproject/Skylark/"
       f"{COMMIT}/SKYLARK150/Floors/{{b}}/{{b}}_detailed/{{b}}.3dm")

MM_PER_FT = 304.8


def extents_mm(path):
    """Axis-aligned extents of every Brep/Mesh in the file, largest first."""
    model = rhino3dm.File3dm.Read(path)
    if model is None:
        return None
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    found = False
    for obj in model.Objects:
        geom = obj.Geometry
        bbox = None
        try:
            bbox = geom.GetBoundingBox()
        except Exception:
            bbox = None
        if bbox is None:
            continue
        found = True
        for i, (a, b) in enumerate((
            (bbox.Min.X, bbox.Max.X),
            (bbox.Min.Y, bbox.Max.Y),
            (bbox.Min.Z, bbox.Max.Z),
        )):
            lo[i] = min(lo[i], a)
            hi[i] = max(hi[i], b)
    if not found:
        return None
    return sorted((hi[i] - lo[i] for i in range(3)), reverse=True)


def main():
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for block in BLOCKS:
            url = URL.format(b=block)
            dest = os.path.join(tmp, f"{block}.3dm")
            try:
                urllib.request.urlretrieve(url, dest)
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"  {block:6} DOWNLOAD FAILED: {exc}")
                continue
            ext = extents_mm(dest)
            if not ext:
                print(f"  {block:6} no readable geometry")
                continue
            span, w, d = ext
            out[block] = {"spanMm": round(span, 1), "otherMm": [round(w, 1), round(d, 1)]}
            print(f"  {block:6} span {span:8.1f} mm = {span / MM_PER_FT:6.2f} ft"
                  f"   (other extents {w:7.1f} x {d:6.1f} mm)")

    if out:
        print("\nJSON (for lib/kit/skylark.ts):")
        print(json.dumps(out, indent=2, sort_keys=True))
        longest = max(v["spanMm"] for v in out.values())
        print(f"\nLongest measured floor block span: {longest:.1f} mm "
              f"= {longest / MM_PER_FT:.2f} ft")
        print("That is the figure MAX_JOIST_SPAN_FT must not exceed, because no "
              "single block reaches further.")


if __name__ == "__main__":
    main()
